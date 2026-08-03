import React from 'react';
import { Link } from 'react-router-dom';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const blocks = content.split('\n\n').map((b) => b.trim()).filter(Boolean);

  const renderInline = (text: string): React.ReactNode[] => {
    // Process links [text](url), bold **text**, italic *text*, inline `code`
    const tokens: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // 1. Link [label](url)
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const [full, label, url] = linkMatch;
        if (url.startsWith('/')) {
          tokens.push(
            <Link
              key={keyIdx++}
              to={url}
              className="text-amber-400 font-medium hover:text-amber-300 underline underline-offset-4 transition-colors"
            >
              {label}
            </Link>
          );
        } else {
          tokens.push(
            <a
              key={keyIdx++}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 font-medium hover:text-amber-300 underline underline-offset-4 transition-colors"
            >
              {label}
            </a>
          );
        }
        remaining = remaining.slice(full.length);
        continue;
      }

      // 2. Bold **text**
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        tokens.push(
          <strong key={keyIdx++} className="font-bold text-white">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // 3. Inline code `code`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        tokens.push(
          <code
            key={keyIdx++}
            className="font-mono text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded"
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // 4. Plain text up to next special character
      const nextSpecial = remaining.search(/\[|\*\*|`/);
      if (nextSpecial === -1) {
        tokens.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        // Fallback single character if regex missed
        tokens.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        tokens.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return tokens;
  };

  return (
    <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
      {blocks.map((block, index) => {
        // Horizontal Rule
        if (block === '---' || block === '***') {
          return <hr key={index} className="border-t border-white/[0.08] my-8" />;
        }

        // Headers
        if (block.startsWith('# ')) {
          return (
            <h1
              key={index}
              className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight pt-4 pb-2 border-b border-white/[0.08]"
            >
              {renderInline(block.replace('# ', ''))}
            </h1>
          );
        }
        if (block.startsWith('## ')) {
          return (
            <h2
              key={index}
              className="text-xl sm:text-2xl font-bold text-white tracking-tight pt-6 pb-2 border-b border-white/[0.06] flex items-center gap-2"
            >
              <span className="w-1.5 h-5 bg-rose-500 rounded-full inline-block" />
              {renderInline(block.replace('## ', ''))}
            </h2>
          );
        }
        if (block.startsWith('### ')) {
          return (
            <h3
              key={index}
              className="text-lg font-bold text-amber-400 pt-4 pb-1"
            >
              {renderInline(block.replace('### ', ''))}
            </h3>
          );
        }
        if (block.startsWith('#### ')) {
          return (
            <h4
              key={index}
              className="text-base font-semibold text-slate-200 pt-2"
            >
              {renderInline(block.replace('#### ', ''))}
            </h4>
          );
        }

        // Blockquotes
        if (block.startsWith('> ')) {
          const textContent = block.replace(/^>\s*/, '');
          return (
            <blockquote
              key={index}
              className="border-l-4 border-amber-500 bg-amber-500/10 p-4 rounded-r-xl italic text-slate-200 my-4 shadow-inner"
            >
              {renderInline(textContent)}
            </blockquote>
          );
        }

        // Tables
        if (block.includes('|') && block.split('\n').length > 1) {
          const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
          const isTable = lines.some((l) => l.includes('---'));

          if (isTable) {
            const headerLine = lines[0];
            const dataLines = lines.filter((l) => !l.includes('---')).slice(1);

            const parseRow = (rowStr: string) =>
              rowStr
                .split('|')
                .map((cell) => cell.trim())
                .filter((cell, idx, arr) => idx > 0 && idx < arr.length - 1 || (cell !== '' && arr.length > 2));

            const headers = parseRow(headerLine);

            return (
              <div key={index} className="overflow-x-auto my-6 border border-white/[0.1] rounded-xl bg-[#0d0e15] shadow-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/[0.04] border-b border-white/[0.08] text-amber-400 font-mono">
                      {headers.map((h, i) => (
                        <th key={i} className="py-3 px-4 font-semibold tracking-wider">
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {dataLines.map((rowStr, rIdx) => {
                      const cells = parseRow(rowStr);
                      return (
                        <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
                          {cells.map((c, cIdx) => (
                            <td key={cIdx} className="py-3 px-4 text-slate-300">
                              {renderInline(c)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          }
        }

        // Unordered Lists
        if (block.split('\n').every((line) => line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
          const items = block.split('\n').map((l) => l.trim().replace(/^[-*]\s*/, ''));
          return (
            <ul key={index} className="space-y-2 my-4 pl-2">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-2" />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Ordered Lists
        if (block.split('\n').every((line) => /^\d+\.\s*/.test(line.trim()))) {
          const items = block.split('\n').map((l) => l.trim().replace(/^\d+\.\s*/, ''));
          return (
            <ol key={index} className="space-y-2 my-4 pl-2">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-300">
                  <span className="font-mono text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded shrink-0">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        // Code Blocks ```
        if (block.startsWith('```')) {
          const codeText = block.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
          return (
            <div key={index} className="my-4 bg-black/60 border border-white/[0.1] rounded-xl p-4 overflow-x-auto">
              <pre className="font-mono text-xs text-rose-300 leading-relaxed">
                <code>{codeText}</code>
              </pre>
            </div>
          );
        }

        // Standard Paragraph
        return (
          <p key={index} className="leading-relaxed">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}
