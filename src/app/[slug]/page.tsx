import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { TOOL_REGISTRY } from '@/lib/tools-data';
import { ToolWorkspace } from '@/components/tool-workspace';
import { ShieldCheck } from 'lucide-react';
import { getToolSeoContent } from '@/lib/tool-seo';

interface Props {
  params: Promise<{ slug: string }>;
}

const SITE_NAME = 'Love for PDF';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://pdf-cm.vercel.app';

export async function generateStaticParams() {
  return TOOL_REGISTRY.map((tool) => ({
    slug: tool.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = TOOL_REGISTRY.find((t) => t.slug === slug);
  if (!tool) return { title: 'Tool Not Found — Love for PDF' };

  const seo = getToolSeoContent(tool);
  const canonical = `${SITE_URL}/${tool.slug}`;

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
    },
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

  const seo = getToolSeoContent(tool);
  const canonical = `${SITE_URL}/${tool.slug}`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: tool.name, item: canonical },
    ],
  };

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: seo.description,
    url: canonical,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: seo.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-8 w-full gap-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

        <ToolWorkspace tool={tool} />

        <section className="w-full max-w-4xl rounded-2xl p-6 bg-[#131520]/90 border border-white/[0.08] space-y-5">
          <h2 className="text-xl font-bold text-white">About {tool.name}</h2>
          <p className="text-sm text-slate-300 leading-relaxed">{seo.description}</p>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">How to use {tool.name}</h3>
            <ol className="list-decimal list-inside text-sm text-slate-300 space-y-1">
              {seo.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">Why use this tool</h3>
            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
              {seo.benefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-slate-100">Frequently asked questions</h3>
            {seo.faq.map((item) => (
              <article key={item.question} className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-200">{item.question}</h4>
                <p className="text-sm text-slate-400">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>
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
