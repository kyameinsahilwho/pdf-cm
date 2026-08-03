import type { ToolDef } from '@/lib/tools-data';

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ToolSeoContent {
  title: string;
  description: string;
  keywords: string[];
  steps: string[];
  benefits: string[];
  faq: FaqItem[];
}

const CORE_KEYWORDS = ['pdf tool', 'online pdf', 'secure pdf tools', 'client side pdf'];

const CATEGORY_KEYWORDS: Record<ToolDef['category'], string[]> = {
  all: ['all pdf tools', 'pdf utilities'],
  organize: ['merge pdf', 'split pdf', 'organize pdf pages'],
  'convert-from': ['pdf conversion', 'pdf export'],
  'convert-to': ['convert to pdf', 'create pdf'],
  forms: ['sign pdf', 'fillable forms'],
  ai: ['ai pdf tools', 'smart pdf'],
  workflows: ['document workflow', 'productivity tools'],
};

const CATEGORY_BENEFITS: Record<ToolDef['category'], string[]> = {
  all: ['Fast browser-based processing', 'No file retention on servers', 'Consistent output quality'],
  organize: ['Rearrange and edit documents quickly', 'Keep PDF formatting intact', 'Run tasks entirely in-browser'],
  'convert-from': ['Export PDF content to practical formats', 'Preserve structure and readability', 'Save time on manual copy work'],
  'convert-to': ['Create standardized PDFs from source files', 'Share universally compatible files', 'Control file output without extra software'],
  forms: ['Collect signatures and form data faster', 'Prepare professional documents', 'Avoid printing and rescanning'],
  ai: ['Automate repetitive document tasks', 'Extract insights from long files', 'Improve turnaround for document workflows'],
  workflows: ['Bundle frequent tasks into repeatable flows', 'Reduce manual handoffs', 'Scale team document operations'],
};

export function getToolSeoContent(tool: ToolDef): ToolSeoContent {
  const title = `${tool.name} Online — Free, Private & SEO Optimized | Love for PDF`;
  const description = `${tool.desc} Use ${tool.name} online with secure browser processing and no permanent file storage.`;

  return {
    title,
    description,
    keywords: [
      tool.name.toLowerCase(),
      tool.slug,
      ...CATEGORY_KEYWORDS[tool.category],
      ...CORE_KEYWORDS,
    ],
    steps: [
      `Open the ${tool.name} tool page.`,
      tool.accept ? `Upload your ${tool.accept} file(s).` : 'Provide your source content.',
      'Configure the available options for your output.',
      'Run the tool and download the processed file instantly.',
    ],
    benefits: CATEGORY_BENEFITS[tool.category],
    faq: [
      {
        question: `Is ${tool.name} free to use?`,
        answer: `Yes. ${tool.name} is available on Love for PDF with a free browser-based workflow.`,
      },
      {
        question: `Is ${tool.name} secure?`,
        answer: `Files are processed with a privacy-focused flow and are not stored permanently on our servers.`,
      },
      {
        question: `How fast is ${tool.name}?`,
        answer: `Most jobs complete quickly depending on file size and your device performance.`,
      },
    ],
  };
}
