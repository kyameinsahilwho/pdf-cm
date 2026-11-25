import { MonitorSmartphone, ServerCog } from 'lucide-react';
import { getToolPrivacy, type ToolDef } from '@/lib/tools-data';

interface ToolPrivacyBadgeProps {
  tool: Pick<ToolDef, 'id' | 'processing'>;
  /** 'full' shows the label, 'short' the compact label for cards and tables. */
  size?: 'full' | 'short';
  className?: string;
}

/** Shows where a tool processes the file, driven by `processing` in tools-data. */
export function ToolPrivacyBadge({ tool, size = 'full', className = '' }: ToolPrivacyBadgeProps) {
  const info = getToolPrivacy(tool);
  const inBrowser = info.processing === 'browser';
  const Icon = inBrowser ? MonitorSmartphone : ServerCog;
  const tone = inBrowser
    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
    : 'bg-sky-500/10 border-sky-500/25 text-sky-300';

  return (
    <span
      title={info.detail}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${
        size === 'full' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]'
      } ${tone} ${className}`}
    >
      <Icon className={size === 'full' ? 'w-3.5 h-3.5 shrink-0' : 'w-3 h-3 shrink-0'} aria-hidden="true" />
      <span>{size === 'full' ? info.label : info.short}</span>
    </span>
  );
}
