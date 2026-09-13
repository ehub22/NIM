import { describe, expect, it } from 'vitest';
import { extractLanguage } from '../../src/utils/markdown';

const pre = (classes: unknown) => ({
  type: 'element',
  tagName: 'pre',
  children: [{ type: 'element', tagName: 'code', properties: { className: classes } }],
});

describe('extractLanguage', () => {
  it('reads the language from an array of classes', () => {
    expect(extractLanguage(pre(['language-typescript', 'hljs']))).toBe('typescript');
  });

  it('reads the language from a string of classes', () => {
    expect(extractLanguage(pre('hljs language-python'))).toBe('python');
  });

  it('keeps languages with symbols, such as c++ and c#', () => {
    expect(extractLanguage(pre(['language-c++']))).toBe('c++');
    expect(extractLanguage(pre(['language-c#']))).toBe('c#');
  });

  it.each([
    ['no node', undefined],
    ['no children', { type: 'element', tagName: 'pre' }],
    ['no code element', { type: 'element', tagName: 'pre', children: [] }],
    ['no language class', pre(['hljs'])],
  ])('returns undefined for %s', (_label, node) => {
    expect(extractLanguage(node)).toBeUndefined();
  });
});
