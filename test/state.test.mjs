// Share-link encoding round trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as J from "../js/jewcode.js";
import { encodeProfile, decodeProfile } from "../js/state.js";
import { profileFromBlock, outputTokens } from "../js/parse.js";

test("encode/decode keeps the rendered block identical", () => {
  const p = J.newProfile();
  Object.assign(p, { background: "Bj", denomination: "O", denominationLevel: "+", orthodoxSubtype: "Mo", kashrut: "", heritage: ["As", "Mi"] });
  p.familyContext.denomination = "C";
  p.extendedCategories = [J.Category.Background, J.Category.Heritage];
  Object.assign(J.addition(p, J.Category.Background, 0), { operator: J.Operator.Compound, code: "Bc", scope: "^" });
  J.addition(p, J.Category.Background, 1);
  Object.assign(J.addition(p, J.Category.Heritage, 0), { operator: J.Operator.Group, groupPostfix: "+" });
  p.nuancedCategories = [J.Category.Kashrut];
  J.nuance(p, J.Category.Kashrut).exception = "-";
  J.nuance(p, J.Category.God); // untouched nuance object
  const encoded = encodeProfile(p);
  assert.ok(encoded.length < 600, `link payload is ${encoded.length} chars`);
  const back = decodeProfile(encoded);
  assert.deepEqual(J.profileTokenStrings(back), J.profileTokenStrings(p));
});

test("a decoded block survives the share link with its order and extras", () => {
  const { tokens, profile } = profileFromBlock("Z? Bj [G+&G-&G--]* O+ K+(-) Sh+|Sh- ^O Il*!");
  const back = decodeProfile(encodeProfile(profile));
  assert.deepEqual(outputTokens(back), tokens);
});
