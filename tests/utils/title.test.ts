import { describe, expect, it } from 'vitest';
import { deriveTitle, UNTITLED_CONVERSATION } from '../../src/utils/title';

describe('deriveTitle', () => {
  it('uses the first non-empty line', () => {
    expect(deriveTitle('\n\n  How do streams work? \nmore text')).toBe('How do streams work?');
  });

  it('strips markdown list, heading and quote markers', () => {
    expect(deriveTitle('## Explain NIM')).toBe('Explain NIM');
    expect(deriveTitle('- First item')).toBe('First item');
    expect(deriveTitle('> quoted question')).toBe('quoted question');
    expect(deriveTitle('3. numbered')).toBe('numbered');
  });

  it('removes emphasis characters and collapses whitespace', () => {
    expect(deriveTitle('What  is **this** `code`?')).toBe('What is this code?');
  });

  it('truncates long messages on a word boundary', () => {
    const title = deriveTitle('Explain the difference between streaming and batched inference in detail', 40);
    expect(title.length).toBeLessThanOrEqual(41);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toContain(' …');
  });

  it('keeps short text untouched', () => {
    expect(deriveTitle('Hi')).toBe('Hi');
  });

  it.each(['', '   ', '\n\n', '```'])('falls back to the untitled label for %j', (input) => {
    expect(deriveTitle(input)).toBe(UNTITLED_CONVERSATION);
  });
});
