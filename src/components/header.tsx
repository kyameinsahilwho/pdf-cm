import { Logo } from '@/components/logo';

export function Header() {
  return (
    <header className="bg-card border-b-4 border-border sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3 flex items-center gap-3">
        <Logo className="h-10 w-10 text-primary" />
        <h1 className="text-3xl fun-title text-primary">
          PDFusion
        </h1>
      </div>
    </header>
  );
}
