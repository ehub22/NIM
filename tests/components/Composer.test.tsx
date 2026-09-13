import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from '../../src/components/chat/Composer';

function setup(overrides: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const props = {
    onSend: vi.fn(),
    onStop: vi.fn(),
    isStreaming: false,
    ...overrides,
  };
  render(<Composer {...props} />);
  return props;
}

describe('Composer', () => {
  it('sends on Enter and clears the draft', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Hello NIM');
    await user.keyboard('{Enter}');

    expect(props.onSend).toHaveBeenCalledWith('Hello NIM');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
  });

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const user = userEvent.setup();
    const props = setup();
    const textarea = screen.getByRole('textbox', { name: 'Message' });

    await user.type(textarea, 'line one');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, 'line two');

    expect(textarea).toHaveValue('line one\nline two');
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('does not send whitespace-only input', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.type(screen.getByRole('textbox', { name: 'Message' }), '   ');
    await user.keyboard('{Enter}');

    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('sends when the button is clicked', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'click me');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(props.onSend).toHaveBeenCalledWith('click me');
  });

  it('keeps the send button disabled while the input is empty', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('swaps send for stop while a response is streaming', async () => {
    const user = userEvent.setup();
    const props = setup({ isStreaming: true });

    expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop generating' }));

    expect(props.onStop).toHaveBeenCalledTimes(1);
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('disables input and explains why when there is no conversation', () => {
    setup({ disabled: true, disabledReason: 'Create a conversation to start chatting' });
    const textarea = screen.getByRole('textbox', { name: /Message input disabled/ });
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute('placeholder', 'Create a conversation to start chatting');
  });

  it('documents the keyboard shortcuts', () => {
    setup();
    expect(screen.getByText(/to send/i)).toBeInTheDocument();
    expect(screen.getByText(/for a new line/i)).toBeInTheDocument();
  });
});
