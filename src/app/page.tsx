import { PdfFusion } from "@/components/pdf-fusion";

export default function Home() {
  return (
    <div className="app-shell">
      <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        <PdfFusion />
      </main>

      <footer className="flex items-center justify-center gap-3 py-4 text-muted-foreground text-xs border-t border-border/50">
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 1L7.5 4H11L8.25 6.25L9.25 9.5L6 7.5L2.75 9.5L3.75 6.25L1 4H4.5L6 1Z" fill="currentColor" opacity="0.6"/>
          </svg>
          Files never leave your browser
        </span>
        <span className="opacity-30">·</span>
        <span>© {new Date().getFullYear()} PDFusion</span>
      </footer>
    </div>
  );
}
