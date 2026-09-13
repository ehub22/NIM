import { describe, expect, it } from 'vitest';
import { createSseParser } from '../../src/services/nim/sse';

function collect(chunks: string[], { flush = true } = {}): string[] {
  const received: string[] = [];
  const parser = createSseParser((payload) => received.push(payload));
  for (const chunk of chunks) parser.push(chunk);
  if (flush) parser.flush();
  return received;
}

describe('createSseParser', () => {
  it('emits one payload per complete event', () => {
    expect(collect(['data: one\n\ndata: two\n\n'])).toEqual(['one', 'two']);
  });

  it('buffers events split across chunk boundaries', () => {
    expect(collect(['data: hel', 'lo\n\n'])).toEqual(['hello']);
  });

  it('handles CRLF and bare CR line endings', () => {
    expect(collect(['data: a\r\n\r\ndata: b\r\rdata: c\n\n'])).toEqual(['a', 'b', 'c']);
  });

  it('does not mistake a trailing CR for a complete line', () => {
    // The CRLF is split across two chunks; "ab" must stay a single event.
    expect(collect(['data: ab\r', '\n\r\ndata: cd\n\n'])).toEqual(['ab', 'cd']);
  });

  it('ignores comments and keep-alives', () => {
    expect(collect([': keep-alive\n\n', 'data: real\n\n'])).toEqual(['real']);
  });

  it('joins multi-line data fields with a newline', () => {
    expect(collect(['data: line1\ndata: line2\n\n'])).toEqual(['line1\nline2']);
  });

  it('strips exactly one leading space after the colon', () => {
    expect(collect(['data:  two spaces\n\n'])).toEqual([' two spaces']);
  });

  // Per the SSE spec, an empty data buffer terminates the event without
  // dispatching it, so `data` with no value must not produce a payload.
  it('does not dispatch an event whose data buffer is empty', () => {
    expect(collect(['data\n\n', 'data:\n\n', 'data: real\n\n'])).toEqual(['real']);
  });

  it('ignores event, id and retry fields', () => {
    expect(collect(['event: message\nid: 7\nretry: 100\ndata: payload\n\n'])).toEqual(['payload']);
  });

  it('emits a trailing event without a final blank line on flush', () => {
    expect(collect(['data: partial'])).toEqual(['partial']);
    expect(collect(['data: partial'], { flush: false })).toEqual([]);
  });

  it('survives the [DONE] sentinel as ordinary data', () => {
    expect(collect(['data: [DONE]\n\n'])).toEqual(['[DONE]']);
  });

  it('skips empty data payloads', () => {
    expect(collect(['data: \n\n', 'data: real\n\n'])).toEqual(['real']);
  });
});
