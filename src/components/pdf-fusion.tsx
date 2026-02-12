'use client';

import { useState, useCallback, useRef, type DragEvent } from 'react';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, Merge, Settings, Download, Trash2, ArrowLeftRight, Rows, Columns, Grid, Layers, Combine, RotateCw, Scissors } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GridSelector } from './grid-selector';


interface PdfFile {
  id: string;
  file: File;
  name: string;
  previewUrl?: string; // Optional: for future preview implementation
}

interface RestructureFile {
  file: File;
  name: string;
}


export function PdfFusion() {
  // Merge State
  const [mergeFiles, setMergeFiles] = useState<PdfFile[]>([]);
  const [processingMerge, setProcessingMerge] = useState(false);
  const [progressMerge, setProgressMerge] = useState(0);
  const [draggedMergeItemIndex, setDraggedMergeItemIndex] = useState<number | null>(null);
  const [dragOverMergeItemIndex, setDragOverMergeItemIndex] = useState<number | null>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  // Restructure State
  const [restructureFile, setRestructureFile] = useState<RestructureFile | null>(null);
  const [processingRestructure, setProcessingRestructure] = useState(false);
  const [progressRestructure, setProgressRestructure] = useState(0);
  const [restructureMode, setRestructureMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const [rows, setRows] = useState<number>(2);
  const [cols, setCols] = useState<number>(2);
  const restructureInputRef = useRef<HTMLInputElement>(null);

  // Merge & Restructure State
  const [mergeRestructureFiles, setMergeRestructureFiles] = useState<PdfFile[]>([]);
  const [processingMergeRestructure, setProcessingMergeRestructure] = useState(false);
  const [progressMergeRestructure, setProgressMergeRestructure] = useState(0);
  const [draggedMRItemIndex, setDraggedMRItemIndex] = useState<number | null>(null);
  const [dragOverMRItemIndex, setDragOverMRItemIndex] = useState<number | null>(null);
  const mergeRestructureInputRef = useRef<HTMLInputElement>(null);
  // Reuse restructureMode, rows, cols for this tab as well

  // Rotate State
  const [rotateFile, setRotateFile] = useState<RestructureFile | null>(null);
  const [processingRotate, setProcessingRotate] = useState(false);
  const [progressRotate, setProgressRotate] = useState(0);
  const rotateInputRef = useRef<HTMLInputElement>(null);

  // Extract State
  const [extractFile, setExtractFile] = useState<RestructureFile | null>(null);
  const [processingExtract, setProcessingExtract] = useState(false);
  const [progressExtract, setProgressExtract] = useState(0);
  const [extractRange, setExtractRange] = useState('');
  const extractInputRef = useRef<HTMLInputElement>(null);


  const { toast } = useToast();


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'merge' | 'restructure' | 'merge-restructure' | 'rotate' | 'extract') => {
    const files = event.target.files;
    if (!files) return;

    const newFiles = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
    }));

    if (type === 'merge') {
      setMergeFiles((prevFiles) => [...prevFiles, ...newFiles]);
    } else if (type === 'restructure') {
       if (restructureFile) {
         toast({
           title: "Replace File",
           description: "Replacing the existing file for restructuring.",
           variant: "default",
         });
       }
       if (newFiles.length > 0) {
        setRestructureFile({ file: newFiles[0].file, name: newFiles[0].name });
       }
    } else if (type === 'merge-restructure') {
        setMergeRestructureFiles((prevFiles) => [...prevFiles, ...newFiles]);
    } else if (type === 'rotate') {
       if (rotateFile) {
         toast({
           title: "Replace File",
           description: "Replacing the existing file for rotation.",
           variant: "default",
         });
       }
       if (newFiles.length > 0) {
        setRotateFile({ file: newFiles[0].file, name: newFiles[0].name });
       }
    } else if (type === 'extract') {
       if (extractFile) {
         toast({
           title: "Replace File",
           description: "Replacing the existing file for extraction.",
           variant: "default",
         });
       }
       if (newFiles.length > 0) {
        setExtractFile({ file: newFiles[0].file, name: newFiles[0].name });
       }
    }

    // Reset file input
    event.target.value = '';
  };

  const removeFile = (id: string, type: 'merge' | 'restructure' | 'merge-restructure' | 'rotate' | 'extract') => {
    if (type === 'merge') {
      setMergeFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
    } else if (type === 'restructure'){
      setRestructureFile(null);
    } else if (type === 'merge-restructure'){
        setMergeRestructureFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
    } else if (type === 'rotate') {
      setRotateFile(null);
    } else if (type === 'extract') {
      setExtractFile(null);
    }
  };

  const handleExtract = async () => {
    if (!extractFile) {
      toast({
        title: 'Error',
        description: 'Please select a PDF file to extract pages from.',
        variant: 'destructive',
      });
      return;
    }

    if (!extractRange) {
        toast({
            title: 'Error',
            description: 'Please enter page numbers to extract (e.g., "1, 3-5").',
            variant: 'destructive',
        });
        return;
    }

    setProcessingExtract(true);
    setProgressExtract(0);

    try {
      const pdfBytes = await extractFile.file.arrayBuffer();
      let pdfDoc;
      try {
        pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      } catch (loadError: any) {
         if (loadError.message.toLowerCase().includes('encrypted')) {
             throw new Error('The PDF is encrypted and cannot be processed.');
         }
         if (loadError.message.toLowerCase().includes('invalid pdf structure') || loadError.message.toLowerCase().includes('expected') || loadError.message.toLowerCase().includes('offset')) {
             throw new Error(`The file "${extractFile.name}" is not a valid PDF or is corrupted.`);
         }
         throw loadError;
      }
      if (pdfDoc.isEncrypted) {
         throw new Error(`The file "${extractFile.name}" is encrypted and cannot be processed.`);
      }

      const totalPages = pdfDoc.getPageCount();
      const pageIndicesToExtract = new Set<number>();

      // Parse range string
      const parts = extractRange.split(',').map(p => p.trim());
      for (const part of parts) {
          if (part.includes('-')) {
              const [start, end] = part.split('-').map(num => parseInt(num, 10));
              if (isNaN(start) || isNaN(end)) continue;
               // Adjust for 0-based index
              const s = Math.min(start, end);
              const e = Math.max(start, end);
              for (let i = s; i <= e; i++) {
                  if (i >= 1 && i <= totalPages) pageIndicesToExtract.add(i - 1);
              }
          } else {
              const pageNum = parseInt(part, 10);
              if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                  pageIndicesToExtract.add(pageNum - 1);
              }
          }
      }

      if (pageIndicesToExtract.size === 0) {
          toast({
              title: 'Error',
              description: 'Invalid page range or no pages found in range.',
              variant: 'destructive',
          });
          setProcessingExtract(false);
          return;
      }

      const sortedIndices = Array.from(pageIndicesToExtract).sort((a, b) => a - b);
      const newPdfDoc = await PDFDocument.create();
      const copiedPages = await newPdfDoc.copyPages(pdfDoc, sortedIndices);

      for (let i = 0; i < copiedPages.length; i++) {
          newPdfDoc.addPage(copiedPages[i]);
          setProgressExtract(((i + 1) / copiedPages.length) * 100);
          await new Promise(resolve => setTimeout(resolve, 10));
      }

      const newPdfBytes = await newPdfDoc.save();
      downloadPdf(newPdfBytes, `extracted_${extractFile.name}`);
      toast({
        title: 'Success',
        description: 'Pages extracted successfully!',
      });
      // Optionally keep the file selected for more extractions
    } catch (error: any) {
      console.error('Error extracting PDF:', error);
      toast({
        title: 'Extraction Error',
        description: error.message || 'An unexpected error occurred during extraction.',
        variant: 'destructive',
      });
    } finally {
      setProcessingExtract(false);
      setProgressExtract(0);
    }
  };

  const handleRotate = async () => {
    if (!rotateFile) {
      toast({
        title: 'Error',
        description: 'Please select a PDF file to rotate.',
        variant: 'destructive',
      });
      return;
    }

    setProcessingRotate(true);
    setProgressRotate(0);

    try {
      const pdfBytes = await rotateFile.file.arrayBuffer();
      let pdfDoc;
      try {
        pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      } catch (loadError: any) {
         if (loadError.message.toLowerCase().includes('encrypted')) {
             throw new Error('The PDF is encrypted and cannot be rotated.');
         }
         if (loadError.message.toLowerCase().includes('invalid pdf structure') || loadError.message.toLowerCase().includes('expected') || loadError.message.toLowerCase().includes('offset')) {
             throw new Error(`The file "${rotateFile.name}" is not a valid PDF or is corrupted.`);
         }
         throw loadError;
      }
      if (pdfDoc.isEncrypted) {
         throw new Error(`The file "${rotateFile.name}" is encrypted and cannot be rotated.`);
      }

      const pages = pdfDoc.getPages();
      const totalPages = pages.length;

      if (totalPages === 0) {
          toast({
              title: 'Error',
              description: 'The selected PDF has no pages.',
              variant: 'destructive',
          });
          setProcessingRotate(false);
          return;
      }

      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        const rotation = page.getRotation();
        page.setRotation(degrees(rotation.angle + 90));

        setProgressRotate(((i + 1) / totalPages) * 100);
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      }

      const newPdfBytes = await pdfDoc.save();
      downloadPdf(newPdfBytes, `rotated_${rotateFile.name}`);
      toast({
        title: 'Success',
        description: 'PDF rotated successfully!',
      });
       setRotateFile(null);
    } catch (error: any) {
      console.error('Error rotating PDF:', error);
      toast({
        title: 'Rotation Error',
        description: error.message || 'An unexpected error occurred during rotation.',
        variant: 'destructive',
      });
    } finally {
      setProcessingRotate(false);
      setProgressRotate(0);
    }
  };

  const handleMerge = async () => {
    if (mergeFiles.length < 2) {
      toast({
        title: 'Error',
        description: 'Please select at least two PDF files to merge.',
        variant: 'destructive',
      });
      return;
    }

    setProcessingMerge(true);
    setProgressMerge(0);

    try {
      const mergedPdf = await PDFDocument.create();
      let currentProgress = 0;
      const totalFiles = mergeFiles.length;

      for (let i = 0; i < totalFiles; i++) {
        const file = mergeFiles[i];
        const pdfBytes = await file.file.arrayBuffer();
        // Attempt to load with encryption ignored first
        let pdfDoc;
        try {
            pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        } catch (loadError: any) {
            // If loading fails, check if it's an encryption error
            if (loadError.message.toLowerCase().includes('encrypted')) {
                throw new Error('One or more PDFs are encrypted and cannot be merged.');
            }
             // Check for invalid PDF structure
             if (loadError.message.toLowerCase().includes('invalid pdf structure') || loadError.message.toLowerCase().includes('expected') || loadError.message.toLowerCase().includes('offset')) {
                throw new Error(`File "${file.name}" is not a valid PDF or is corrupted.`);
             }
            throw loadError; // Re-throw other loading errors
        }

        // Check if document is actually encrypted after loading (pdf-lib might still load it)
        if (pdfDoc.isEncrypted) {
            throw new Error(`File "${file.name}" is encrypted and cannot be merged.`);
        }

        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));

        currentProgress = ((i + 1) / totalFiles) * 100;
        setProgressMerge(currentProgress);
         // Add a small delay for smoother progress update
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const mergedPdfBytes = await mergedPdf.save();
      downloadPdf(mergedPdfBytes, 'merged_document.pdf');
      toast({
        title: 'Success',
        description: 'PDFs merged successfully!',
      });
       setMergeFiles([]); // Clear files after successful merge
    } catch (error: any) {
        console.error('Error merging PDFs:', error);
        toast({
            title: 'Merge Error',
            description: error.message || 'An unexpected error occurred during merging.',
            variant: 'destructive',
        });
    } finally {
      setProcessingMerge(false);
      setProgressMerge(0);
    }
  };


  const handleRestructure = async () => {
    if (!restructureFile) {
      toast({
        title: 'Error',
        description: 'Please select a PDF file to restructure.',
        variant: 'destructive',
      });
      return;
    }
    if (rows < 1 || cols < 1 || rows * cols < 1) {
        toast({
            title: 'Error',
            description: 'Number of rows and columns must be at least 1.',
            variant: 'destructive',
        });
        return;
    }


    setProcessingRestructure(true);
    setProgressRestructure(0);

    try {
      const pdfBytes = await restructureFile.file.arrayBuffer();
      let pdfDoc;
        try {
            pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        } catch (loadError: any) {
            if (loadError.message.toLowerCase().includes('encrypted')) {
                throw new Error('The PDF is encrypted and cannot be restructured.');
            }
             if (loadError.message.toLowerCase().includes('invalid pdf structure') || loadError.message.toLowerCase().includes('expected') || loadError.message.toLowerCase().includes('offset')) {
                throw new Error(`The file "${restructureFile.name}" is not a valid PDF or is corrupted.`);
             }
            throw loadError;
        }
         if (pdfDoc.isEncrypted) {
            throw new Error(`The file "${restructureFile.name}" is encrypted and cannot be restructured.`);
        }

      const pages = pdfDoc.getPages();
      const totalPages = pages.length;

      if (totalPages === 0) {
          toast({
              title: 'Error',
              description: 'The selected PDF has no pages.',
              variant: 'destructive',
          });
          setProcessingRestructure(false);
          return;
      }


      const newPdfDoc = await PDFDocument.create();
      const pagesPerNewPage = rows * cols;


       for (let i = 0; i < totalPages; i += pagesPerNewPage) {
            const chunk = pages.slice(i, Math.min(i + pagesPerNewPage, totalPages));
            if (chunk.length === 0) continue;

            // Use the size of the first page in the chunk as the reference for the new page size
            const { width: refWidth, height: refHeight } = chunk[0].getSize();
            const newPage = newPdfDoc.addPage([refWidth, refHeight]);

            const tileWidth = refWidth / cols;
            const tileHeight = refHeight / rows;


            for (let j = 0; j < chunk.length; j++) {
                 const pageToEmbed = chunk[j];
                 const { width: pageWidth, height: pageHeight } = pageToEmbed.getSize();

                 // Calculate scale to fit the original page into the tile dimensions
                 const scaleX = tileWidth / pageWidth;
                 const scaleY = tileHeight / pageHeight;
                 const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio

                 // Calculate the position within the new page grid
                 const rowIndex = Math.floor(j / cols);
                 const colIndex = j % cols;

                 let xPos, yPos;
                if (restructureMode === 'horizontal') {
                     // Fill left-to-right, then top-to-bottom
                     xPos = colIndex * tileWidth;
                     yPos = refHeight - (rowIndex + 1) * tileHeight; // PDF coordinates start from bottom-left
                 } else { // vertical
                     // Fill top-to-bottom, then left-to-right
                     xPos = rowIndex * tileWidth; // Row index determines the column position
                     yPos = refHeight - (colIndex + 1) * tileHeight; // Column index determines the row position
                 }

                 // Center the scaled page within its tile
                const scaledWidth = pageWidth * scale;
                const scaledHeight = pageHeight * scale;
                xPos += (tileWidth - scaledWidth) / 2;
                yPos += (tileHeight - scaledHeight) / 2;


                const embeddedPage = await newPdfDoc.embedPage(pageToEmbed);

                newPage.drawPage(embeddedPage, {
                    x: xPos,
                    y: yPos,
                    width: scaledWidth,
                    height: scaledHeight,
                });
            }
            setProgressRestructure(((i + chunk.length) / totalPages) * 100);
             // Add a small delay for smoother progress update
             await new Promise(resolve => setTimeout(resolve, 50));
        }


      const newPdfBytes = await newPdfDoc.save();
      downloadPdf(newPdfBytes, `restructured_${restructureFile.name}`);
      toast({
        title: 'Success',
        description: 'PDF restructured successfully!',
      });
       setRestructureFile(null); // Clear file after success
    } catch (error: any) {
      console.error('Error restructuring PDF:', error);
      toast({
        title: 'Restructure Error',
        description: error.message || 'An unexpected error occurred during restructuring.',
        variant: 'destructive',
      });
    } finally {
      setProcessingRestructure(false);
      setProgressRestructure(0);
    }
  };

  const handleMergeAndRestructure = async () => {
       if (mergeRestructureFiles.length < 1) { // Need at least one file
         toast({
           title: 'Error',
           description: 'Please select at least one PDF file to merge and restructure.',
           variant: 'destructive',
         });
         return;
       }
       if (rows < 1 || cols < 1 || rows * cols < 1) {
           toast({
               title: 'Error',
               description: 'Number of rows and columns must be at least 1.',
               variant: 'destructive',
           });
           return;
       }

       setProcessingMergeRestructure(true);
       setProgressMergeRestructure(0);

       try {
           // 1. Merge Phase
           const mergedPdfDoc = await PDFDocument.create();
           let totalSourcePages = 0;
           const totalFiles = mergeRestructureFiles.length;
           const mergeProgressMultiplier = 0.5; // Allocate 50% progress to merging

           for (let i = 0; i < totalFiles; i++) {
               const file = mergeRestructureFiles[i];
               const pdfBytes = await file.file.arrayBuffer();
               let pdfDoc;
               try {
                   pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
               } catch (loadError: any) {
                   if (loadError.message.toLowerCase().includes('encrypted')) {
                       throw new Error(`File "${file.name}" is encrypted and cannot be processed.`);
                   }
                    if (loadError.message.toLowerCase().includes('invalid pdf structure') || loadError.message.toLowerCase().includes('expected') || loadError.message.toLowerCase().includes('offset')) {
                        throw new Error(`File "${file.name}" is not a valid PDF or is corrupted.`);
                    }
                   throw loadError;
               }
                if (pdfDoc.isEncrypted) {
                    throw new Error(`File "${file.name}" is encrypted and cannot be processed.`);
                }

               const copiedPages = await mergedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
               copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
               totalSourcePages += pdfDoc.getPageCount();

               const currentMergeProgress = ((i + 1) / totalFiles) * mergeProgressMultiplier * 100;
               setProgressMergeRestructure(currentMergeProgress);
               await new Promise(resolve => setTimeout(resolve, 20)); // Small delay
           }

           // 2. Restructure Phase
           const pages = mergedPdfDoc.getPages();
           const totalMergedPages = pages.length; // Should equal totalSourcePages
           const newPdfDoc = await PDFDocument.create();
           const pagesPerNewPage = rows * cols;
           const restructureProgressMultiplier = 0.5; // Allocate 50% progress to restructuring

            if (totalMergedPages === 0) {
                 toast({
                     title: 'Error',
                     description: 'The merged PDF has no pages.',
                     variant: 'destructive',
                 });
                 setProcessingMergeRestructure(false);
                 return;
             }


           for (let i = 0; i < totalMergedPages; i += pagesPerNewPage) {
               const chunk = pages.slice(i, Math.min(i + pagesPerNewPage, totalMergedPages));
               if (chunk.length === 0) continue;

               const { width: refWidth, height: refHeight } = chunk[0].getSize();
               const newPage = newPdfDoc.addPage([refWidth, refHeight]);
               const tileWidth = refWidth / cols;
               const tileHeight = refHeight / rows;

               for (let j = 0; j < chunk.length; j++) {
                   const pageToEmbed = chunk[j];
                   const { width: pageWidth, height: pageHeight } = pageToEmbed.getSize();
                   const scaleX = tileWidth / pageWidth;
                   const scaleY = tileHeight / pageHeight;
                   const scale = Math.min(scaleX, scaleY);
                   const rowIndex = Math.floor(j / cols);
                   const colIndex = j % cols;
                   let xPos, yPos;

                   if (restructureMode === 'horizontal') {
                      xPos = colIndex * tileWidth;
                      yPos = refHeight - (rowIndex + 1) * tileHeight;
                   } else {
                      xPos = rowIndex * tileWidth;
                      yPos = refHeight - (colIndex + 1) * tileHeight;
                   }

                   const scaledWidth = pageWidth * scale;
                   const scaledHeight = pageHeight * scale;
                   xPos += (tileWidth - scaledWidth) / 2;
                   yPos += (tileHeight - scaledHeight) / 2;

                   // Embedding pages from the *same document* (mergedPdfDoc) into newPdfDoc
                   // We need to embed them again, even if they were copied before.
                   const embeddedPage = await newPdfDoc.embedPage(pageToEmbed);

                   newPage.drawPage(embeddedPage, {
                       x: xPos,
                       y: yPos,
                       width: scaledWidth,
                       height: scaledHeight,
                   });
               }

               const currentRestructureProgress = ((i + chunk.length) / totalMergedPages) * restructureProgressMultiplier * 100;
               setProgressMergeRestructure(50 + currentRestructureProgress); // Add merge progress (50%)
               await new Promise(resolve => setTimeout(resolve, 20)); // Small delay
           }

           // 3. Save and Download
           const newPdfBytes = await newPdfDoc.save();
           downloadPdf(newPdfBytes, 'merged_restructured_document.pdf');
           toast({
               title: 'Success',
               description: 'PDFs merged and restructured successfully!',
           });
           setMergeRestructureFiles([]); // Clear files after success
       } catch (error: any) {
           console.error('Error merging and restructuring PDFs:', error);
           toast({
               title: 'Process Error',
               description: error.message || 'An unexpected error occurred during the process.',
               variant: 'destructive',
           });
       } finally {
           setProcessingMergeRestructure(false);
           setProgressMergeRestructure(0);
       }
   };


  const downloadPdf = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // --- Drag and Drop Handlers for Merge Tab ---
  const handleMergeDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
     e.dataTransfer.effectAllowed = 'move';
     setDraggedMergeItemIndex(index);
     e.currentTarget.classList.add('dragging');
   };

   const handleMergeDragEnter = (e: DragEvent<HTMLDivElement>, index: number) => {
     e.preventDefault();
     setDragOverMergeItemIndex(index);
     e.currentTarget.classList.add('drag-over');
   };

   const handleMergeDragLeave = (e: DragEvent<HTMLDivElement>) => {
     e.currentTarget.classList.remove('drag-over');
      if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
          return;
      }
     if (!e.currentTarget.contains(e.relatedTarget as Node)) {
         setDragOverMergeItemIndex(null);
     }
   };

   const handleMergeDragOver = (e: DragEvent<HTMLDivElement>) => {
     e.preventDefault();
     e.dataTransfer.dropEffect = 'move';
   };

   const handleMergeDrop = (e: DragEvent<HTMLDivElement>, index: number) => {
     e.preventDefault();
     e.currentTarget.classList.remove('drag-over');
     if (draggedMergeItemIndex === null) return;

     const newFiles = [...mergeFiles];
     const draggedItem = newFiles.splice(draggedMergeItemIndex, 1)[0];
     newFiles.splice(index, 0, draggedItem);

     setMergeFiles(newFiles);
     setDraggedMergeItemIndex(null);
     setDragOverMergeItemIndex(null);
   };

    const handleMergeDragEnd = (e: DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        setDraggedMergeItemIndex(null);
        setDragOverMergeItemIndex(null);
    };


   // --- Drag and Drop Handlers for Merge & Restructure Tab ---
    const handleMRDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
       e.dataTransfer.effectAllowed = 'move';
       setDraggedMRItemIndex(index);
       e.currentTarget.classList.add('dragging');
     };

     const handleMRDragEnter = (e: DragEvent<HTMLDivElement>, index: number) => {
       e.preventDefault();
       setDragOverMRItemIndex(index);
       e.currentTarget.classList.add('drag-over');
     };

     const handleMRDragLeave = (e: DragEvent<HTMLDivElement>) => {
       e.currentTarget.classList.remove('drag-over');
       if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
           return;
       }
       if (!e.currentTarget.contains(e.relatedTarget as Node)) {
           setDragOverMRItemIndex(null);
       }
     };

     const handleMRDragOver = (e: DragEvent<HTMLDivElement>) => {
       e.preventDefault();
       e.dataTransfer.dropEffect = 'move';
     };

     const handleMRDrop = (e: DragEvent<HTMLDivElement>, index: number) => {
       e.preventDefault();
       e.currentTarget.classList.remove('drag-over');
       if (draggedMRItemIndex === null) return;

       const newFiles = [...mergeRestructureFiles];
       const draggedItem = newFiles.splice(draggedMRItemIndex, 1)[0];
       newFiles.splice(index, 0, draggedItem);

       setMergeRestructureFiles(newFiles);
       setDraggedMRItemIndex(null);
       setDragOverMRItemIndex(null);
     };

      const handleMRDragEnd = (e: DragEvent<HTMLDivElement>) => {
          e.currentTarget.classList.remove('dragging');
          document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
          setDraggedMRItemIndex(null);
          setDragOverMRItemIndex(null);
      };

  // --- Helper Functions ---
  const triggerFileInput = (type: 'merge' | 'restructure' | 'merge-restructure' | 'rotate' | 'extract') => {
      if (type === 'merge' && mergeInputRef.current) {
        mergeInputRef.current.click();
      } else if (type === 'restructure' && restructureInputRef.current) {
        restructureInputRef.current.click();
      } else if (type === 'merge-restructure' && mergeRestructureInputRef.current) {
        mergeRestructureInputRef.current.click();
      } else if (type === 'rotate' && rotateInputRef.current) {
        rotateInputRef.current.click();
      } else if (type === 'extract' && extractInputRef.current) {
        extractInputRef.current.click();
      }
    };

   const handleGridChange = (newRows: number, newCols: number) => {
     setRows(newRows);
     setCols(newCols);
   };

   const handleRestructureModeChange = (value: 'horizontal' | 'vertical') => {
        setRestructureMode(value);
   };


  return (
    <Tabs defaultValue="merge" className="w-full max-w-4xl mx-auto">
      <TabsList className="flex w-full overflow-x-auto mb-6 bg-secondary p-1 h-auto gap-1">
        <TabsTrigger value="merge" className="flex-1 min-w-fit py-3 px-4 text-base md:text-lg whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
          <Merge className="mr-1 md:mr-2 h-4 w-4 md:h-5 md:w-5" /> Merge
        </TabsTrigger>
        <TabsTrigger value="restructure" className="flex-1 min-w-fit py-3 px-4 text-base md:text-lg whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
          <Grid className="mr-1 md:mr-2 h-4 w-4 md:h-5 md:w-5" /> Restructure
        </TabsTrigger>
        <TabsTrigger value="merge-restructure" className="flex-1 min-w-fit py-3 px-4 text-base md:text-lg whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
          <Combine className="mr-1 md:mr-2 h-4 w-4 md:h-5 md:w-5" /> Merge & Restructure
        </TabsTrigger>
        <TabsTrigger value="rotate" className="flex-1 min-w-fit py-3 px-4 text-base md:text-lg whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
          <RotateCw className="mr-1 md:mr-2 h-4 w-4 md:h-5 md:w-5" /> Rotate
        </TabsTrigger>
        <TabsTrigger value="extract" className="flex-1 min-w-fit py-3 px-4 text-base md:text-lg whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
          <Scissors className="mr-1 md:mr-2 h-4 w-4 md:h-5 md:w-5" /> Extract
        </TabsTrigger>
      </TabsList>

      {/* Merge Tab */}
      <TabsContent value="merge">
        <Card className="shadow-lg border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
              <Merge className="h-6 w-6" /> Merge Multiple PDFs
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Combine several PDF files into a single document. Drag and drop to reorder files before merging.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
               <Button onClick={() => triggerFileInput('merge')} variant="outline" size="lg" className="w-full md:w-auto border-dashed border-2 border-primary text-primary hover:bg-primary/10">
                 <Upload className="mr-2 h-5 w-5" /> Select PDFs to Merge
               </Button>
               <Input
                   ref={mergeInputRef}
                   type="file"
                   accept="application/pdf"
                   multiple
                   onChange={(e) => handleFileChange(e, 'merge')}
                   className="hidden"
                   id="merge-file-input"
               />
               <p className="text-sm text-muted-foreground">Or drag and drop files here</p>
            </div>

            {mergeFiles.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">Selected Files ({mergeFiles.length}):</h3>
                 <div className="border rounded-md p-4 space-y-2 max-h-60 overflow-y-auto bg-background">
                    {mergeFiles.map((pdfFile, index) => (
                      <div
                        key={pdfFile.id}
                        draggable
                        onDragStart={(e) => handleMergeDragStart(e, index)}
                        onDragEnter={(e) => handleMergeDragEnter(e, index)}
                        onDragLeave={handleMergeDragLeave}
                        onDragOver={handleMergeDragOver}
                        onDrop={(e) => handleMergeDrop(e, index)}
                        onDragEnd={handleMergeDragEnd}
                        className={`flex items-center justify-between p-2 rounded-md border bg-card hover:bg-muted/50 cursor-move transition-all duration-150 ease-in-out ${draggedMergeItemIndex === index ? 'dragging' : ''} ${dragOverMergeItemIndex === index ? 'drag-over' : ''}`}
                      >
                        <span className="text-sm font-medium text-card-foreground truncate mr-2">{index + 1}. {pdfFile.name}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeFile(pdfFile.id, 'merge')} className="text-destructive hover:bg-destructive/10 h-7 w-7">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove {pdfFile.name}</span>
                        </Button>
                      </div>
                    ))}
                    {/* Placeholder for drop visualization */}
                   {draggedMergeItemIndex !== null && dragOverMergeItemIndex === mergeFiles.length && (
                      <div className="h-10 border-2 border-dashed border-primary rounded-md bg-muted/30 transition-all"></div>
                    )}
                  </div>
              </div>
            )}

            {processingMerge && (
                <div className="space-y-2">
                     <Label className="text-sm font-medium text-primary">Processing...</Label>
                    <Progress value={progressMerge} className="w-full h-3 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-primary" />
                     <p className="text-xs text-muted-foreground text-right">{Math.round(progressMerge)}% complete</p>
                 </div>
            )}

          </CardContent>
          <CardFooter>
            <Button
              onClick={handleMerge}
              disabled={processingMerge || mergeFiles.length < 2}
              size="lg"
              className="w-full bg-gradient-to-r from-accent to-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingMerge ? (
                  <>
                     <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                     Merging...
                  </>
              ) : (
                <>
                  <Merge className="mr-2 h-5 w-5" /> Merge PDFs
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      {/* Restructure Tab */}
      <TabsContent value="restructure">
        <Card className="shadow-lg border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
                <Grid className="h-6 w-6" /> Restructure PDF Pages
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Combine multiple pages of a single PDF onto one page, arranged horizontally or vertically in a grid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex flex-col items-center space-y-4">
                <Button onClick={() => triggerFileInput('restructure')} variant="outline" size="lg" className="w-full md:w-auto border-dashed border-2 border-primary text-primary hover:bg-primary/10">
                  <Upload className="mr-2 h-5 w-5" /> Select PDF to Restructure
                </Button>
                <Input
                    ref={restructureInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileChange(e, 'restructure')}
                    className="hidden"
                    id="restructure-file-input"
                />
               <p className="text-sm text-muted-foreground">Or drag and drop a single file here</p>
             </div>

             {restructureFile && (
               <div className="border rounded-md p-4 bg-card space-y-3">
                 <h3 className="text-lg font-medium text-foreground">Selected File:</h3>
                 <div className="flex items-center justify-between p-2 rounded-md border bg-background">
                    <span className="text-sm font-medium text-foreground truncate mr-2">{restructureFile.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeFile('', 'restructure')} className="text-destructive hover:bg-destructive/10 h-7 w-7">
                      <Trash2 className="h-4 w-4" />
                       <span className="sr-only">Remove {restructureFile.name}</span>
                    </Button>
                  </div>
               </div>
             )}


            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
               {/* Arrangement Options */}
                 <div className="space-y-3">
                     <Label className="text-base font-medium flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-primary" /> Arrangement</Label>
                     <RadioGroup defaultValue="horizontal" value={restructureMode} onValueChange={handleRestructureModeChange} className="flex flex-wrap gap-4">
                       <div className="flex items-center space-x-2">
                         <RadioGroupItem value="horizontal" id="horizontal-restructure" />
                         <Label htmlFor="horizontal-restructure" className="cursor-pointer flex items-center gap-1"><Columns className="w-4 h-4"/>Horizontal</Label>
                       </div>
                       <div className="flex items-center space-x-2">
                         <RadioGroupItem value="vertical" id="vertical-restructure" />
                         <Label htmlFor="vertical-restructure" className="cursor-pointer flex items-center gap-1"><Rows className="w-4 h-4"/>Vertical</Label>
                       </div>
                     </RadioGroup>
                       <p className="text-xs text-muted-foreground">
                            {restructureMode === 'horizontal'
                              ? 'Pages fill row by row, left to right, then top to bottom.'
                              : 'Pages fill column by column, top to bottom, then left to right.'}
                       </p>
                 </div>


               {/* Grid Size Options */}
                <div className="space-y-3">
                     <Label className="text-base font-medium flex items-center gap-2"><Grid className="w-5 h-5 text-primary" /> Grid Size (Pages per Sheet)</Label>
                     <GridSelector
                        initialRows={rows}
                        initialCols={cols}
                        maxRows={8}
                        maxCols={8}
                        onChange={handleGridChange}
                     />
                     <p className="text-xs text-muted-foreground text-center md:text-left mt-2">
                         Selected: {rows} {rows > 1 ? 'Rows' : 'Row'} x {cols} {cols > 1 ? 'Columns' : 'Column'} ({rows * cols} pages/sheet)
                     </p>
                 </div>
            </div>

            {processingRestructure && (
               <div className="space-y-2">
                    <Label className="text-sm font-medium text-primary">Processing...</Label>
                   <Progress value={progressRestructure} className="w-full h-3 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-primary" />
                    <p className="text-xs text-muted-foreground text-right">{Math.round(progressRestructure)}% complete</p>
                </div>
            )}

          </CardContent>
          <CardFooter>
            <Button
              onClick={handleRestructure}
              disabled={processingRestructure || !restructureFile}
              size="lg"
              className="w-full bg-gradient-to-r from-accent to-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingRestructure ? (
                 <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                    Restructuring...
                 </>
              ) : (
                <>
                  <Download className="mr-2 h-5 w-5" /> Restructure & Download
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

       {/* Merge & Restructure Tab */}
      <TabsContent value="merge-restructure">
        <Card className="shadow-lg border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
              <Combine className="h-6 w-6" /> Merge & Restructure PDFs
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              First, merge multiple PDF files in the desired order. Then, restructure the combined pages onto single sheets in a grid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Selection */}
             <div className="flex flex-col items-center space-y-4">
               <Button onClick={() => triggerFileInput('merge-restructure')} variant="outline" size="lg" className="w-full md:w-auto border-dashed border-2 border-primary text-primary hover:bg-primary/10">
                 <Upload className="mr-2 h-5 w-5" /> Select PDFs to Process
               </Button>
               <Input
                   ref={mergeRestructureInputRef}
                   type="file"
                   accept="application/pdf"
                   multiple
                   onChange={(e) => handleFileChange(e, 'merge-restructure')}
                   className="hidden"
                   id="merge-restructure-file-input"
               />
               <p className="text-sm text-muted-foreground">Or drag and drop files here</p>
            </div>

            {/* File List & Order */}
             {mergeRestructureFiles.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-foreground">Selected Files ({mergeRestructureFiles.length}) - Drag to Reorder:</h3>
                 <div className="border rounded-md p-4 space-y-2 max-h-60 overflow-y-auto bg-background">
                    {mergeRestructureFiles.map((pdfFile, index) => (
                      <div
                        key={pdfFile.id}
                        draggable
                        onDragStart={(e) => handleMRDragStart(e, index)}
                        onDragEnter={(e) => handleMRDragEnter(e, index)}
                        onDragLeave={handleMRDragLeave}
                        onDragOver={handleMRDragOver}
                        onDrop={(e) => handleMRDrop(e, index)}
                        onDragEnd={handleMRDragEnd}
                        className={`flex items-center justify-between p-2 rounded-md border bg-card hover:bg-muted/50 cursor-move transition-all duration-150 ease-in-out ${draggedMRItemIndex === index ? 'dragging' : ''} ${dragOverMRItemIndex === index ? 'drag-over' : ''}`}
                      >
                        <span className="text-sm font-medium text-card-foreground truncate mr-2">{index + 1}. {pdfFile.name}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeFile(pdfFile.id, 'merge-restructure')} className="text-destructive hover:bg-destructive/10 h-7 w-7">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove {pdfFile.name}</span>
                        </Button>
                      </div>
                    ))}
                    {/* Placeholder */}
                   {draggedMRItemIndex !== null && dragOverMRItemIndex === mergeRestructureFiles.length && (
                      <div className="h-10 border-2 border-dashed border-primary rounded-md bg-muted/30 transition-all"></div>
                    )}
                  </div>
              </div>
            )}

            {/* Restructure Options */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                 <div className="space-y-3">
                     <Label className="text-base font-medium flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-primary" /> Arrangement</Label>
                     <RadioGroup defaultValue="horizontal" value={restructureMode} onValueChange={handleRestructureModeChange} className="flex flex-wrap gap-4">
                       <div className="flex items-center space-x-2">
                         <RadioGroupItem value="horizontal" id="horizontal-mr" />
                         <Label htmlFor="horizontal-mr" className="cursor-pointer flex items-center gap-1"><Columns className="w-4 h-4"/>Horizontal</Label>
                       </div>
                       <div className="flex items-center space-x-2">
                         <RadioGroupItem value="vertical" id="vertical-mr" />
                         <Label htmlFor="vertical-mr" className="cursor-pointer flex items-center gap-1"><Rows className="w-4 h-4"/>Vertical</Label>
                       </div>
                     </RadioGroup>
                      <p className="text-xs text-muted-foreground">
                            {restructureMode === 'horizontal'
                              ? 'Pages fill row by row, left to right, then top to bottom.'
                              : 'Pages fill column by column, top to bottom, then left to right.'}
                       </p>
                 </div>

                <div className="space-y-3">
                     <Label className="text-base font-medium flex items-center gap-2"><Grid className="w-5 h-5 text-primary" /> Grid Size (Pages per Sheet)</Label>
                     <GridSelector
                        initialRows={rows}
                        initialCols={cols}
                        maxRows={8}
                        maxCols={8}
                        onChange={handleGridChange}
                     />
                      <p className="text-xs text-muted-foreground text-center md:text-left mt-2">
                         Selected: {rows} {rows > 1 ? 'Rows' : 'Row'} x {cols} {cols > 1 ? 'Columns' : 'Column'} ({rows * cols} pages/sheet)
                     </p>
                 </div>
            </div>

            {/* Progress Bar */}
            {processingMergeRestructure && (
                <div className="space-y-2">
                     <Label className="text-sm font-medium text-primary">Processing...</Label>
                    <Progress value={progressMergeRestructure} className="w-full h-3 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-primary" />
                    <p className="text-xs text-muted-foreground text-right">
                      {Math.round(progressMergeRestructure)}% complete ({progressMergeRestructure <= 50 ? 'Merging' : 'Restructuring'})
                    </p>
                 </div>
            )}

          </CardContent>
          <CardFooter>
            <Button
              onClick={handleMergeAndRestructure}
              disabled={processingMergeRestructure || mergeRestructureFiles.length < 1}
              size="lg"
              className="w-full bg-gradient-to-r from-accent to-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingMergeRestructure ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                     Processing...
                  </>
              ) : (
                <>
                  <Layers className="mr-2 h-5 w-5" /> Merge & Restructure
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      {/* Rotate Tab */}
      <TabsContent value="rotate">
        <Card className="shadow-lg border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
                <RotateCw className="h-6 w-6" /> Rotate PDF
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Rotate all pages of your PDF file by 90 degrees clockwise.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex flex-col items-center space-y-4">
                <Button onClick={() => triggerFileInput('rotate')} variant="outline" size="lg" className="w-full md:w-auto border-dashed border-2 border-primary text-primary hover:bg-primary/10">
                  <Upload className="mr-2 h-5 w-5" /> Select PDF to Rotate
                </Button>
                <Input
                    ref={rotateInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileChange(e, 'rotate')}
                    className="hidden"
                    id="rotate-file-input"
                />
               <p className="text-sm text-muted-foreground">Or drag and drop a single file here</p>
             </div>

             {rotateFile && (
               <div className="border rounded-md p-4 bg-card space-y-3">
                 <h3 className="text-lg font-medium text-foreground">Selected File:</h3>
                 <div className="flex items-center justify-between p-2 rounded-md border bg-background">
                    <span className="text-sm font-medium text-foreground truncate mr-2">{rotateFile.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeFile('', 'rotate')} className="text-destructive hover:bg-destructive/10 h-7 w-7">
                      <Trash2 className="h-4 w-4" />
                       <span className="sr-only">Remove {rotateFile.name}</span>
                    </Button>
                  </div>
               </div>
             )}

            {processingRotate && (
               <div className="space-y-2">
                    <Label className="text-sm font-medium text-primary">Processing...</Label>
                   <Progress value={progressRotate} className="w-full h-3 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-primary" />
                    <p className="text-xs text-muted-foreground text-right">{Math.round(progressRotate)}% complete</p>
                </div>
            )}

          </CardContent>
          <CardFooter>
            <Button
              onClick={handleRotate}
              disabled={processingRotate || !rotateFile}
              size="lg"
              className="w-full bg-gradient-to-r from-accent to-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingRotate ? (
                 <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                    Rotating...
                 </>
              ) : (
                <>
                  <RotateCw className="mr-2 h-5 w-5" /> Rotate All Pages
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      {/* Extract Tab */}
      <TabsContent value="extract">
        <Card className="shadow-lg border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2">
                <Scissors className="h-6 w-6" /> Extract Pages
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Create a new PDF containing only specific pages from your original file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex flex-col items-center space-y-4">
                <Button onClick={() => triggerFileInput('extract')} variant="outline" size="lg" className="w-full md:w-auto border-dashed border-2 border-primary text-primary hover:bg-primary/10">
                  <Upload className="mr-2 h-5 w-5" /> Select PDF to Extract From
                </Button>
                <Input
                    ref={extractInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileChange(e, 'extract')}
                    className="hidden"
                    id="extract-file-input"
                />
               <p className="text-sm text-muted-foreground">Or drag and drop a single file here</p>
             </div>

             {extractFile && (
               <div className="border rounded-md p-4 bg-card space-y-3">
                 <h3 className="text-lg font-medium text-foreground">Selected File:</h3>
                 <div className="flex items-center justify-between p-2 rounded-md border bg-background">
                    <span className="text-sm font-medium text-foreground truncate mr-2">{extractFile.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeFile('', 'extract')} className="text-destructive hover:bg-destructive/10 h-7 w-7">
                      <Trash2 className="h-4 w-4" />
                       <span className="sr-only">Remove {extractFile.name}</span>
                    </Button>
                  </div>
               </div>
             )}

             <div className="space-y-3">
                 <Label htmlFor="extract-range" className="text-base font-medium">Page Range</Label>
                 <Input
                     id="extract-range"
                     placeholder="e.g., 1-3, 5, 8-10"
                     value={extractRange}
                     onChange={(e) => setExtractRange(e.target.value)}
                 />
                 <p className="text-xs text-muted-foreground">
                     Enter page numbers and/or ranges separated by commas.
                 </p>
             </div>

            {processingExtract && (
               <div className="space-y-2">
                    <Label className="text-sm font-medium text-primary">Processing...</Label>
                   <Progress value={progressExtract} className="w-full h-3 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-primary" />
                    <p className="text-xs text-muted-foreground text-right">{Math.round(progressExtract)}% complete</p>
                </div>
            )}

          </CardContent>
          <CardFooter>
            <Button
              onClick={handleExtract}
              disabled={processingExtract || !extractFile || !extractRange}
              size="lg"
              className="w-full bg-gradient-to-r from-accent to-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingExtract ? (
                 <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                    Extracting...
                 </>
              ) : (
                <>
                  <Scissors className="mr-2 h-5 w-5" /> Extract Pages
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>


    </Tabs>
  );
}
