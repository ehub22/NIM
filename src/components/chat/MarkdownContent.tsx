import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { PluggableList } from 'unified';
import { cn } from '../../utils/cn';
import { extractLanguage } from '../../utils/markdown';
import { CodeBlock } from './CodeBlock';

const components: Components = {
  pre({ node, children }) {
    return <CodeBlock language={extractLanguage(node)}>{children}</CodeBlock>;
  },
  a({ children, href }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  th({ children }) {
    return (
      <th className="border-line bg-surface-2 border px-3 py-1.5 text-left font-semibold">{children}</th>
    );
  },
  td({ children }) {
    return <td className="border-line border px-3 py-1.5 align-top">{children}</td>;
  },
};

const remarkPlugins = [remarkGfm];
const rehypePlugins: PluggableList = [[rehypeHighlight, { detect: false, ignoreMissing: true }]];

export interface MarkdownContentProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

/** Renders an assistant reply as markdown with highlighted code blocks. */
export const MarkdownContent = memo(function MarkdownContent({
  content,
  isStreaming = false,
  className,
}: MarkdownContentProps) {
  return (
    <div
      className={cn(
        'markdown-body prose prose-sm sm:prose-base max-w-none break-words',
        isStreaming && 'streaming-caret',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
