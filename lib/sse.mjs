// Read exactly one analysis result, releasing the connection on terminal events.
export async function consumeSSE(response, onPhase = () => {}) {
  if (!response.body) throw new Error('Analysis response has no body.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, {stream:true});
      // Normalize CRLF after buffering so chunk boundaries may split CR and LF.
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let event = 'message';
        const lines = [];
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) lines.push(line.slice(5).trimStart());
        }
        if (!['phase', 'result', 'error'].includes(event) || !lines.length) continue;
        const data = JSON.parse(lines.join('\n'));
        if (event === 'phase') onPhase(data.key);
        if (event === 'result') return data;
        if (event === 'error') throw new Error(data.error || 'Analysis failed.');
      }
      if (done) throw new Error('Stream ended without a result event.');
    }
  } finally {
    try { await reader.cancel(); } catch { /* Preserve the original failure. */ }
    reader.releaseLock();
  }
}
