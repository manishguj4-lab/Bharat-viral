import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { toKeywordList } from "./seo.ts";

Deno.test("toKeywordList handles empty and undefined inputs", () => {
  assertEquals(toKeywordList(), []);
  assertEquals(toKeywordList(undefined, null, "", "   "), []);
});

Deno.test("toKeywordList handles string inputs separated by commas or pipes", () => {
  assertEquals(toKeywordList("apple, banana, cherry"), ["apple", "banana", "cherry"]);
  assertEquals(toKeywordList("dog | cat | mouse"), ["dog", "cat", "mouse"]);
  assertEquals(toKeywordList("one, two | three,four|five"), ["one", "two", "three", "four", "five"]);
});

Deno.test("toKeywordList handles array inputs", () => {
  assertEquals(toKeywordList(["apple", "banana"], ["cherry"]), ["apple", "banana", "cherry"]);
  assertEquals(toKeywordList(["apple", undefined, null, "", "banana"]), ["apple", "banana"]);
});

Deno.test("toKeywordList removes duplicates", () => {
  assertEquals(
    toKeywordList("apple, apple", "banana", ["banana", "cherry", "apple"]),
    ["apple", "banana", "cherry"]
  );
});

Deno.test("toKeywordList trims spaces", () => {
  assertEquals(toKeywordList("  apple  , banana ", ["  cherry  "]), ["apple", "banana", "cherry"]);
});

Deno.test("toKeywordList enforces the 30-element limit", () => {
  const input1 = Array.from({ length: 20 }, (_, i) => `item${i}`);
  const input2 = Array.from({ length: 20 }, (_, i) => `item${i + 20}`);
  const result = toKeywordList(input1, input2);

  assertEquals(result.length, 30);
  assertEquals(result[0], "item0");
  assertEquals(result[29], "item29");
  assertEquals(result[30], undefined);
});
