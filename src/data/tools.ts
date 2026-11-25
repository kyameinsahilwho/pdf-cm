export type CategoryId = 'all' | 'organize' | 'convert-from' | 'convert-to' | 'forms' | 'ai' | 'workflows';

export interface ToolDef {
  id: string;
  slug: string;
  name: string;
  desc: string;
  category: CategoryId;
  iconName: string;
  gradient: string;
  badge?: 'NEW!' | 'AI' | 'POPULAR';
  accept?: string;
  multiFile?: boolean;
  /**
   * Where the file is processed. Mirrors the actual code paths:
   * - 'browser': pdf-lib / pdf.js in the tab, the file is never uploaded.
   * - 'server-fallback': sent to the conversion service first, browser fallback if it is down.
   * - 'server': always sent to the conversion service.
   * The service works in a temporary folder and deletes its copy once the result is returned.
   */
  processing: ToolProcessing;
}

export type ToolProcessing = 'browser' | 'server-fallback' | 'server';

export interface ToolPrivacyInfo {
  processing: ToolProcessing;
  /** Badge text, e.g. "Runs in your browser". */
  label: string;
  /** Very short label for cards and tables. */
  short: string;
  /** One or two sentences explaining what happens to the file. */
  detail: string;
}

const SERVER_DETAIL =
  'Your file is sent to our conversion service, processed in a temporary folder and deleted as soon as the result is returned. The file contents are never stored; only basic request logs (such as the file name and size) are kept.';

export const PROCESSING_INFO: Record<ToolProcessing, Omit<ToolPrivacyInfo, 'processing'>> = {
  browser: {
    label: 'Runs in your browser',
    short: 'In your browser',
    detail: 'Your file is processed right here in your browser and is never uploaded.',
  },
  'server-fallback': {
    label: 'Processed on our server, deleted right after',
    short: 'Our server, not stored',
    detail: `${SERVER_DETAIL} If the service is unavailable, a simpler version runs in your browser instead.`,
  },
  server: {
    label: 'Processed on our server, deleted right after',
    short: 'Our server, not stored',
    detail: SERVER_DETAIL,
  },
};

/** Tool-specific wording where the generic text would overpromise. */
const PROCESSING_OVERRIDES: Record<string, Partial<Omit<ToolPrivacyInfo, 'processing'>>> = {
  protect: {
    detail: `${SERVER_DETAIL} Encryption needs the service: if it is unavailable, the downloaded file is not encrypted, so try again later.`,
  },
  unlock: {
    detail: `${SERVER_DETAIL} Removing a password needs the service: if it is unavailable, try again later.`,
  },
  'pdf-a': {
    detail: `${SERVER_DETAIL} PDF/A conversion needs the service: if it is unavailable, the file is only re-saved, not converted.`,
  },
  redact: {
    detail: `${SERVER_DETAIL} Removing the text under redactions needs the service: if it is unavailable, the browser fallback only covers content with black boxes.`,
  },
  'word-to-pdf': {
    detail: `${SERVER_DETAIL} If the service is unavailable, try again later: the browser fallback only extracts plain text and does not make a real PDF.`,
  },
  'html-to-pdf': {
    detail:
      'Your HTML is sent to our conversion service, processed in a temporary folder and deleted as soon as the PDF is returned. If the service is unavailable, a simpler version runs in your browser instead.',
  },
  workflow: {
    label: 'Runs in your browser, some steps on our server',
    short: 'Browser + our server',
    detail:
      'Watermark, rotate and page number steps run in your browser. Compress, protect, PDF/A and repair steps are sent to our conversion service and deleted as soon as the result is returned.',
  },
};

export function getToolPrivacy(tool: Pick<ToolDef, 'id' | 'processing'>): ToolPrivacyInfo {
  return {
    processing: tool.processing,
    ...PROCESSING_INFO[tool.processing],
    ...PROCESSING_OVERRIDES[tool.id],
  };
}

export const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'all', label: 'All Tools', icon: '❤️' },
  { id: 'organize', label: 'Organize & Edit', icon: '📁' },
  { id: 'convert-from', label: 'Convert FROM PDF', icon: '🔄' },
  { id: 'convert-to', label: 'Convert TO PDF', icon: '📄' },
  { id: 'forms', label: 'Forms & Sign', icon: '✍️' },
  { id: 'ai', label: 'AI Tools', icon: '⚡' },
  { id: 'workflows', label: 'Workflows', icon: '🛠️' },
];

export const TOOL_REGISTRY: ToolDef[] = [
  {
    id: 'merge',
    slug: 'merge-pdf',
    name: 'Merge PDF',
    desc: 'Combine PDFs in the order you want with the easiest PDF merger available.',
    category: 'organize',
    processing: 'browser',
    iconName: 'Merge',
    gradient: 'from-blue-500 to-blue-600',
    badge: 'POPULAR',
    accept: '.pdf',
    multiFile: true,
  },
  {
    id: 'split',
    slug: 'split-pdf',
    name: 'Split PDF',
    desc: 'Separate one page or a whole set for easy conversion into independent PDF files.',
    category: 'organize',
    processing: 'browser',
    iconName: 'Scissors',
    gradient: 'from-purple-500 to-indigo-600',
    badge: 'POPULAR',
    accept: '.pdf',
  },
  {
    id: 'compress',
    slug: 'compress-pdf',
    name: 'Compress PDF',
    desc: 'Reduce file size while optimizing for maximal PDF quality.',
    category: 'organize',
    processing: 'server-fallback',
    iconName: 'Minimize2',
    gradient: 'from-emerald-500 to-teal-600',
    badge: 'POPULAR',
    accept: '.pdf',
  },
  {
    id: 'pdf-to-word',
    slug: 'pdf-to-word',
    name: 'PDF to Word',
    desc: 'Easily convert your PDF files into easy to edit DOC and DOCX documents.',
    category: 'convert-from',
    processing: 'server',
    iconName: 'FileText',
    gradient: 'from-blue-600 to-cyan-600',
    badge: 'POPULAR',
    accept: '.pdf',
  },
  {
    id: 'pdf-to-ppt',
    slug: 'pdf-to-powerpoint',
    name: 'PDF to PowerPoint',
    desc: 'Turn your PDF files into easy to edit PPT and PPTX slideshows.',
    category: 'convert-from',
    processing: 'server',
    iconName: 'Presentation',
    gradient: 'from-orange-500 to-amber-500',
    accept: '.pdf',
  },
  {
    id: 'pdf-to-excel',
    slug: 'pdf-to-excel',
    name: 'PDF to Excel',
    desc: 'Pull data straight from PDFs into Excel spreadsheets in a few short seconds.',
    category: 'convert-from',
    processing: 'server',
    iconName: 'FileSpreadsheet',
    gradient: 'from-green-600 to-emerald-600',
    accept: '.pdf',
  },
  {
    id: 'word-to-pdf',
    slug: 'word-to-pdf',
    name: 'Word to PDF',
    desc: 'Make DOC and DOCX files easy to read by converting them to PDF.',
    category: 'convert-to',
    processing: 'server',
    iconName: 'FileUp',
    gradient: 'from-sky-500 to-blue-600',
    accept: '.doc,.docx',
  },
  {
    id: 'ppt-to-pdf',
    slug: 'powerpoint-to-pdf',
    name: 'PowerPoint to PDF',
    desc: 'Make PPT and PPTX slideshows easy to view by converting them to PDF.',
    category: 'convert-to',
    processing: 'server',
    iconName: 'Presentation',
    gradient: 'from-amber-500 to-orange-600',
    accept: '.ppt,.pptx',
  },
  {
    id: 'excel-to-pdf',
    slug: 'excel-to-pdf',
    name: 'Excel to PDF',
    desc: 'Make EXCEL spreadsheets easy to read by converting them to PDF.',
    category: 'convert-to',
    processing: 'server',
    iconName: 'FileSpreadsheet',
    gradient: 'from-emerald-600 to-green-700',
    accept: '.xls,.xlsx,.csv',
  },
  {
    id: 'edit',
    slug: 'edit-pdf',
    name: 'Edit PDF',
    desc: 'Add text, images, shapes or freehand annotations to a PDF document.',
    category: 'organize',
    processing: 'server-fallback',
    iconName: 'Edit3',
    gradient: 'from-rose-500 to-pink-600',
    badge: 'POPULAR',
    accept: '.pdf',
  },
  {
    id: 'pdf-to-jpg',
    slug: 'pdf-to-jpg',
    name: 'PDF to JPG',
    desc: 'Convert each PDF page into a JPG or extract all images contained in a PDF.',
    category: 'convert-from',
    processing: 'browser',
    iconName: 'Image',
    gradient: 'from-pink-500 to-rose-600',
    accept: '.pdf',
  },
  {
    id: 'jpg-to-pdf',
    slug: 'jpg-to-pdf',
    name: 'JPG to PDF',
    desc: 'Convert JPG images to PDF in seconds. Easily adjust orientation and margins.',
    category: 'convert-to',
    processing: 'browser',
    iconName: 'FilePlus',
    gradient: 'from-indigo-500 to-purple-600',
    accept: 'image/*',
    multiFile: true,
  },
  {
    id: 'sign',
    slug: 'sign-pdf',
    name: 'Sign PDF',
    desc: 'Sign yourself or request electronic signatures from others.',
    category: 'forms',
    processing: 'browser',
    iconName: 'PenTool',
    gradient: 'from-teal-500 to-emerald-600',
    badge: 'POPULAR',
    accept: '.pdf',
  },
  {
    id: 'watermark',
    slug: 'watermark',
    name: 'Watermark',
    desc: 'Stamp an image or text over your PDF in seconds. Choose typography & position.',
    category: 'organize',
    processing: 'browser',
    iconName: 'Stamp',
    gradient: 'from-fuchsia-500 to-pink-600',
    accept: '.pdf',
  },
  {
    id: 'rotate',
    slug: 'rotate-pdf',
    name: 'Rotate PDF',
    desc: 'Rotate your PDFs the way you need them. You can even rotate multiple PDFs at once!',
    category: 'organize',
    processing: 'browser',
    iconName: 'RotateCw',
    gradient: 'from-cyan-500 to-teal-500',
    accept: '.pdf',
  },
  {
    id: 'html-to-pdf',
    slug: 'html-to-pdf',
    name: 'HTML to PDF',
    desc: 'Convert webpages in HTML to PDF with a click.',
    category: 'convert-to',
    processing: 'server-fallback',
    iconName: 'Globe',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'unlock',
    slug: 'unlock-pdf',
    name: 'Unlock PDF',
    desc: 'Remove PDF password security, giving you the freedom to use your PDFs as you want.',
    category: 'organize',
    processing: 'server-fallback',
    iconName: 'Unlock',
    gradient: 'from-amber-400 to-yellow-500',
    accept: '.pdf',
  },
  {
    id: 'protect',
    slug: 'protect-pdf',
    name: 'Protect PDF',
    desc: 'Protect PDF files with a password. Encrypt PDF documents to prevent unauthorized access.',
    category: 'organize',
    processing: 'server-fallback',
    iconName: 'Lock',
    gradient: 'from-red-500 to-rose-600',
    accept: '.pdf',
  },
  {
    id: 'organize',
    slug: 'organize-pdf',
    name: 'Organize PDF',
    desc: 'Sort pages of your PDF file however you like. Delete PDF pages or add PDF pages.',
    category: 'organize',
    processing: 'browser',
    iconName: 'Layers',
    gradient: 'from-indigo-600 to-violet-600',
    accept: '.pdf',
  },
  {
    id: 'pdf-a',
    slug: 'pdf-to-pdf-a',
    name: 'PDF to PDF/A',
    desc: 'Transform your PDF to PDF/A, the ISO-standardized version for long-term archiving.',
    category: 'convert-from',
    processing: 'server-fallback',
    iconName: 'Archive',
    gradient: 'from-slate-600 to-zinc-700',
    accept: '.pdf',
  },
  {
    id: 'repair',
    slug: 'repair-pdf',
    name: 'Repair PDF',
    desc: 'Repair a damaged PDF and recover data from corrupt PDF. Fix PDF files with our Repair tool.',
    category: 'organize',
    processing: 'server-fallback',
    iconName: 'Wrench',
    gradient: 'from-orange-600 to-red-600',
    accept: '.pdf',
  },
  {
    id: 'page-numbers',
    slug: 'page-numbers',
    name: 'Page numbers',
    desc: 'Add page numbers into PDFs with ease. Choose your positions, dimensions, typography.',
    category: 'organize',
    processing: 'browser',
    iconName: 'Hash',
    gradient: 'from-cyan-600 to-teal-600',
    accept: '.pdf',
  },
  {
    id: 'scan-to-pdf',
    slug: 'scan-to-pdf',
    name: 'Scan to PDF',
    desc: 'Capture document scans from your camera/device and convert instantly.',
    category: 'convert-to',
    processing: 'browser',
    iconName: 'Camera',
    gradient: 'from-lime-500 to-emerald-600',
  },
  {
    id: 'ocr',
    slug: 'ocr-pdf',
    name: 'OCR PDF',
    desc: 'Easily convert scanned PDF into searchable and selectable documents.',
    category: 'ai',
    processing: 'server',
    iconName: 'Search',
    gradient: 'from-blue-600 to-indigo-600',
    accept: '.pdf',
  },
  {
    id: 'compare',
    slug: 'compare-pdf',
    name: 'Compare PDF',
    desc: 'Show a side-by-side document comparison and easily spot changes between different file versions.',
    category: 'organize',
    processing: 'browser',
    iconName: 'GitCompare',
    gradient: 'from-purple-600 to-pink-600',
    accept: '.pdf',
    multiFile: true,
  },
  {
    id: 'redact',
    slug: 'redact-pdf',
    name: 'Redact PDF',
    desc: 'Redact text and graphics to permanently remove sensitive information from a PDF.',
    category: 'organize',
    processing: 'server-fallback',
    iconName: 'EyeOff',
    gradient: 'from-rose-600 to-red-700',
    accept: '.pdf',
  },
  {
    id: 'crop',
    slug: 'crop-pdf',
    name: 'Crop PDF',
    desc: 'Crop margins of PDF documents or select specific areas, then apply the changes.',
    category: 'organize',
    processing: 'browser',
    iconName: 'Crop',
    gradient: 'from-teal-600 to-cyan-600',
    accept: '.pdf',
  },
  {
    id: 'pdf-forms',
    slug: 'pdf-forms',
    name: 'PDF Forms',
    desc: 'Detect form fields automatically, create interactive fillable PDFs, or fill PDF forms yourself.',
    category: 'forms',
    processing: 'browser',
    iconName: 'CheckSquare',
    gradient: 'from-pink-600 to-rose-600',
    badge: 'NEW!',
    accept: '.pdf',
  },
  {
    id: 'ai-summarizer',
    slug: 'ai-summarizer',
    name: 'AI Summarizer',
    desc: 'Early preview: extracts text from the first pages of a PDF so you can review or summarize it. No AI model is connected yet.',
    category: 'ai',
    processing: 'browser',
    iconName: 'Sparkles',
    gradient: 'from-purple-600 to-indigo-600',
    badge: 'NEW!',
    accept: '.pdf',
  },
  {
    id: 'translate',
    slug: 'translate-pdf',
    name: 'Translate PDF',
    desc: 'Early preview: extracts text from the first pages of a PDF so you can translate it. No AI model is connected yet, and layout is not kept.',
    category: 'ai',
    processing: 'browser',
    iconName: 'Languages',
    gradient: 'from-rose-500 to-pink-500',
    badge: 'NEW!',
    accept: '.pdf',
  },
  {
    id: 'pdf-to-markdown',
    slug: 'pdf-to-markdown',
    name: 'PDF to Markdown',
    desc: 'Easily turn PDFs into Markdown files. Headings, tables, lists, and links preserved automatically.',
    category: 'convert-from',
    processing: 'server',
    iconName: 'FileCode',
    gradient: 'from-emerald-600 to-teal-600',
    badge: 'NEW!',
    accept: '.pdf',
  },
  {
    id: 'workflow',
    slug: 'create-workflow',
    name: 'Create a Workflow',
    desc: 'Create custom workflows with your favorite tools, automate tasks, and reuse them anytime.',
    category: 'workflows',
    processing: 'server-fallback',
    iconName: 'Workflow',
    gradient: 'from-rose-500 via-pink-600 to-amber-500',
    badge: 'NEW!',
  },
  {
    id: 'restructure',
    slug: 'grid-layout',
    name: 'Grid Layout',
    desc: 'Fit multiple pages onto a single sheet in any custom grid.',
    category: 'organize',
    processing: 'browser',
    iconName: 'Grid',
    gradient: 'from-violet-500 to-purple-600',
    accept: '.pdf',
  },
  {
    id: 'word-counter',
    slug: 'word-counter',
    name: 'Word Counter',
    desc: 'Count words, analyze readability & extract text from any doc.',
    category: 'workflows',
    processing: 'browser',
    iconName: 'FileText',
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    id: 'text-copier',
    slug: 'text-copier',
    name: 'Text Copier',
    desc: 'Extract document text and copy it sequentially in custom word chunks.',
    category: 'workflows',
    processing: 'browser',
    iconName: 'Copy',
    gradient: 'from-violet-600 to-indigo-600',
  },
];
