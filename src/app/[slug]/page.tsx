import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { TOOL_REGISTRY } from '@/lib/tools-data';
import { ToolWorkspace } from '@/components/tool-workspace';
import { ShieldCheck } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return TOOL_REGISTRY.map((tool) => ({
    slug: tool.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = TOOL_REGISTRY.find((t) => t.slug === slug);
  if (!tool) return { title: 'Tool Not Found — Love for PDF' };

  return {
    title: `${tool.name} Online — Free & Secure | Love for PDF`,
    description: tool.desc,
  };
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const tool = TOOL_REGISTRY.find((t) => t.slug === slug);

  if (!tool) {
    notFound();
  }

  // Remove site Header and Footer for dedicated studio tools (Edit, Redact, Workflow, Sign)
  const isStudioPage =
    ['edit-pdf', 'redact-pdf', 'create-workflow', 'sign-pdf'].includes(slug) ||
    tool.id === 'edit' ||
    tool.id === 'redact' ||
    tool.id === 'workflow';

  if (isStudioPage) {
    return (
      <div className="w-full min-h-screen bg-slate-950 flex flex-col font-sans overflow-x-hidden">
        <ToolWorkspace tool={tool} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-8 w-full">
        <ToolWorkspace tool={tool} />
      </main>

      <footer className="border-t border-white/[0.06] bg-[#08090c]/80 backdrop-blur-md py-6 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Zero Server Storage • Files never leave your browser • 100% Client-Side
          </span>
          <span className="text-xs text-slate-600">© {new Date().getFullYear()} Love for PDF</span>
        </div>
      </footer>
    </div>
  );
}
