import { Header } from "@/components/header";
import { PdfFusion } from "@/components/pdf-fusion";
import { Logo } from "@/components/logo";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <PdfFusion />
      </main>
      <footer className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
        <Logo className="h-4 w-4" />
        <span>© {new Date().getFullYear()} PDFusion. All rights reserved.</span>
      </footer>
    </div>
  );
}
