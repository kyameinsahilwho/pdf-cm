import type { MetadataRoute } from 'next';
import { TOOL_REGISTRY } from '@/lib/tools-data';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://pdf-cm.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    ...TOOL_REGISTRY.map((tool) => ({
      url: `${SITE_URL}/${tool.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
