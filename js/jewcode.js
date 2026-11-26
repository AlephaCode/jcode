// Port of fergie.omer.land/omer/jewcodegen pkg/jcg/jewcode (Apache-2.0) to plain JavaScript.
// Structure and names follow the Go package so the two can be diffed; see NOTICE.
//
// Representation choices (Go → JS):
//   Level      → modifier string, or null for "omitted" ("" is the baseline, i.e. no modifier)
//   Intensity  → 0..3
//   Scope      → string ("" = none)
//   Operator / Combination / ConversionStatus → string constants below
//   Profile    → plain object (see newProfile), so it serializes to JSON as-is

/* ---------------- codes.go ---------------- */

export const Category = {
  Background: "background",
  Denomination: "denomination",
  Heritage: "heritage",
  Kashrut: "kashrut",
  Shabbat: "shabbat",
  Holiday: "holiday",
  Prayer: "prayer",
  Dietary: "dietary",
  Hebrew: "hebrew",
  Textual: "textual",
  Language: "language",
  Community: "community",
  Cultural: "cultural",
  Religious: "religious",
  God: "god",
  Israel: "israel",
  Zionism: "zionism",
};
const C = Category;
const declineToStateLabel = "Decline to state";

const code = (category, value, label) => ({ category, value, label });

const CODES = [
  code(C.Background, "Bj", "Born Jewish (matrilineal)"),
  code(C.Background, "Bp", "Patrilineal"),
  code(C.Background, "Bc", "Convert"),
  code(C.Background, "Ba", "Adopted"),
  code(C.Background, "B?", "Unknown or complicated"),
  code(C.Background, "B#", declineToStateLabel),
  code(C.Denomination, "O", "Orthodox"),
  code(C.Denomination, "C", "Conservative"),
  code(C.Denomination, "M", "Masorti"),
  code(C.Denomination, "R", "Reform"),
  code(C.Denomination, "Rc", "Reconstructionist"),
  code(C.Denomination, "Rn", "Renewal"),
  code(C.Denomination, "Hu", "Humanist"),
  code(C.Denomination, "S", "Secular"),
  code(C.Denomination, "Pd", "Post-denominational"),
  code(C.Denomination, "Jj", "Just Jewish"),
  code(C.Denomination, "Ji", "Jew-ish"),
  code(C.Denomination, "D?", "Unaffiliated or unknown"),
  code(C.Denomination, "D#", declineToStateLabel),
  code(C.Heritage, "As", "Ashkenazi"),
  code(C.Heritage, "Se", "Sephardi"),
  code(C.Heritage, "Mi", "Mizrachi"),
  code(C.Heritage, "Ye", "Yemenite (Teimani)"),
  code(C.Heritage, "Et", "Ethiopian (Beta Israel)"),
  code(C.Heritage, "It", "Italian (Italki)"),
  code(C.Heritage, "Ro", "Romaniote"),
  code(C.Heritage, "In", "Indian"),
  code(C.Heritage, "Ka", "Kaifeng"),
  code(C.Heritage, "Eo", "Other"),
  code(C.Heritage, "E?", "Unknown"),
  code(C.Heritage, "E#", declineToStateLabel),
  code(C.Kashrut, "K", "Kashrut"),
  code(C.Shabbat, "Sh", "Shabbat observance"),
  code(C.Holiday, "Ho", "Holiday observance"),
  code(C.Prayer, "Pr", "Prayer practice"),
  code(C.Dietary, "Di:V", "Vegetarian"),
  code(C.Dietary, "Di:Vg", "Vegan"),
  code(C.Dietary, "Di:P", "Pescatarian"),
  code(C.Dietary, "Di:Gf", "Gluten-free"),
  code(C.Dietary, "Di:Lf", "Lactose-free"),
  code(C.Dietary, "Di:Fm", "Low FODMAP"),
  code(C.Hebrew, "He", "Hebrew literacy"),
  code(C.Hebrew, "He:Mo", "Modern Hebrew"),
  code(C.Hebrew, "He:Bi", "Biblical or liturgical Hebrew"),
  code(C.Hebrew, "He:MoBi", "Modern and Biblical Hebrew"),
  code(C.Textual, "Tx", "Textual literacy"),
  code(C.Language, "Lg", "Languages"),
  code(C.Community, "Cm", "Community involvement"),
  code(C.Cultural, "Cu", "Cultural identification"),
  code(C.Religious, "Rl", "Religious identification"),
  code(C.God, "G", "Relationship to G-d"),
  code(C.Israel, "Il", "Relationship to Israel"),
  code(C.Zionism, "Z", "Zionism"),
];

export const codes = () => CODES;

export const languageSubSpecifiers = () => [
  code(C.Language, "He", "Hebrew"),
  code(C.Language, "Yi", "Yiddish"),
  code(C.Language, "Ld", "Ladino"),
  code(C.Language, "Hk", "Haketia"),
  code(C.Language, "Ja", "Judeo-Arabic"),
  code(C.Language, "Ar", "Aramaic"),
];

export const orthodoxSubSpecifiers = () => [
  code(C.Denomination, "Mo", "Modern Orthodox"),
  code(C.Denomination, "Ha", "Hasidic"),
  code(C.Denomination, "Ch", "Chabad"),
  code(C.Denomination, "Yv", "Yeshivish"),
];

export const hasidicDynasties = () => [
  code(C.Denomination, "Sat", "Satmar"),
  code(C.Denomination, "Bz", "Breslov"),
];

const DIETARY_ARGS = [
  code(C.Dietary, "V", "Vegetarian"),
  code(C.Dietary, "Vg", "Vegan"),
  code(C.Dietary, "P", "Pescatarian"),
  code(C.Dietary, "Gf", "Gluten-free"),
  code(C.Dietary, "Lf", "Lactose-free"),
  code(C.Dietary, "Fm", "Low FODMAP"),
];

export function argumentsFor(value) {
  switch (baseCode(value)) {
    case "Lg":
      return { label: "Languages", options: languageSubSpecifiers(), required: true, multiple: true };
    case "Di":
      return { label: "Dietary practices", options: DIETARY_ARGS, required: true, multiple: true };
    case "He":
      return {
        label: "Hebrew traditions", required: false, multiple: true,
        options: [code(C.Hebrew, "Mo", "Modern Hebrew"), code(C.Hebrew, "Bi", "Biblical or liturgical Hebrew")],
      };
    case "O":
      return {
        label: "Orthodox subtype", required: false, multiple: false,
        options: [
          ...orthodoxSubSpecifiers(),
          code(C.Denomination, "HaSat", "Satmar Hasidic"),
          code(C.Denomination, "HaBz", "Breslov Hasidic"),
        ],
      };
    case "Bc": {
      const options = [];
      for (const category of [C.Denomination, C.Heritage]) {
        for (const option of codesForCategory(category)) {
          if (!isDisclosureCode(option.value)) options.push(code(C.Background, option.value, option.label));
        }
      }
      return { label: "Conversion path", options, required: false, multiple: false };
    }
    default:
      return { label: "", options: [], required: false, multiple: false };
  }
}

export function withArguments(value, args) {
  const definition = argumentsFor(value);
  if (definition.options.length === 0) return value;
  const valid = [];
  for (const argument of args || []) {
    if (!definition.options.some((o) => o.value === argument) || valid.includes(argument)) continue;
    valid.push(argument);
    if (!definition.multiple) break;
  }
  if (valid.length === 0) return baseCode(value);
  return baseCode(value) + ":" + valid.join("");
}

export function baseCode(value) {
  const i = value.indexOf(":");
  return i >= 0 ? value.slice(0, i) : value;
}

// Unknown / decline-to-state codes (B?, B#, D?, D#, E?, E#) stand on their own and are never combined,
// transitioned or sub-specified.
export const isDisclosureCode = (value) => value.endsWith("?") || value.endsWith("#");
export const isKnownCode = (value) => CODES.some((c) => c.value === value);
export const codesForCategory = (category) => CODES.filter((c) => c.category === category);

/* ---------------- modifier.go ---------------- */

// Levels are their own symbol; null = omitted.
export const Level = {
  Omitted: null, Baseline: "",
  Positive: "+", VeryPositive: "++", ExtremelyPositive: "+++",
  Negative: "-", VeryNegative: "--", ExtremelyNegative: "---",
  Approximate: "~", Uncertain: "?", Complex: "*", Decline: "#",
};
const LEVEL_VALUES = new Set(["", "+", "++", "+++", "-", "--", "---", "~", "?", "*", "#"]);
export const levelSymbol = (level) => (level == null ? "" : level);
export const levelPresent = (level) => level != null;
export const levelValid = (level) => level == null || LEVEL_VALUES.has(level);
export const intensitySymbol = (n) => "!".repeat(Math.max(0, Math.min(3, n | 0)));

const MODIFIER_CHARS = "+-~?*!#";
const isModifierChar = (ch) => ch !== undefined && ch !== "" && MODIFIER_CHARS.includes(ch);

/* ---------------- token.go ---------------- */

export const Scope = {
  None: "", Family: "^", ExtendedFamily: "^^", Ancestral: "^^^",
  Community: "@", BroaderCommunity: "@@", JewishWorld: "@@@", FamilyCommunity: "^@",
};
const VALID_SCOPES = new Set(Object.values(Scope));

export const newToken = (t = {}) => ({ scope: "", prefix: "", expr: "", postfix: "", condition: "", ...t });
export const cloneToken = (t) => ({ ...t });

export function tokenString(token) {
  let value = token.scope + token.prefix + token.expr + token.postfix;
  if (token.condition) value += "(" + token.condition + ")";
  return value;
}

export function validateToken(token) {
  const value = tokenString(token);
  for (const ch of value) {
    if (ch.codePointAt(0) >= 0x80) throw new Error("token must contain ASCII characters only");
    if (/\s/.test(ch)) throw new Error("token must not contain whitespace");
  }
  if (!VALID_SCOPES.has(token.scope)) throw new Error(`invalid scope "${token.scope}"`);
  wrap("invalid token prefix", () => validateModifiers(token.prefix));
  wrap("invalid token postfix", () => validateModifiers(token.postfix));
  if (!token.expr) throw new Error("token expression must not be empty");
  wrap(`invalid token expression "${token.expr}"`, () => validateExpression(token.expr));
  wrap(`invalid token condition "${token.condition}"`, () => validateCondition(token.condition));
}

function wrap(prefix, fn) {
  try { fn(); } catch (e) { throw new Error(`${prefix}: ${e.message}`); }
}

function validateCondition(condition) {
  if (!condition) return;
  if ([...condition].every(isModifierChar)) return validateModifiers(condition);
  validateExpression(condition);
}

function validateModifiers(value) {
  if (!value) return;
  let previous = "";
  let run = 0;
  for (const ch of value) {
    if (!isModifierChar(ch)) throw new Error(`unsupported modifier "${ch}"`);
    if (ch === previous) run++;
    else { previous = ch; run = 1; }
    if (run > 3) throw new Error(`modifier "${ch}" may not repeat more than three times`);
  }
}

const isUpper = (ch) => ch >= "A" && ch <= "Z" && ch.length === 1;
const isLower = (ch) => ch >= "a" && ch <= "z" && ch.length === 1;
const isScopeChar = (ch) => ch === "^" || ch === "@";
const isExpressionOperator = (ch) => ch !== undefined && ch !== "" && "/&|<>()".includes(ch);
const isSubSpecifierChar = (ch) => ch !== undefined && (isUpper(ch) || isLower(ch) || (ch >= "0" && ch <= "9" && ch.length === 1));
const isSubSpecifierRoot = (value) => CODES.some((c) => c.value.startsWith(value + ":"));

function validateExpression(expression) {
  if (!expression) throw new Error("expression must not be empty");
  let codeCount = 0;
  let previousWasTerm = false;
  let previousWasGroup = false;
  for (let position = 0; position < expression.length;) {
    const current = expression[position];
    if (isUpper(current)) {
      if (previousWasGroup) throw new Error("group cannot be juxtaposed with another term");
      position = validateCodeAt(expression, position);
      codeCount++;
      previousWasTerm = true;
      previousWasGroup = false;
    } else if (isScopeChar(current)) {
      position = validateInnerScopeAt(expression, position);
      previousWasTerm = false;
      previousWasGroup = false;
    } else if (isModifierChar(current)) {
      const prev = expression[position - 1];
      if (position > 0 && !isExpressionOperator(prev) && !isScopeChar(prev) && (!previousWasGroup || prev !== "]")) {
        throw new Error("modifier must lead a term or follow a code");
      }
      const wasTerm = previousWasTerm;
      let end = position;
      while (end < expression.length && isModifierChar(expression[end])) end++;
      validateModifiers(expression.slice(position, end));
      const next = expression[end];
      if (wasTerm && end < expression.length && (isUpper(next) || isScopeChar(next) || next === "[")) {
        throw new Error("modifiers may not appear between terms");
      }
      position = end;
    } else if (isExpressionOperator(current)) {
      position++;
      previousWasTerm = false;
      previousWasGroup = false;
    } else if (current === "[") {
      if (previousWasTerm) throw new Error("group cannot be juxtaposed with a compound");
      const end = matchingGroupEnd(expression, position);
      wrap("invalid grouped expression", () => validateExpression(expression.slice(position + 1, end)));
      codeCount++;
      position = end + 1;
      previousWasTerm = true;
      previousWasGroup = true;
    } else if (current === "]") {
      throw new Error("closing bracket has no matching opening bracket");
    } else if (current === ":") {
      throw new Error("sub-specifier must follow a category code");
    } else {
      throw new Error(`unexpected character "${current}"`);
    }
  }
  if (codeCount === 0) throw new Error("expression must contain at least one code");
}

function matchingGroupEnd(expression, start) {
  let depth = 0;
  for (let position = start; position < expression.length; position++) {
    if (expression[position] === "[") depth++;
    else if (expression[position] === "]") {
      depth--;
      if (depth === 0) return position;
    }
  }
  throw new Error("opening bracket has no matching closing bracket");
}

// A scope marker that leads a term inside an expression (e.g. Bj^Bc: born Jewish, parents were converts).
function validateInnerScopeAt(expression, position) {
  let end = position;
  while (end < expression.length && isScopeChar(expression[end])) end++;
  const scope = expression.slice(position, end);
  if (!VALID_SCOPES.has(scope)) throw new Error(`invalid scope "${scope}"`);
  const next = expression[end];
  if (end === expression.length || (!isUpper(next) && !isModifierChar(next) && next !== "[")) {
    throw new Error(`scope "${scope}" must lead a term`);
  }
  return end;
}

function validateCodeAt(expression, position) {
  const start = position;
  position++;
  while (position < expression.length && isLower(expression[position])) position++;
  let value = expression.slice(start, position);
  if (expression[position] === ":") {
    if (!isKnownCode(value) && !isSubSpecifierRoot(value)) throw new Error(`unknown category code "${value}"`);
    while (expression[position] === ":") {
      position++;
      const subStart = position;
      while (position < expression.length && isSubSpecifierChar(expression[position])) position++;
      if (position === subStart) throw new Error(`empty sub-specifier after "${value}"`);
    }
  } else {
    const next = expression[position];
    if ((next === "?" || next === "#") && value.length === 1 && "BDE".includes(value)) {
      value += next;
      position++;
    }
    if (!isKnownCode(value)) throw new Error(`unknown code "${value}"`);
  }
  if (isModifierChar(expression[position])) {
    const modStart = position;
    while (isModifierChar(expression[position])) position++;
    validateModifiers(expression.slice(modStart, position));
    const next = expression[position];
    if (position < expression.length && (isUpper(next) || isScopeChar(next))) {
      throw new Error("modifiers may not appear between codes in a token");
    }
  }
  return position;
}

/* ---------------- block.go ---------------- */

export const Version1 = "1.0";
export const BlockHeader = "-----BEGIN JEW CODE BLOCK-----";
export const BlockFooter = "-----END JEW CODE BLOCK-----";
export const SizeLimit = 512;

// The Go version renders all tokens on one line; `wrap` (columns) optionally breaks long lines between tokens,
// which is still a valid block since tokens are whitespace-separated.
export function renderBlock(tokens, { version = Version1, wrap = 0 } = {}) {
  const strings = tokens.map((t) => (typeof t === "string" ? t : tokenString(t)));
  let body = strings.join(" ");
  if (wrap > 0) {
    const lines = [];
    let line = "";
    for (const s of strings) {
      if (line && line.length + 1 + s.length > wrap) { lines.push(line); line = s; }
      else line = line ? line + " " + s : s;
    }
    if (line) lines.push(line);
    body = lines.join("\n");
  }
  return [BlockHeader, "Version: " + version, "", body, "", BlockFooter, ""].join("\n");
}

export function validateBlock(tokens, version = Version1) {
  if (version !== Version1) throw new Error(`unsupported block version "${version}"`);
  if (tokens.length < 3) throw new Error(`identity block must contain at least three tokens: got ${tokens.length}`);
  tokens.forEach((token, i) => wrap(`validating token ${i + 1}`, () => validateToken(token)));
}

export function blockWarnings(tokens) {
  const size = new TextEncoder().encode(tokens.map(tokenString).join(" ")).length;
  return size <= SizeLimit ? [] : [`identity block content is ${size} bytes; the recommended maximum is ${SizeLimit} bytes`];
}

/* ---------------- addition.go ---------------- */

export const Operator = {
  None: "none", // nothing more to add
  Compound: "compound", // OC, Bj^Bc
  And: "and", // O&C
  Blend: "blend", // O/C, K+/K-
  Contextual: "contextual", // O|C, Sh+|Sh-
  Transition: "transition", // O>R, K->K+
  Additive: "additive", // O<R>
  SubSpecify: "subspecify", // O:Mo
  Separate: "separate", // @Sh++
  Group: "group", // [As|Mi]+
};
const OPERATOR_SYMBOL = { and: "&", blend: "/", contextual: "|", transition: ">", additive: "<", subspecify: ":" };
export const operatorSymbol = (op) => OPERATOR_SYMBOL[op] || "";

export const newAddition = (a = {}) => ({
  operator: Operator.None, scope: "", code: "", arguments: [], subSpecifier: "",
  level: null, groupStart: 0, groupPrefix: null, groupPostfix: null, intensity: 0, ...a,
});

// Codes that can be attached to a category: its own codes first, then every other code.
export function additionCodes(category) {
  const result = [];
  const seen = new Set();
  const add = (c) => {
    const value = baseCode(c.value);
    if (isDisclosureCode(value) || seen.has(value)) return;
    seen.add(value);
    let label = c.label;
    if (value === "Di") label = "Dietary practices";
    else if (value !== c.value) label = (CODES.find((b) => b.value === value) || c).label;
    result.push(code(c.category, value, label));
  };
  for (const c of CODES) if (c.category === category) add(c);
  for (const c of CODES) if (c.category !== category) add(c);
  return result;
}

/* ---------------- profile.go ---------------- */

export const Combination = { Separate: "separate", Compound: "compound", Blend: "blend", Contextual: "contextual", Additive: "additive" };
export const Conversion = { Convert: "convert", InProgress: "inprogress", Considering: "considering", Complete: "complete" };

export const newContext = () => ({
  skipped: false, scope: "", denomination: "", orthodoxSubtype: "", level: null,
  alternative: "", transition: "", kashrut: null, shabbat: null, holidays: null,
});
export const newNuance = () => ({ salience: null, intensity: 0, previous: null, exception: null });

export function newProfile() {
  return {
    background: "", conversion: Conversion.Convert, conversionPath: "",
    denomination: "", denominationLevel: null, secondaryDenomination: "", denominationCombination: Combination.Separate,
    previousDenomination: "", previousOrthodoxSubtype: "", orthodoxSubtype: "", hasidicDynasty: "",
    familyContext: newContext(), communityContext: newContext(),
    heritage: [], heritageCombination: Combination.Separate, heritageScope: "",
    kashrut: null, shabbat: null, holidays: null, prayer: null, dietary: [],
    hebrew: "", hebrewLevel: null, textual: null, languages: [], languageLevel: null,
    community: null, cultural: null, religious: null, god: null, israel: null, zionism: null,
    extendedCategories: [], additions: {}, nuancedCategories: [], nuances: {},
    extraTokens: [], // web-only: tokens kept verbatim (e.g. from a decoded block), appended at the end
  };
}

export function supportsTransition(category) {
  return [C.Kashrut, C.Shabbat, C.Holiday, C.Prayer, C.Hebrew, C.Textual, C.Language,
    C.Community, C.Cultural, C.Religious, C.God, C.Israel, C.Zionism].includes(category);
}

export function nuance(profile, category) {
  if (!profile.nuances[category]) profile.nuances[category] = newNuance();
  return profile.nuances[category];
}

export function addition(profile, category, index) {
  if (index < 0) throw new Error("addition index cannot be negative");
  const slots = profile.additions[category] || (profile.additions[category] = []);
  while (slots.length <= index) slots.push(newAddition());
  if (!slots[index]) slots[index] = newAddition();
  return slots[index];
}

export function profileTokens(profile) {
  return build(profile).finish()[0];
}

// All tokens including the web-only verbatim extras, as strings.
export function profileTokenStrings(profile) {
  return [...profileTokens(profile).map(tokenString), ...(profile.extraTokens || [])];
}

export function categoryTokens(profile, category) {
  const [tokens, categories] = build(profile).finish();
  return tokens.filter((_, i) => categories[i] === category);
}

export const answeredCategories = (profile) => build(profile).categories;

export function canExtend(profile, category) {
  const builder = build(profile);
  const index = builder.lastIndex(category);
  if (index < 0) return false;
  return !isDisclosureCode(builder.bases[category]) && !isDisclosureCode(builder.tokens[index].expr);
}

export const categoryBaseCode = (profile, category) => build(profile).bases[category] || "";

export function canSubSpecify(profile, category, index) {
  if (index < 0) return false;
  const builder = build(profile);
  const tokenIndex = builder.lastIndex(category);
  if (tokenIndex < 0 || isDisclosureCode(builder.bases[category])) return false;
  const additions = effectiveAdditions(profile, category);
  const states = extendStates(builder.tokens[tokenIndex], builder.bases[category], additions.slice(0, Math.min(index, additions.length)));
  return endsWithCode(states[states.length - 1].token.expr);
}

function effectiveAdditions(profile, category) {
  if (!profile.extendedCategories.includes(category)) return [];
  const result = [];
  for (const a of profile.additions[category] || []) {
    if (!a || a.operator === Operator.None) break;
    result.push(a);
  }
  return result;
}

function effectiveNuance(profile, category) {
  if (!profile.nuancedCategories.includes(category)) return newNuance();
  return { ...newNuance(), ...(profile.nuances[category] || {}) };
}

function denominationCode(profile, value) {
  if (value !== "O" || !profile.orthodoxSubtype) return value;
  let sub = profile.orthodoxSubtype;
  if (sub === "Ha") sub += profile.hasidicDynasty;
  return value + ":" + sub;
}

function build(profile) {
  const b = new TokenBuilder(profile);
  b.background();
  b.context(profile.familyContext, Scope.Family);
  b.context(profile.communityContext, Scope.Community);
  // A scoped heritage (e.g. ^As|Mi) describes the context one comes from, so it is placed with the other
  // context tokens, ahead of the personal denomination (DEP-0249 §12.2).
  if (profile.heritageScope) b.heritage();
  b.denomination();
  if (!profile.heritageScope) b.heritage();
  b.practice(C.Kashrut, "K", profile.kashrut, profile.familyContext.kashrut, profile.communityContext.kashrut);
  b.practice(C.Shabbat, "Sh", profile.shabbat, profile.familyContext.shabbat, profile.communityContext.shabbat);
  b.practice(C.Holiday, "Ho", profile.holidays, profile.familyContext.holidays, profile.communityContext.holidays);
  b.level(C.Prayer, "Pr", profile.prayer);
  b.dietary();
  if (profile.hebrew) {
    b.level(C.Hebrew, profile.hebrew, atLeastBaseline(profile.hebrewLevel));
    b.bases[C.Hebrew] = baseCode(profile.hebrew);
  }
  b.level(C.Textual, "Tx", profile.textual);
  if (profile.languages.length > 0) {
    b.level(C.Language, "Lg:" + profile.languages.join(""), atLeastBaseline(profile.languageLevel));
    b.bases[C.Language] = "Lg";
  }
  b.level(C.Community, "Cm", profile.community);
  b.level(C.Cultural, "Cu", profile.cultural);
  b.level(C.Religious, "Rl", profile.religious);
  b.level(C.God, "G", profile.god);
  b.level(C.Israel, "Il", profile.israel);
  b.level(C.Zionism, "Z", profile.zionism);
  return b;
}

class TokenBuilder {
  constructor(profile) {
    this.profile = profile;
    this.tokens = [];
    this.tokenCategories = [];
    this.categories = [];
    this.bases = {};
  }

  add(token, category, base) {
    this.tokens.push(token);
    this.tokenCategories.push(category);
    if (!this.categories.includes(category)) {
      this.categories.push(category);
      this.bases[category] = base;
    }
  }

  addContext(token) {
    this.tokens.push(token);
    this.tokenCategories.push("");
  }

  lastIndex(category) {
    return this.tokenCategories.lastIndexOf(category);
  }

  // Folds each category's additions into its last token, then applies the category's nuance.
  finish() {
    const tokens = [];
    const categories = [];
    this.tokens.forEach((token, index) => {
      const category = this.tokenCategories[index];
      if (category === "") {
        tokens.push(cloneToken(token));
        categories.push(category);
        return;
      }
      let extended = [cloneToken(token)];
      if (index === this.lastIndex(category)) {
        extended = stateTokens(extendStates(token, this.bases[category], effectiveAdditions(this.profile, category)));
      }
      const n = effectiveNuance(this.profile, category);
      extended[0].prefix = levelSymbol(n.salience);
      extended[0].postfix += intensitySymbol(n.intensity);
      extended[0].condition = levelSymbol(n.exception);
      for (const t of extended) { tokens.push(t); categories.push(category); }
    });
    return [tokens, categories];
  }

  background() {
    const p = this.profile;
    if (!p.background) return;
    let expression = p.background;
    if (expression === "Bc") {
      if (p.conversionPath) expression += ":" + p.conversionPath;
      switch (p.conversion) {
        case Conversion.InProgress: expression = ">" + expression; break;
        case Conversion.Considering: expression = "?>" + expression; break;
        case Conversion.Complete: expression += ">Bj"; break;
        default: break;
      }
    }
    this.add(newToken({ expr: expression }), C.Background, p.background);
  }

  context(context, defaultScope) {
    if (context.skipped || !context.denomination) return;
    let expression = contextDenominationCode(context);
    if (!isDisclosureCode(expression)) {
      if (context.alternative && context.alternative !== context.denomination) expression += "|" + context.alternative;
      if (context.transition) expression += ">" + context.transition;
    }
    this.addContext(newToken({ scope: context.scope || defaultScope, expr: expression, postfix: levelSymbol(context.level) }));
  }

  denomination() {
    const p = this.profile;
    const primary = p.denomination;
    if (!primary) return;
    const postfix = levelSymbol(p.denominationLevel);
    if (isDisclosureCode(primary)) {
      this.add(newToken({ expr: primary, postfix }), C.Denomination, primary);
      return;
    }
    const list = [denominationCode(p, primary)];
    const secondary = p.secondaryDenomination;
    if (secondary && secondary !== primary && !isDisclosureCode(secondary)) list.push(denominationCode(p, secondary));
    const expressions = combine(list, p.denominationCombination);
    let previous = p.previousDenomination;
    if (previous === "O" && p.previousOrthodoxSubtype) previous += ":" + p.previousOrthodoxSubtype;
    if (previous && !isDisclosureCode(previous) && previous !== expressions[0]) expressions[0] = previous + ">" + expressions[0];
    for (const e of expressions) this.add(newToken({ expr: e, postfix }), C.Denomination, list[0]);
  }

  heritage() {
    const p = this.profile;
    if (p.heritage.length === 0) return;
    for (const c of p.heritage) {
      if (isDisclosureCode(c)) {
        this.add(newToken({ scope: p.heritageScope, expr: c }), C.Heritage, c);
        return;
      }
    }
    for (const e of combine(p.heritage, p.heritageCombination)) {
      this.add(newToken({ scope: p.heritageScope, expr: e }), C.Heritage, p.heritage[0]);
    }
  }

  practice(category, value, personal, family, community) {
    const p = this.profile;
    if (levelPresent(family) && !p.familyContext.skipped) {
      this.addContext(newToken({ scope: p.familyContext.scope || Scope.Family, expr: value, postfix: levelSymbol(family) }));
    }
    if (levelPresent(community) && !p.communityContext.skipped) {
      this.addContext(newToken({ scope: p.communityContext.scope || Scope.Community, expr: value, postfix: levelSymbol(community) }));
    }
    this.level(category, value, personal);
  }

  level(category, value, level) {
    if (!levelPresent(level)) return;
    const previous = supportsTransition(category) ? effectiveNuance(this.profile, category).previous : null;
    const [expr, postfix] = transition(value, previous, level);
    this.add(newToken({ expr, postfix }), category, value);
  }

  dietary() {
    const d = this.profile.dietary;
    if (d.length === 0) return;
    this.add(newToken({ expr: "Di:" + d.map((c) => c.replace(/^Di:/, "")).join("") }), C.Dietary, "Di");
  }
}

function contextDenominationCode(context) {
  if (context.denomination === "O" && context.orthodoxSubtype) return "O:" + context.orthodoxSubtype;
  return context.denomination;
}

// A level change over time; when both sides carry modifiers the right-hand code is inherited (K++>+++),
// otherwise the full form is used so that neither side is ambiguous (K->K, K>K+).
function transition(value, previous, current) {
  if (!levelPresent(previous)) return [value, levelSymbol(current)];
  const before = levelSymbol(previous);
  const after = levelSymbol(current);
  if (before && after) return [value + before + ">", after];
  return [value + before + ">" + value, after];
}

function combine(list, combination) {
  if (list.length < 2) return list;
  switch (combination) {
    case Combination.Compound: return [joinCompound(list)];
    case Combination.Blend: return [list.join("/")];
    case Combination.Contextual: return [list.join("|")];
    case Combination.Additive: return [list[0] + "<" + joinCompound(list.slice(1)) + ">"];
    default: return [...list];
  }
}

// Juxtaposition binds tighter than ":", so a sub-specified code falls back to explicit &.
function joinCompound(list) {
  return list.some((c) => c.includes(":")) ? list.join("&") : list.join("");
}

const atLeastBaseline = (level) => (levelPresent(level) ? level : Level.Baseline);

/* ---------------- addition.go: expression folding ---------------- */

function extendStates(token, base, additions) {
  const states = [{ token: cloneToken(token), starts: initialTermStarts(token.expr) }];
  if (isDisclosureCode(base) || isDisclosureCode(token.expr)) return states;

  let current = 0;
  for (const a of additions) {
    const value = withArguments(a.code || base, a.arguments);
    const target = states[current];
    const t = target.token;
    switch (a.operator) {
      case Operator.Separate:
        states.push({ token: newToken({ scope: a.scope, expr: value, postfix: levelSymbol(a.level) }), starts: [{ operatorOffset: 0, insertOffset: 0, juxtaposed: false }] });
        current = states.length - 1;
        break;
      case Operator.SubSpecify:
        if (a.subSpecifier && endsWithCode(t.expr)) t.expr += ":" + a.subSpecifier;
        break;
      case Operator.Additive:
        t.expr += t.postfix + "<" + a.scope + value + levelSymbol(a.level) + ">";
        t.postfix = "";
        break;
      case Operator.Compound: {
        const separator = needsExplicitConjunction(t.expr, t.postfix, value) ? "&" : "";
        t.expr += t.postfix;
        const operatorOffset = t.expr.length;
        t.expr += separator + a.scope;
        const insertOffset = t.expr.length;
        t.expr += value;
        target.starts.push({ operatorOffset, insertOffset, juxtaposed: separator === "" });
        t.postfix = levelSymbol(a.level);
        break;
      }
      case Operator.And:
      case Operator.Blend:
      case Operator.Contextual:
      case Operator.Transition: {
        t.expr += t.postfix;
        const operatorOffset = t.expr.length;
        t.expr += operatorSymbol(a.operator) + a.scope;
        const insertOffset = t.expr.length;
        t.expr += value;
        target.starts.push({ operatorOffset, insertOffset, juxtaposed: false });
        t.postfix = levelSymbol(a.level);
        break;
      }
      case Operator.Group:
        applyGroup(target, a.groupStart, a.scope, a.groupPrefix, a.groupPostfix, a.level, a.intensity);
        break;
      default:
        break;
    }
  }
  return states;
}

const stateTokens = (states) => states.map((s) => s.token);

function applyGroup(state, startIndex, scope, prefix, innerPostfix, level, intensity) {
  if (state.starts.length === 0) state.starts = [{ operatorOffset: 0, insertOffset: 0, juxtaposed: false }];
  startIndex = Math.min(Math.max(startIndex | 0, 0), state.starts.length - 1);
  const start = { ...state.starts[startIndex] };
  let expression = state.token.expr;
  if (start.juxtaposed) {
    expression = expression.slice(0, start.operatorOffset) + "&" + expression.slice(start.operatorOffset);
    start.insertOffset++;
  }
  let postfix = state.token.postfix;
  if (levelSymbol(innerPostfix) !== "") postfix = levelSymbol(innerPostfix);
  state.token.expr = expression.slice(0, start.insertOffset) + scope + "[" + levelSymbol(prefix) + expression.slice(start.insertOffset) + postfix + "]";
  state.token.postfix = levelSymbol(level) + intensitySymbol(intensity);
  start.juxtaposed = false;
  state.starts = [...state.starts.slice(0, startIndex), start];
}

// Every trailing sub-expression that can be wrapped without splitting a code or operator.
export function groupOptions(profile, category, index) {
  if (index < 0) return [];
  const builder = build(profile);
  const tokenIndex = builder.lastIndex(category);
  if (tokenIndex < 0) return [];
  const additions = effectiveAdditions(profile, category);
  const states = extendStates(builder.tokens[tokenIndex], builder.bases[category], additions.slice(0, Math.min(index, additions.length)));
  const state = states[states.length - 1];
  return state.starts.map((_, start) => {
    const preview = { token: cloneToken(state.token), starts: state.starts.map((s) => ({ ...s })) };
    applyGroup(preview, start, "", null, null, null, 0);
    return { start, preview: tokenString(preview.token) };
  });
}

function initialTermStarts(expression) {
  const starts = [{ operatorOffset: 0, insertOffset: 0, juxtaposed: false }];
  let bracketDepth = 0;
  let additiveDepth = 0;
  for (let position = 0; position < expression.length; position++) {
    const current = expression[position];
    if (current === "[") { bracketDepth++; continue; }
    if (current === "]") { bracketDepth--; continue; }
    if (bracketDepth > 0) continue;
    if (current === "<") { additiveDepth++; continue; }
    if (current === ">" && additiveDepth > 0) { additiveDepth--; continue; }
    if (additiveDepth > 0 || (current !== "&" && current !== "/" && current !== "|" && current !== ">")) {
      if (isScopeChar(current) && position > 0) {
        let end = position;
        while (end < expression.length && isScopeChar(expression[end])) end++;
        starts.push({ operatorOffset: position, insertOffset: end, juxtaposed: true });
        position = end - 1;
      }
      continue;
    }
    let insertOffset = position + 1;
    while (insertOffset < expression.length && isScopeChar(expression[insertOffset])) insertOffset++;
    starts.push({ operatorOffset: position, insertOffset, juxtaposed: false });
    position = insertOffset - 1;
  }
  return starts;
}

// Juxtaposition would be ambiguous after a modifier (O+C) or a sub-specifier (O:MoC reads as O:(MoC)).
function needsExplicitConjunction(expression, pending, value) {
  if (pending !== "" || value.includes(":") || !endsWithCode(expression)) return true;
  let cut = -1;
  for (const ch of "/&|<>()[]^@") cut = Math.max(cut, expression.lastIndexOf(ch));
  return expression.slice(cut + 1).includes(":");
}

function endsWithCode(expression) {
  return expression !== "" && isSubSpecifierChar(expression[expression.length - 1]);
}
