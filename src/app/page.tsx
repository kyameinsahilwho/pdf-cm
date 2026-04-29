import { PdfFusion } from "@/components/pdf-fusion";

export default function Home() {
  return (
    <div className="relative flex flex-col min-h-screen">

      <main className="flex-grow flex items-start justify-center px-4 sm:px-6 py-12 sm:py-20 relative z-10">
        <PdfFusion />
      </main>

      <footer className="relative z-10 flex items-center justify-center gap-2 py-5 text-muted-foreground text-xs">
        <span>🔒 Files never leave your browser</span>
        <span className="opacity-30">·</span>
        <span>© {new Date().getFullYear()} PDFusion</span>
      </footer>
    </div>
  );
}
