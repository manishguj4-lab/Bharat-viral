const test = require('node:test');
const assert = require('node:assert');
const { xmlEscape } = require('./sitemap.js');

test('xmlEscape - normal strings', () => {
  assert.strictEqual(xmlEscape('hello world'), 'hello world');
  assert.strictEqual(xmlEscape('sitemap'), 'sitemap');
});

test('xmlEscape - single special characters', () => {
  assert.strictEqual(xmlEscape('&'), '&amp;');
  assert.strictEqual(xmlEscape('<'), '&lt;');
  assert.strictEqual(xmlEscape('>'), '&gt;');
  assert.strictEqual(xmlEscape('"'), '&quot;');
  assert.strictEqual(xmlEscape("'"), '&apos;');
});

test('xmlEscape - combinations of special characters', () => {
  assert.strictEqual(xmlEscape('<url>&</url>'), '&lt;url&gt;&amp;&lt;/url&gt;');
  assert.strictEqual(xmlEscape('Tom & Jerry "The Movie"'), 'Tom &amp; Jerry &quot;The Movie&quot;');
  assert.strictEqual(xmlEscape("It's a <great> day!"), 'It&apos;s a &lt;great&gt; day!');
});

test('xmlEscape - multiple occurrences of the same special character', () => {
  assert.strictEqual(xmlEscape('&&&'), '&amp;&amp;&amp;');
  assert.strictEqual(xmlEscape('<<<>>>'), '&lt;&lt;&lt;&gt;&gt;&gt;');
});

test('xmlEscape - edge cases like null and undefined', () => {
  assert.strictEqual(xmlEscape(null), '');
  assert.strictEqual(xmlEscape(undefined), '');
});

test('xmlEscape - non-string values', () => {
  assert.strictEqual(xmlEscape(123), '123');
  assert.strictEqual(xmlEscape(true), 'true');
  assert.strictEqual(xmlEscape(false), 'false');
});
