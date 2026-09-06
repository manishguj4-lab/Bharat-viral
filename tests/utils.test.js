import assert from 'node:assert';
import test from 'node:test';
import { toKeywordList } from '../netlify/edge-functions/utils.ts';

test('toKeywordList edge cases', async (t) => {
  await t.test('handles empty and undefined inputs', () => {
    assert.deepStrictEqual(toKeywordList(), []);
    assert.deepStrictEqual(toKeywordList(undefined, null, '', '   '), []);
  });

  await t.test('handles string inputs separated by commas or pipes', () => {
    assert.deepStrictEqual(
      toKeywordList('apple, banana, cherry'),
      ['apple', 'banana', 'cherry']
    );
    assert.deepStrictEqual(
      toKeywordList('dog | cat | mouse'),
      ['dog', 'cat', 'mouse']
    );
    assert.deepStrictEqual(
      toKeywordList('one, two | three,four|five'),
      ['one', 'two', 'three', 'four', 'five']
    );
  });

  await t.test('handles array inputs', () => {
    assert.deepStrictEqual(
      toKeywordList(['apple', 'banana'], ['cherry']),
      ['apple', 'banana', 'cherry']
    );
    assert.deepStrictEqual(
      toKeywordList(['apple', undefined, null, '', 'banana']),
      ['apple', 'banana']
    );
  });

  await t.test('removes duplicates', () => {
    assert.deepStrictEqual(
      toKeywordList('apple, apple', 'banana', ['banana', 'cherry', 'apple']),
      ['apple', 'banana', 'cherry']
    );
  });

  await t.test('trims spaces', () => {
    assert.deepStrictEqual(
      toKeywordList('  apple  , banana ', ['  cherry  ']),
      ['apple', 'banana', 'cherry']
    );
  });

  await t.test('enforces the 30-element limit', () => {
    const input1 = Array.from({ length: 20 }, (_, i) => `item${i}`);
    const input2 = Array.from({ length: 20 }, (_, i) => `item${i + 20}`);
    const result = toKeywordList(input1, input2);

    assert.strictEqual(result.length, 30);
    assert.strictEqual(result[0], 'item0');
    assert.strictEqual(result[29], 'item29');
    assert.strictEqual(result[30], undefined);
  });
});
