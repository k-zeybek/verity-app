import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeSSE} from '../lib/sse.mjs';
function response(text, close = true) {
  let cancelled = false;
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream({
    start(controller) {
      // Exercise all byte boundaries, including UTF-8 and CRLF splits.
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      if (close) controller.close();
    }, cancel() {cancelled = true;}
  });
  return {response:new Response(stream), cancelled:()=>cancelled};
}
test('stream handles split UTF-8, CRLF, phases and cancels after result', async () => {
  const input = response('event: phase\r\ndata: {"key":"searching"}\r\n\r\nevent: result\r\ndata: {"text":"über"}\r\n\r\n', false);
  const phases = [];
  assert.deepEqual(await consumeSSE(input.response, phase=>phases.push(phase)), {text:'über'});
  assert.deepEqual(phases, ['searching']);
  assert.equal(input.cancelled(), true);
  assert.equal(input.response.body.locked, false);
});
test('stream errors and malformed terminal events reject and release reader', async () => {
  for (const text of ['event: error\ndata: {"error":"Unavailable"}\n\n', 'event: result\ndata: invalid\n\n', ':heartbeat\n\n']) {
    const input = response(text);
    await assert.rejects(consumeSSE(input.response));
    assert.equal(input.response.body.locked, false);
  }
});
