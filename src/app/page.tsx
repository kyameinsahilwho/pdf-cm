import { Header } from "@/components/header";
import { PdfFusion } from "@/components/pdf-fusion";

export default function Home() {
  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 w-full">
        <PdfFusion />
      </main>
      <footer className="border-t border-white/[0.06] bg-[#08090c]/80 backdrop-blur-md py-6 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Zero Server Storage • Files never leave your browser • 100% Client-Side Privacy
          </p>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} Love for PDF. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
