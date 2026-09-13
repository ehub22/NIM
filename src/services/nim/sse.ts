/**
 * Incremental Server-Sent-Events parser.
 *
 * NIM streams `text/event-stream` chunks whose boundaries are unrelated to
 * event boundaries, so this buffers partial lines and only emits complete
 * `data:` payloads. It is deliberately free of DOM/network dependencies so it
 * can be unit tested directly.
 */
export interface SseParser {
  /** Feed a decoded chunk of the stream. */
  push(chunk: string): void;
  /** Emit any buffered trailing event when the stream ends. */
  flush(): void;
}

export function createSseParser(onData: (payload: string) => void): SseParser {
  let buffer = '';
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length === 0) return;
    const payload = dataLines.join('\n');
    dataLines = [];
    if (payload.trim() !== '') onData(payload);
  };

  const handleLine = (line: string) => {
    // An empty line terminates the current event.
    if (line === '') {
      dispatch();
      return;
    }
    // Lines starting with ':' are comments / keep-alives.
    if (line.startsWith(':')) return;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') dataLines.push(value);
    // `event:`, `id:` and `retry:` carry nothing this client needs.
  };

  return {
    push(chunk: string) {
      buffer += chunk;

      // A trailing CR may be the first half of a CRLF split across chunks.
      let text = buffer;
      let carry = '';
      if (text.endsWith('\r')) {
        carry = '\r';
        text = text.slice(0, -1);
      }

      const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = normalized.split('\n');
      buffer = (lines.pop() ?? '') + carry;

      for (const line of lines) handleLine(line);
    },

    flush() {
      if (buffer !== '') {
        const line = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        buffer = '';
        for (const part of line.split('\n')) handleLine(part);
      }
      dispatch();
    },
  };
}
