/** Minimal SSE client for tests: opens a stream with fetch and collects parsed events. */
export type SseEvent = { event: string; data: unknown };

export async function openStream(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const res = await fetch(url, { headers, signal: controller.signal });
  const events: SseEvent[] = [];
  const comments: string[] = [];
  const done = (async () => {
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += value;
        let end: number;
        while ((end = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (block.startsWith(":")) comments.push(block);
          const event = /^event: (.*)$/m.exec(block)?.[1];
          const data = /^data: (.*)$/m.exec(block)?.[1];
          if (event) events.push({ event, data: data ? JSON.parse(data) : null });
        }
      }
    } catch {
      // aborted
    }
  })();
  return {
    res,
    events,
    comments,
    close: async () => {
      controller.abort();
      await done;
    },
  };
}
