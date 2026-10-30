const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const popupMarkup = readFileSync(resolve(__dirname, '../src/popup.html'), 'utf8');

test('Popup startup uses only its bundled local script', () => {
  const scriptSources = [...popupMarkup.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(scriptSources, ['popup.js'], `Unexpected popup scripts: ${scriptSources.join(', ')}`);
  assert.doesNotMatch(popupMarkup, /@import\s+url\(/, 'Extension popup styles must not depend on remote resources');
});
