import { getToolPrivacy, type ToolDef } from '@/lib/tools-data';

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

const CORE_KEYWORDS = ['pdf tool', 'online pdf', 'free pdf tools', 'secure pdf tools'];

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
  all: ['Free with no account or sign-up', 'Consistent output quality'],
  organize: ['Rearrange and edit documents quickly', 'Keep PDF formatting intact'],
  'convert-from': ['Export PDF content to practical formats', 'Preserve structure and readability', 'Save time on manual copy work'],
  'convert-to': ['Create standardized PDFs from source files', 'Share universally compatible files', 'Control file output without extra software'],
  forms: ['Collect signatures and form data faster', 'Prepare professional documents', 'Avoid printing and rescanning'],
  ai: ['Automate repetitive document tasks', 'Extract insights from long files', 'Improve turnaround for document workflows'],
  workflows: ['Bundle frequent tasks into repeatable flows', 'Reduce manual handoffs', 'Scale team document operations'],
};

export function getToolSeoContent(tool: ToolDef): ToolSeoContent {
  const privacy = getToolPrivacy(tool);
  const inBrowser = privacy.processing === 'browser';

  const title = inBrowser
    ? `${tool.name} Online: Free, Runs in Your Browser | Love for PDF`
    : `${tool.name} Online: Free, No Sign-up | Love for PDF`;

  const description = inBrowser
    ? `${tool.desc} ${tool.name} runs right in your browser, so your file is never uploaded.`
    : `${tool.desc} Free, with no sign-up. Files are processed on our server and deleted as soon as the result is returned.`;

  const privacyBenefit = inBrowser
    ? 'Runs entirely in your browser, so your file is never uploaded'
    : 'Files are deleted from our server as soon as the result is returned';

  return {
    title,
    description,
    keywords: [
      tool.name.toLowerCase(),
      tool.slug,
      ...CATEGORY_KEYWORDS[tool.category],
      ...CORE_KEYWORDS,
      ...(inBrowser ? ['client side pdf', 'pdf tool no upload'] : []),
    ],
    steps: [
      `Open the ${tool.name} tool page.`,
      tool.accept ? `Choose your ${tool.accept} file(s).` : 'Provide your source content.',
      'Configure the available options for your output.',
      'Run the tool and download the processed file instantly.',
    ],
    benefits: [...CATEGORY_BENEFITS[tool.category], privacyBenefit],
    faq: [
      {
        question: `Is ${tool.name} free to use?`,
        answer: `Yes. ${tool.name} is free on Love for PDF, with no account or sign-up.`,
      },
      {
        question: `Does ${tool.name} upload my file?`,
        answer: `${inBrowser ? 'No.' : tool.id === 'workflow' ? 'Only for some steps.' : 'Yes, briefly.'} ${privacy.detail}`,
      },
      {
        question: `How fast is ${tool.name}?`,
        answer: `Most jobs complete quickly depending on file size and your device performance.`,
      },
    ],
  };
}
