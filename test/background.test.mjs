import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../entrypoints/background.js', import.meta.url), 'utf8').replace('export default ', '');
function setup(storageError) {
  let listener;
  const logs = [];
  const runtime = {onMessage:{addListener(){}},onMessageExternal:{addListener(fn){listener=fn;}}};
  const chrome = {runtime, storage:{local:{set(value, callback){runtime.lastError=storageError;callback();}}}};
  vm.runInNewContext(source, {chrome,defineBackground:fn=>fn(),console:{log:(...args)=>logs.push(args)}});
  return {listener,logs};
}
test('bridge rejects malformed sessions and reports storage failure', () => {
  const {listener} = setup({message:'storage full'});
  let response;
  listener(null, {}, value=>response=value);
  assert.equal(response.success,false);
  listener({type:'VERITY_AUTH_TOKEN',session:{}}, {}, value=>response=value);
  assert.equal(response.success,false);
  listener({type:'VERITY_AUTH_TOKEN',session:{access_token:'secret',refresh_token:'refresh'}}, {}, value=>response=value);
  assert.equal(response.success,false);
});
test('bridge acknowledges persisted session without logging tokens', () => {
  const {listener,logs} = setup();
  let response;
  assert.equal(listener({type:'VERITY_AUTH_TOKEN',session:{access_token:'secret',refresh_token:'refresh'}}, {}, value=>response=value),true);
  assert.equal(response.success,true);
  assert.doesNotMatch(JSON.stringify(logs), /secret|refresh/);
});
