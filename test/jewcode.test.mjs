// Port of pkg/jcg/jewcode/{profile,addition}_test.go from omer's jewcodegen. Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import * as J from "../js/jewcode.js";

const { Category: C, Level: L, Operator: Op, Combination: Cb, Scope: S, Conversion } = J;

const P = (fields = {}) => {
  const p = J.newProfile();
  for (const [k, v] of Object.entries(fields)) {
    if (k === "familyContext" || k === "communityContext") p[k] = { ...J.newContext(), ...v };
    else p[k] = v;
  }
  return p;
};
const strings = (p) => J.profileTokens(p).map(J.tokenString);
const fields = (s) => s.trim().split(/\s+/);
const extend = (p, category, ...additions) => {
  p.extendedCategories.push(category);
  additions.forEach((a, i) => Object.assign(J.addition(p, category, i), J.newAddition(a)));
  return p;
};
const assertAllValid = (p) => {
  for (const t of J.profileTokens(p)) assert.doesNotThrow(() => J.validateToken(t), J.tokenString(t));
};

test("renders the basic example", () => {
  const p = P({
    background: "Bj", denomination: "O", denominationLevel: L.Positive, kashrut: L.Positive, shabbat: L.Positive,
    holidays: L.Negative, prayer: L.Positive, hebrew: "He:Mo", hebrewLevel: L.Positive, textual: L.Positive,
    languages: ["He", "Yi"], community: L.Positive, cultural: L.VeryPositive, religious: L.Positive,
    god: L.Positive, israel: L.Positive, zionism: L.Uncertain,
  });
  const tokens = J.profileTokens(p);
  assert.doesNotThrow(() => J.validateBlock(tokens));
  assert.ok(J.renderBlock(tokens).includes("Bj O+ K+ Sh+ Ho- Pr+ He:Mo+ Tx+ Lg:HeYi Cm+ Cu++ Rl+ G+ Il+ Z?"));
});

test("decline to state", () => {
  const p = P({ background: "B#", denomination: "D#", secondaryDenomination: "C", previousDenomination: "O",
    heritage: ["As", "E#"], heritageCombination: Cb.Compound, god: L.Decline });
  assert.deepEqual(strings(p), ["B#", "D#", "E#", "G#"]);
});

test("retains Orthodox subtypes in context and transitions", () => {
  const p = P({ familyContext: { denomination: "O", orthodoxSubtype: "HaSat" }, communityContext: { denomination: "O", orthodoxSubtype: "Mo" },
    denomination: "R", previousDenomination: "O", previousOrthodoxSubtype: "HaBz" });
  assert.deepEqual(strings(p), ["^O:HaSat", "@O:Mo", "O:HaBz>R"]);
});

test("omits skipped context but keeps other context", () => {
  const p = P({ familyContext: { skipped: true, denomination: "O", kashrut: L.VeryPositive },
    communityContext: { denomination: "C", shabbat: L.Positive }, kashrut: L.Negative });
  assert.deepEqual(strings(p), ["@C", "K-", "@Sh+"]);
});

const dep0249 = [
  ["family-community-personal divergence (12.6)", {
    background: "Bj", familyContext: { denomination: "O" },
    communityContext: { denomination: "C", shabbat: L.VeryPositive, holidays: L.VeryPositive },
    denomination: "R", denominationLevel: L.Positive, heritage: ["As"], kashrut: L.Positive, shabbat: L.Approximate,
    holidays: L.Positive, community: L.VeryPositive, cultural: L.VeryPositive, israel: L.Positive,
  }, "Bj ^O @C R+ As K+ @Sh++ Sh~ @Ho++ Ho+ Cm++ Cu++ Il+"],
  ["family practice context and extended family (6.4, 8.1)", {
    familyContext: { scope: S.ExtendedFamily, denomination: "O", kashrut: L.VeryPositive }, denomination: "R", kashrut: L.Negative,
  }, "^^O R ^^K++ K-"],
  ["family sides and family journey (8.2, 8.3)", {
    familyContext: { denomination: "O", alternative: "C", transition: "Pd" },
    communityContext: { scope: S.FamilyCommunity, denomination: "O" },
    heritage: ["As", "Se"], heritageScope: S.Family, heritageCombination: Cb.Contextual,
  }, "^O|C>Pd ^@O ^As|Se"],
  ["convert through a movement (12.7)", { background: "Bc", conversionPath: "C", denomination: "C", heritage: ["As", "Se"] }, "Bc:C C As Se"],
  ["considering conversion", { background: "Bc", conversion: Conversion.Considering }, "?>Bc"],
  ["conversion in process following a tradition", { background: "Bc", conversion: Conversion.InProgress, conversionPath: "As" }, ">Bc:As"],
  ["compound denomination (3.1)", { denomination: "O", secondaryDenomination: "C", denominationCombination: Cb.Compound, denominationLevel: L.Positive }, "OC+"],
  ["blend denominations (6.1)", { denomination: "O", secondaryDenomination: "C", denominationCombination: Cb.Blend }, "O/C"],
  ["additive", { denomination: "O", secondaryDenomination: "R", denominationCombination: Cb.Additive }, "O<R>"],
  ["separate denominations", { denomination: "O", secondaryDenomination: "C", previousDenomination: "S" }, "S>O C"],
  ["denomination journey to Modern Orthodox (12.1)", { denomination: "O", orthodoxSubtype: "Mo", previousDenomination: "O" }, "O>O:Mo"],
  ["Hasidic dynasty (DEP-0248 6.2)", { denomination: "O", orthodoxSubtype: "Ha", hasidicDynasty: "Sat" }, "O:HaSat"],
  ["compound with sub-specifier uses explicit conjunction", { denomination: "C", secondaryDenomination: "O", orthodoxSubtype: "Mo", denominationCombination: Cb.Compound }, "C&O:Mo"],
  ["heritage blend", { heritage: ["As", "Se"], heritageCombination: Cb.Blend }, "As/Se"],
  ["heritage compound", { heritage: ["As", "Se", "Mi"], heritageCombination: Cb.Compound }, "AsSeMi"],
  ["compound sub-specifiers (4.3, 4.4)", {
    kashrut: L.VeryPositive, dietary: ["Di:Vg", "Di:Gf"], hebrew: "He:MoBi", hebrewLevel: L.VeryPositive, languages: ["Yi"], languageLevel: L.Positive,
  }, "K++ Di:VgGf He:MoBi++ Lg:Yi+"],
];
for (const [name, f, want] of dep0249) {
  test(`DEP-0249: ${name}`, () => {
    const p = P(f);
    assert.deepEqual(strings(p), fields(want));
    assertAllValid(p);
  });
}

test("applies nuances", () => {
  const p = P({
    kashrut: L.ExtremelyPositive, shabbat: L.Negative, holidays: L.Positive, textual: L.VeryPositive, cultural: L.VeryPositive,
    god: L.Uncertain, israel: L.Complex, zionism: L.ExtremelyNegative, heritage: ["As", "Mi"], languages: ["He"],
    nuancedCategories: [C.Kashrut, C.Shabbat, C.Holiday, C.Textual, C.Cultural, C.God, C.Israel, C.Zionism, C.Heritage],
  });
  J.nuance(p, C.Kashrut).previous = L.VeryPositive;
  J.nuance(p, C.Shabbat).previous = L.VeryPositive;
  J.nuance(p, C.Holiday).previous = L.Baseline;
  J.nuance(p, C.Textual).previous = L.Negative;
  J.nuance(p, C.Textual).exception = L.Negative;
  J.nuance(p, C.Cultural).intensity = 1;
  J.nuance(p, C.God).exception = L.VeryPositive;
  J.nuance(p, C.Israel).intensity = 1;
  J.nuance(p, C.Zionism).salience = L.ExtremelyPositive;
  J.nuance(p, C.Heritage).salience = L.Approximate;
  J.nuance(p, C.Language).salience = L.VeryPositive; // not selected for fine-tuning: ignored
  assert.deepEqual(strings(p), fields("~As ~Mi K++>+++ Sh++>- Ho>Ho+ Tx->++(-) Lg:He Cu++! G?(++) Il*! +++Z---"));
  assertAllValid(p);
  assert.deepEqual(J.answeredCategories(p), [C.Heritage, C.Kashrut, C.Shabbat, C.Holiday, C.Textual, C.Language, C.Cultural, C.God, C.Israel, C.Zionism]);
});

const validateCases = [
  ["known code", { expr: "O" }],
  ["chained sub-specifier", { expr: "O:Ha:Sat" }],
  ["juxtaposed sub-specifier", { expr: "O:HaSat" }],
  ["considering conversion", { expr: "?>Bc" }],
  ["modifier-only transition operand", { expr: "K++>", postfix: "+++" }],
  ["modifier-only left transition operand", { expr: "++>K+++" }],
  ["grouped leading modifier", { scope: "^", expr: "[~O]|C>Pd" }],
  ["grouped modified alternatives", { expr: "[As|Mi]", postfix: "+" }],
  ["separately modified grouped alternatives", { expr: "[As+]|[Mi-]" }],
  ["nested group around transition", { expr: "[[As|Mi]+>Pd]", postfix: "~" }],
  ["intensity after uncertain group", { expr: "[?K]", postfix: "!" }],
  ["modifier-only condition", { expr: "K", postfix: "+", condition: "-" }],
  ["family community scope", { scope: "^@", expr: "O" }],
  ["additive", { expr: "O<R>" }],
  ["inner family scope", { expr: "Bj^Bc" }],
  ["inner scope after operator", { expr: "O|^C" }],
  ["inner scope before modifier", { expr: "As|@~Se" }],
  ["inner scope too long", { expr: "Bj^^^^Bc" }, true],
  ["dangling inner scope", { expr: "Bj^" }, true],
  ["inner scope before sub-specifier", { expr: "Bj^:Mo" }, true],
  ["modifier before inner scope", { expr: "O+^C" }, true],
  ["unknown code", { expr: "Unknown" }, true],
  ["internal modifier", { expr: "O+C" }, true],
  ["internal approximate modifier", { expr: "As~Se" }, true],
  ["modifier repeated four times", { expr: "K++++" }, true],
  ["group cannot be juxtaposed with compound", { expr: "K++[K]--" }, true],
  ["code cannot be juxtaposed after a group", { expr: "[K]K" }, true],
  ["empty group", { expr: "[]" }, true],
  ["unclosed group", { expr: "[O" }, true],
  ["unmatched closing group", { expr: "O]" }, true],
  ["invalid condition", { expr: "K", condition: "++++" }, true],
  ["invalid scope", { scope: "@^", expr: "O" }, true],
  ["whitespace", { expr: "O C" }, true],
  ["non-ASCII", { expr: "Ö" }, true],
];
for (const [name, t, wantErr] of validateCases) {
  test(`validateToken: ${name}`, () => {
    const fn = () => J.validateToken(J.newToken(t));
    if (wantErr) assert.throws(fn);
    else assert.doesNotThrow(fn);
  });
}

test("block validation and modifier rendering", () => {
  assert.throws(() => J.validateBlock([J.newToken({ expr: "Bj" }), J.newToken({ expr: "O" })]));
  const large = ["Bj", "O", "K", "As".repeat(257)].map((expr) => J.newToken({ expr }));
  assert.doesNotThrow(() => J.validateBlock(large));
  assert.ok(J.blockWarnings(large).length > 0);
  assert.equal(J.levelSymbol(L.VeryPositive), "++");
  assert.equal(J.levelSymbol(L.Baseline), "");
  assert.equal(J.intensitySymbol(2), "!!");
  assert.equal(J.intensitySymbol(0), "");
});

/* ---- addition_test.go ---- */

test("multi-heritage contextual", () => {
  const p = P({
    background: "Bj", heritage: ["As", "Mi"], heritageCombination: Cb.Contextual, heritageScope: S.Family,
    denomination: "O", secondaryDenomination: "C", denominationCombination: Cb.Contextual,
    kashrut: L.Positive, shabbat: L.Positive, holidays: L.Positive, cultural: L.VeryPositive, israel: L.Complex,
    nuancedCategories: [C.Kashrut, C.Israel],
  });
  J.nuance(p, C.Kashrut).exception = L.VeryNegative;
  J.nuance(p, C.Israel).intensity = 1;
  extend(p, C.Shabbat, { operator: Op.Contextual, level: L.Negative });
  const tokens = J.profileTokens(p);
  assert.doesNotThrow(() => J.validateBlock(tokens));
  assert.ok(J.renderBlock(tokens).includes("\nBj ^As|Mi O|C K+(--) Sh+|Sh- Ho+ Cu++ Il*!\n"));
});

const additionCases = [
  ["born Jewish, parents were converts", () => extend(P({ background: "Bj" }), C.Background, { operator: Op.Compound, scope: S.Family, code: "Bc" }), "Bj^Bc"],
  ["compound across categories with salience", () => {
    const p = extend(P({ shabbat: L.Baseline, nuancedCategories: [C.Shabbat] }), C.Shabbat, { operator: Op.Compound, code: "Ho" });
    J.nuance(p, C.Shabbat).salience = L.Approximate;
    return p;
  }, "~ShHo"],
  ["blend of levels", () => extend(P({ kashrut: L.Positive }), C.Kashrut, { operator: Op.Blend, level: L.Negative }), "K+/K-"],
  ["compound after a modifier falls back to explicit conjunction", () => extend(P({ kashrut: L.Positive }), C.Kashrut, { operator: Op.Compound, code: "Sh", level: L.Negative }), "K+&Sh-"],
  ["compound after a sub-specifier falls back to explicit conjunction", () => extend(P({ denomination: "O", orthodoxSubtype: "Mo" }), C.Denomination, { operator: Op.Compound, code: "C" }), "O:Mo&C"],
  ["additive", () => extend(P({ denomination: "O" }), C.Denomination, { operator: Op.Additive, code: "R" }), "O<R>"],
  ["transition", () => extend(P({ denomination: "O" }), C.Denomination, { operator: Op.Transition, code: "R", level: L.Positive }), "O>R+"],
  ["sub-specification keeps the level", () => extend(P({ denomination: "O", denominationLevel: L.Positive }), C.Denomination,
    { operator: Op.SubSpecify, subSpecifier: "Ha" }, { operator: Op.SubSpecify, subSpecifier: "Sat" }), "O:Ha:Sat+"],
  ["separate scoped token, extended further", () => extend(P({ shabbat: L.Approximate }), C.Shabbat,
    { operator: Op.Separate, scope: S.Community, level: L.VeryPositive },
    { operator: Op.Contextual, scope: S.BroaderCommunity, level: L.Positive }), "Sh~ @Sh++|@@Sh+"],
  ["chained operators with an inner scope", () => extend(P({ denomination: "O" }), C.Denomination,
    { operator: Op.Contextual, scope: S.Family, code: "C" }, { operator: Op.Transition, code: "Pd" },
    { operator: Op.And, code: "Rn", level: L.Uncertain }), "O|^C>Pd&Rn?"],
  ["chain stops at the first empty slot", () => {
    const p = extend(P({ israel: L.Positive }), C.Israel, { operator: Op.Blend, level: L.Negative });
    Object.assign(J.addition(p, C.Israel, 2), J.newAddition({ operator: Op.Compound, code: "Z" }));
    return p;
  }, "Il+/Il-"],
  ["additions apply to the last token of a separate combination", () => extend(P({ heritage: ["As", "Se"] }), C.Heritage, { operator: Op.Contextual, code: "Mi" }), "As Se|Mi"],
  ["decline to state is never extended", () => extend(P({ background: "B#" }), C.Background, { operator: Op.Compound, scope: S.Family, code: "Bc" }), "B#"],
  ["intensity applies after the additions", () => {
    const p = extend(P({ israel: L.Complex, nuancedCategories: [C.Israel] }), C.Israel, { operator: Op.Compound, code: "Z", level: L.Negative });
    J.nuance(p, C.Israel).intensity = 1;
    return p;
  }, "Il*&Z-!"],
];
for (const [name, mk, want] of additionCases) {
  test(`additions: ${name}`, () => {
    const p = mk();
    assert.deepEqual(strings(p), fields(want));
    assertAllValid(p);
  });
}

test("additions require an extended category", () => {
  const p = P({ background: "Bj", kashrut: L.Positive });
  Object.assign(J.addition(p, C.Background, 0), J.newAddition({ operator: Op.Compound, scope: S.Family, code: "Bc" }));
  assert.deepEqual(strings(p), ["Bj", "K+"]);
  assert.equal(J.canExtend(p, C.Background), true);
  assert.equal(J.canExtend(p, C.Shabbat), false);
  assert.equal(J.canExtend(P({ denomination: "D#" }), C.Denomination), false);
});

test("unbounded addition chains", () => {
  const p = P({ kashrut: L.Positive, extendedCategories: [C.Kashrut] });
  for (let i = 0; i < 5; i++) {
    Object.assign(J.addition(p, C.Kashrut, i), J.newAddition({ operator: Op.Contextual, level: i % 2 === 1 ? L.Positive : L.Negative }));
  }
  assert.deepEqual(strings(p), ["K+|K-|K+|K-|K+|K-"]);
  assertAllValid(p);
});

const groupCases = [
  ["grouped leading modifier and trailing alternatives", () => extend(P({ denomination: "O" }), C.Denomination,
    { operator: Op.Group, scope: S.Family, groupPrefix: L.Approximate }, { operator: Op.Contextual, code: "C" },
    { operator: Op.Transition, code: "Pd" }), "^[~O]|C>Pd"],
  ["separately modified alternatives", () => extend(P({ heritage: ["As"] }), C.Heritage,
    { operator: Op.Group, groupPostfix: L.Positive }, { operator: Op.Contextual, code: "Mi", level: L.Negative },
    { operator: Op.Group, groupStart: 1, groupPostfix: L.Negative }), "[As+]|[Mi-]"],
  ["group intensity applies to uncertainty", () => extend(P({ kashrut: L.Baseline }), C.Kashrut,
    { operator: Op.Group, groupPrefix: L.Uncertain, intensity: 1 }), "[?K]!"],
  ["group whole alternative before transition", () => extend(P({ heritage: ["As"] }), C.Heritage,
    { operator: Op.Contextual, code: "Mi" }, { operator: Op.Group, level: L.Positive }, { operator: Op.Transition, code: "Pd" }), "[As|Mi]+>Pd"],
  ["nested group around transition", () => extend(P({ heritage: ["As"] }), C.Heritage,
    { operator: Op.Contextual, code: "Mi" }, { operator: Op.Group, level: L.Positive }, { operator: Op.Transition, code: "Pd" },
    { operator: Op.Group, level: L.Approximate }), "[[As|Mi]+>Pd]~"],
  ["scoped compound is made explicit when grouped", () => extend(P({ background: "Bj" }), C.Background,
    { operator: Op.Compound, scope: S.Family, code: "Bc" }, { operator: Op.Group, groupStart: 1 }), "Bj&^[Bc]"],
  ["group followed by compound uses explicit conjunction", () => extend(P({ heritage: ["As"] }), C.Heritage,
    { operator: Op.Group }, { operator: Op.Compound, code: "Ho" }), "[As]&Ho"],
];
for (const [name, mk, want] of groupCases) {
  test(`groups: ${name}`, () => {
    const p = mk();
    assert.deepEqual(strings(p), [want]);
    assertAllValid(p);
  });
}

test("group options preview trailing terms", () => {
  const p = extend(P({ denomination: "O" }), C.Denomination, { operator: Op.Contextual, code: "C" });
  assert.deepEqual(J.groupOptions(p, C.Denomination, 1), [{ start: 0, preview: "[O|C]" }, { start: 1, preview: "O|[C]" }]);
});

test("addition codes list own category first", () => {
  const list = J.additionCodes(C.Shabbat);
  assert.equal(list[0].value, "Sh");
  for (const c of list) assert.equal(J.isDisclosureCode(c.value), false, c.value);
  assert.equal(J.operatorSymbol(Op.Transition), ">");
  assert.equal(J.operatorSymbol(Op.Compound), "");
});

test("arguments on an additional language code", () => {
  const p = extend(P({ languages: ["He"], languageLevel: L.ExtremelyPositive }), C.Language,
    { operator: Op.And, code: "Lg", arguments: ["Yi"], level: L.Approximate });
  assert.deepEqual(strings(p), ["Lg:He+++&Lg:Yi~"]);
});

test("arguments on an additional same code", () => {
  const p = extend(P({ languages: ["He"], languageLevel: L.Positive }), C.Language,
    { operator: Op.And, arguments: ["Yi"], level: L.Approximate });
  assert.deepEqual(strings(p), ["Lg:He+&Lg:Yi~"]);
});

test("addition codes use argument-bearing category bases", () => {
  for (const category of [C.Dietary, C.Hebrew]) {
    const list = J.additionCodes(category);
    assert.ok(list.length > 0);
    assert.equal(list[0].category, category);
    for (const c of list) assert.ok(!c.value.includes(":"));
  }
});

test("canSubSpecify tracks the current expression", () => {
  const p = extend(P({ denomination: "O" }), C.Denomination, { operator: Op.Group });
  assert.equal(J.canSubSpecify(p, C.Denomination, 1), false);
  Object.assign(J.addition(p, C.Denomination, 0), J.newAddition({ operator: Op.And, code: "C" }));
  assert.equal(J.canSubSpecify(p, C.Denomination, 1), true);
});

test("argument-bearing code options and rendering", () => {
  const lg = J.argumentsFor("Lg");
  assert.ok(lg.required && lg.multiple);
  assert.equal(J.withArguments("Lg", ["He", "Yi"]), "Lg:HeYi");
  assert.equal(J.withArguments("Lg", ["not-a-language", "Yi"]), "Lg:Yi");
  const di = J.argumentsFor("Di");
  assert.ok(di.required && di.multiple);
  assert.equal(J.withArguments("Di", ["Yi", "Vg", "Gf"]), "Di:VgGf");
  assert.equal(J.withArguments("He:Mo", ["Mo", "Bi"]), "He:MoBi");
  assert.equal(J.withArguments("O", ["HaSat", "Mo"]), "O:HaSat");
  assert.equal(J.withArguments("Bc", ["C"]), "Bc:C");
});
