import { Logo } from '@/components/logo';

export function Header() {
  return (
    <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center gap-3">
        <Logo className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-primary">
          PDFusion
        </h1>
      </div>
    </header>
  );
}
