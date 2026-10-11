import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {escapeHTML, sourceURL, percentage} from '../lib/render-safety.mjs';

const source = readFileSync(new URL('../entrypoints/content.js', import.meta.url), 'utf8');
const renderer = source.slice(source.indexOf('function renderData('), source.indexOf('\nfunction processPost('));
test('actual result renderer escapes model text and excerpt attributes', () => {
  const container = {};
  const attack = '"><img src=x onerror=alert(1)>&';
  const data = {logical_score:attack, explanation:attack, fallacies:[{name:attack,explanation:attack}],
    claims:[{text:attack,summary:attack,excerpt:attack,verdict:attack,confidence:attack,
      sources:[{url:'javascript:alert(1)'},{url:'https://example.com/?q=" onclick="evil'}]}]};
  vm.runInNewContext(`${renderer}\nrenderData(container, data);`, {
    container, data, escapeHTML, sourceURL, percentage, URL, t: key => key,
    ICONS: new Proxy({}, {get: () => ''})
  });
  assert.doesNotMatch(container.innerHTML, /<img|javascript:|href="[^"]*" onclick=/);
  assert.ok(container.innerHTML.includes(`data-excerpt="${escapeHTML(attack)}"`));
  assert.ok(container.innerHTML.includes('verdict-unverifiable'));
  assert.ok(container.innerHTML.includes('rel="noopener noreferrer"'));
});
test('only absolute web links are allowed', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', '/relative', 'not a url']) assert.equal(sourceURL(url), null);
  assert.equal(sourceURL('https://example.com'), 'https://example.com/');
  assert.equal(percentage(Infinity), 0);
  assert.equal(percentage(101), 100);
});

test('unauthenticated analysis leaves the login panel visible after cleanup', async () => {
  const runAnalysis = source.slice(source.indexOf('  async function runAnalysis()'), source.indexOf('  btn.addEventListener("click", async')).replaceAll('import.meta.env.DEV', 'false');
  let renders = 0;
  let logins = 0;
  const btn = {classList:{add(){},remove(){}}};
  const analysisState = {};
  await vm.runInNewContext(`${runAnalysis}\nrunAnalysis();`, {
    analysisState, btn, activeAnchor:btn, floatingPanel:{},
    buildPanelHTML:()=>()=>renders++, getToken:async()=>null,
    showLoginPanel:async()=>logins++
  });
  assert.equal(logins, 1);
  assert.equal(renders, 1);
  assert.equal(analysisState.loading, false);
});
