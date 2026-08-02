import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground space-y-4">
      <h1 className="text-4xl font-extrabold font-heading">404 - Page Not Found</h1>
      <p className="text-muted-foreground text-sm max-w-md">
        The requested PDF tool or page could not be found. Return to all PDF tools to continue.
      </p>
      <Link href="/" className="btn-fun px-6 py-3 font-bold text-sm rounded-xl">
        Return to Home & All Tools
      </Link>
    </div>
  );
}
