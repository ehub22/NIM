import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownContent } from '../../src/components/chat/MarkdownContent';

describe('MarkdownContent', () => {
  it('renders headings, lists and emphasis as markdown', () => {
    render(<MarkdownContent content={'# Title\n\n- one\n- two\n\nSome **bold** text.'} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('renders GitHub-flavoured tables', () => {
    render(<MarkdownContent content={'| a | b |\n| --- | --- |\n| 1 | 2 |'} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toContain('2');
  });

  it('labels fenced code blocks with their language', () => {
    render(<MarkdownContent content={'```ts\nconst x = 1;\n```'} />);
    expect(screen.getByText('ts')).toBeInTheDocument();
  });

  it('falls back to a "text" label when no language is given', () => {
    render(<MarkdownContent content={'```\nplain\n```'} />);
    expect(screen.getByText('text')).toBeInTheDocument();
  });

  it('copies the raw code without the renderer trailing newline', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    render(<MarkdownContent content={'```python\nprint("hi")\n```'} />);
    await user.click(screen.getByRole('button', { name: /copy code to clipboard/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith('print("hi")');
    expect(await screen.findByRole('button', { name: /code copied/i })).toBeInTheDocument();
  });

  it('opens external links in a new tab with noopener', () => {
    render(<MarkdownContent content={'[NVIDIA](https://build.nvidia.com)'} />);
    const link = screen.getByRole('link', { name: 'NVIDIA' });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('marks the container as streaming for the caret', () => {
    const { container } = render(<MarkdownContent content="partial" isStreaming />);
    expect(container.firstChild).toHaveClass('streaming-caret');
  });

  it('does not let inline code blocks pick up the fenced-block chrome', () => {
    render(<MarkdownContent content={'Use `npm run dev` here.'} />);
    expect(screen.queryByRole('button', { name: /copy code/i })).not.toBeInTheDocument();
    expect(screen.getByText('npm run dev').tagName).toBe('CODE');
  });
});
