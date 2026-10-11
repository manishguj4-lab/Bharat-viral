import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Production Fixes Regression Tests', () => {
  it('index.html contains enhanced category matching and i18n attributes', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), '../index.html'), 'utf-8');
    assert.ok(html.includes('data-i18n-cat-name'), 'index.html should include data-i18n-cat-name attributes');
    assert.ok(html.includes('data-i18n-cat'), 'index.html should include data-i18n-cat attributes');
    assert.ok(html.includes('limit=100'), 'index.html article fetch limit should be 100');
  });

  it('ui-controls.js supports Hindi and English category translation', () => {
    const js = fs.readFileSync(path.resolve(process.cwd(), '../assets/js/ui-controls.js'), 'utf-8');
    assert.ok(js.includes('data-i18n-cat-name'), 'ui-controls.js should handle data-i18n-cat-name');
    assert.ok(js.includes('bv:languageChanged'), 'ui-controls.js should dispatch bv:languageChanged event');
    assert.ok(js.includes('fact-check'), 'ui-controls.js should map category slugs');
  });

  it('global.css includes responsive resets and table overflow wrappers', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), '../assets/css/global.css'), 'utf-8');
    assert.ok(css.includes('box-sizing: border-box'), 'global.css should set box-sizing');
    assert.ok(css.includes('.table-responsive'), 'global.css should include .table-responsive styling');
    assert.ok(css.includes('overflow-x: hidden'), 'global.css should prevent horizontal scroll');
  });
});
