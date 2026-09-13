import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { copyText } from '../../utils/clipboard';
import { IconCheck, IconCopy } from '../ui/Icon';

export interface CodeBlockProps {
  language?: string;
  children: ReactNode;
}

/**
 * Fenced code block with a language label and a copy button.
 *
 * The copy handler reads `textContent` from the rendered element, so it works
 * with the syntax-highlighted markup produced by rehype-highlight.
 */
export function CodeBlock({ language, children }: CodeBlockProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    // `textContent` ends with the newline the renderer emits; the copied code
    // should match what is on screen.
    const text = (preRef.current?.textContent ?? '').replace(/\n+$/, '');
    if (!text) return;
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, []);

  return (
    <div className="not-prose border-code-line bg-code-bg my-4 overflow-hidden rounded-xl border">
      <div className="border-code-line bg-surface-2 flex items-center justify-between gap-3 border-b px-3 py-1.5">
        <span className="text-ink-faint font-mono text-[0.6875rem] tracking-wider uppercase">
          {language || 'text'}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
            copied ? 'text-accent' : 'text-ink-muted hover:bg-surface-3 hover:text-ink',
          )}
          aria-label={copied ? 'Code copied' : 'Copy code to clipboard'}
        >
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre ref={preRef} className="scroll-thin overflow-x-auto p-4 text-[0.8125rem] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}
