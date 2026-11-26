// Round-trip tests for the web-only block → profile parser.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as J from "../js/jewcode.js";
import { parseBlock, profileFromTokens, profileFromBlock, outputTokens, checkTokens } from "../js/parse.js";

const sorted = (a) => [...a].sort();

// Token lines the builder produces (from the ported jewcodegen fixtures): must map fully, no extras.
const builderOutputs = [
  "Bj O+ K+ Sh+ Ho- Pr+ He:Mo+ Tx+ Lg:HeYi Cm+ Cu++ Rl+ G+ Il+ Z?",
  "B# D# E# G#",
  "^O:HaSat @O:Mo O:HaBz>R",
  "@C K- @Sh+",
  "Bj ^O @C R+ As K+ @Sh++ Sh~ @Ho++ Ho+ Cm++ Cu++ Il+",
  "^^O R ^^K++ K-",
  "^O|C>Pd ^@O ^As|Se",
  "Bc:C C As Se",
  "?>Bc",
  ">Bc:As",
  "Bc>Bj",
  "OC+",
  "O/C",
  "O<R>",
  "S>O C",
  "O>O:Mo",
  "O:HaSat",
  "C&O:Mo",
  "As/Se",
  "AsSeMi",
  "K++ Di:VgGf He:MoBi++ Lg:Yi+",
  "~As ~Mi K++>+++ Sh++>- Ho>Ho+ Tx->++(-) Lg:He Cu++! G?(++) Il*! +++Z---",
  "Bj ^As|Mi O|C K+(--) Ho+ Cu++ Il*!",
];

for (const line of builderOutputs) {
  test(`round trip: ${line}`, () => {
    const tokens = line.split(" ");
    const profile = profileFromTokens(tokens);
    assert.deepEqual(profile.extraTokens, [], "nothing should fall through to extras");
    assert.deepEqual(sorted(J.profileTokenStrings(profile)), sorted(tokens));
  });
}

const fromThread = {
  omer: `-----BEGIN JEW CODE BLOCK-----
Version: 1.0

BjBp ^^As S++&^S+++&^^S+++&^^^O
K--- Sh-- Ho-- Pr--- He:MoBi+++
Tx+++ Lg:He+++ Cm* Cu* Rl--- G---

-----END JEW CODE BLOCK-----`,
  peririvka: `-----BEGIN JEW CODE BLOCK-----
Version: 1.0
C+ @C @R @O:Ch Eo>As~
++K-->K~ ++Sh+ Ho+ Pr++
^Sh ^Bj ^G-- ^Rl-- ^^Bc|BjAs|Rl--
He- Lg:He- Lg:Yi--
Tx->Tx+ +Cm++ +Cu++ ++Rl+++
[G+&G-&G--]* Il+ Z++
-----END JEW CODE BLOCK-----`,
};

for (const [who, block] of Object.entries(fromThread)) {
  test(`real block from the thread survives a round trip: ${who}`, () => {
    const { version, tokens } = parseBlock(block);
    assert.equal(version, "1.0");
    const profile = profileFromTokens(tokens);
    assert.deepEqual(sorted(J.profileTokenStrings(profile)), sorted(tokens));
  });
}

test("omer's block maps the standard parts to answers", () => {
  const p = profileFromTokens(parseBlock(fromThread.omer).tokens);
  assert.equal(p.kashrut, "---");
  assert.equal(p.hebrew, "He:MoBi");
  assert.deepEqual(p.languages, ["He"]);
  assert.deepEqual(p.heritage, ["As"]);
  assert.equal(p.heritageScope, "^^");
  assert.deepEqual(p.extraTokens, ["BjBp", "S++&^S+++&^^S+++&^^^O"]);
});

for (const [who, block] of Object.entries(fromThread)) {
  test(`decoded block re-renders in its original order: ${who}`, () => {
    const { tokens, profile } = profileFromBlock(block);
    assert.deepEqual(outputTokens(profile), tokens);
  });
}

test("an edit keeps the original order and places new tokens near their category", () => {
  const { profile } = profileFromBlock("Z? Bj O+ K+ Il+");
  profile.kashrut = "++";
  profile.shabbat = "+";
  assert.deepEqual(outputTokens(profile), ["Z?", "Bj", "O+", "K++", "Sh+", "Il+"]);
});

test("checkTokens flags invalid tokens and short blocks", () => {
  assert.equal(checkTokens(["Bj", "O+", "K+"]).errors.length, 0);
  assert.equal(checkTokens(["S++&^S+++&^^S+++&^^^O", "BjBp", "[G+&G-&G--]*"]).errors.length, 0);
  const bad = checkTokens(["O+C", "K"]);
  assert.equal(bad.perToken[0] !== null, true);
  assert.equal(bad.errors.length, 2);
});
