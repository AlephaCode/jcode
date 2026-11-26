// Block → Profile, the reverse of the builder in jewcode.js. Web-only (not part of omer's jewcodegen).
//
// Every token is matched against the patterns the builder produces. An interpretation is accepted only if
// re-rendering the profile yields exactly the previous tokens plus this one; anything else (custom addition
// chains, hand-written expressions) is kept verbatim in profile.extraTokens so a round trip loses nothing.
import * as J from "./jewcode.js";

const C = J.Category;
const LV = "(\\+{1,3}|-{1,3}|~|\\?|\\*|#)?";
const DEN = "(?:O(?::[A-Z][A-Za-z0-9]*)?|Rc|Rn|Hu|Pd|Jj|Ji|C|M|R|S)";
const HER = "(?:As|Se|Mi|Ye|Et|It|Ro|In|Ka|Eo)";
const LEVELED = { K: C.Kashrut, Sh: C.Shabbat, Ho: C.Holiday, Pr: C.Prayer, Tx: C.Textual, Cm: C.Community,
  Cu: C.Cultural, Rl: C.Religious, G: C.God, Il: C.Israel, Z: C.Zionism };
const FIELD = { [C.Kashrut]: "kashrut", [C.Shabbat]: "shabbat", [C.Holiday]: "holidays", [C.Prayer]: "prayer",
  [C.Textual]: "textual", [C.Community]: "community", [C.Cultural]: "cultural", [C.Religious]: "religious",
  [C.God]: "god", [C.Israel]: "israel", [C.Zionism]: "zionism" };
const FAMILY_SCOPES = ["^", "^^", "^^^"];
const COMMUNITY_SCOPES = ["@", "@@", "@@@", "^@"];
const SALIENCE = ["+++", "++", "+", "~", "?"];
const camel = (s) => s.match(/[A-Z][a-z0-9]*/g) || [];

/** Split a pasted block (or bare tokens) into its version and tokens. */
export function parseBlock(text) {
  let version = null;
  const body = [];
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (/^-----(BEGIN|END) JEW CODE BLOCK-----$/.test(t)) continue;
    const v = t.match(/^Version:\s*(\S+)/);
    if (v) { version = v[1]; continue; }
    body.push(line);
  }
  return { version, tokens: body.join(" ").split(/\s+/).filter(Boolean) };
}

/** Rebuild a Profile from token strings. Unmapped tokens land in profile.extraTokens. */
export function profileFromTokens(tokens) {
  let profile = J.newProfile();
  const extras = [];
  for (const tok of tokens) {
    const before = J.profileTokens(profile).map(J.tokenString);
    let accepted = null;
    for (const apply of candidates(tok)) {
      const trial = structuredClone(profile);
      try { if (apply(trial) === false) continue; } catch { continue; }
      if (sameAsPlus(before, J.profileTokens(trial).map(J.tokenString), tok)) { accepted = trial; break; }
    }
    if (accepted) profile = accepted;
    else extras.push(tok);
  }
  profile.extraTokens = extras;
  return profile;
}

function sameAsPlus(before, after, tok) {
  const rest = [...after];
  for (const b of before) {
    const i = rest.indexOf(b);
    if (i < 0) return false;
    rest.splice(i, 1);
  }
  return rest.length === 1 && rest[0] === tok;
}

function setNuance(p, category, { salience = null, intensity = 0, exception = null, previous = null }) {
  if (salience == null && !intensity && exception == null && previous == null) return;
  if (!p.nuancedCategories.includes(category)) p.nuancedCategories.push(category);
  Object.assign(J.nuance(p, category), { salience, intensity, exception, previous });
}

function* candidates(tok) {
  const sm = tok.match(/^(\^@|\^{1,3}|@{1,3})?(.*)$/);
  const scope = sm[1] || "";
  const afterScope = sm[2];

  // trailing intensity / (condition)
  const tm = afterScope.match(/^(.*?)(!{1,3})?(?:\(([^()]*)\))?$/);
  const tails = [{ body: afterScope, intensity: 0, exception: null }];
  if (tm && (tm[2] || tm[3] !== undefined)) {
    const exception = tm[3] === undefined ? null : tm[3];
    if (exception === null || /^(\+{1,3}|-{1,3}|~|\?|\*|#)$/.test(exception)) {
      tails.unshift({ body: tm[1], intensity: (tm[2] || "").length, exception });
    }
  }

  for (const { body, intensity, exception } of tails) {
    const variants = [{ salience: null, core: body }];
    for (const s of SALIENCE) if (body.startsWith(s) && body.length > s.length) variants.push({ salience: s, core: body.slice(s.length) });
    for (const { salience, core } of variants) {
      const nu = { salience, intensity, exception };
      if (!scope) yield* personal(core, nu);
      else yield* scoped(scope, core, nu);
    }
  }
}

function* personal(core, nu) {
  let m;
  // Background
  if ((m = core.match(/^(Bj|Bp|Ba|B\?|B#)$/))) yield (p) => { p.background = m[1]; setNuance(p, C.Background, nu); };
  if ((m = core.match(/^(\?>|>)?Bc(?::([A-Z][a-z]*))?(>Bj)?$/)) && !(m[1] && m[3])) {
    yield (p) => {
      p.background = "Bc";
      p.conversionPath = m[2] || "";
      p.conversion = m[1] === "?>" ? J.Conversion.Considering : m[1] === ">" ? J.Conversion.InProgress : m[3] ? J.Conversion.Complete : J.Conversion.Convert;
      setNuance(p, C.Background, nu);
    };
  }

  // Denomination
  if ((m = core.match(new RegExp(`^(D\\?|D#)${LV}$`)))) {
    yield (p) => { p.denomination = m[1]; p.denominationLevel = m[2] || ""; setNuance(p, C.Denomination, nu); };
  }
  const dm = core.match(new RegExp(`^(?:(${DEN})>)?(${DEN})(?:(&|/|\\||<)?(${DEN})>?)?${LV}$`));
  if (dm) {
    const [, prev, a, op, b, lvl] = dm;
    const combination = !b ? null : op === "/" ? "blend" : op === "|" ? "contextual" : op === "<" ? "additive" : "compound";
    if (!(op === "<") || core.includes(b + ">")) {
      // a fresh denomination answer
      yield (p) => {
        if (p.denomination) return false;
        p.denomination = baseOf(a);
        p.denominationLevel = lvl || "";
        if (b) { p.secondaryDenomination = baseOf(b); p.denominationCombination = combination; }
        const sub = subOf(a) || (b ? subOf(b) : "");
        if (sub) setOrthodoxSub(p, sub);
        if (prev) { p.previousDenomination = baseOf(prev); p.previousOrthodoxSubtype = subOf(prev); }
        setNuance(p, C.Denomination, nu);
      };
      // the second of two separate denominations (O C)
      if (!b && !prev) {
        yield (p) => {
          if (!p.denomination || p.secondaryDenomination) return false;
          p.secondaryDenomination = baseOf(a);
          p.denominationCombination = "separate";
          if (subOf(a)) setOrthodoxSub(p, subOf(a));
        };
      }
    }
  }

  // Heritage
  yield* heritage("", core, nu);

  // Leveled categories, incl. transitions (K++>+++, Ho>Ho+)
  for (const [codeValue, category] of Object.entries(LEVELED)) {
    const lm = core.match(new RegExp(`^${codeValue}${LV}(?:>(${codeValue})?${LV})?$`));
    if (!lm) continue;
    const [, l1, , l2] = lm;
    const hasArrow = core.slice(codeValue.length + (l1 || "").length).startsWith(">");
    yield (p) => {
      if (J.levelPresent(p[FIELD[category]])) return false;
      p[FIELD[category]] = hasArrow ? (l2 || "") : (l1 || "");
      setNuance(p, category, { ...nu, previous: hasArrow ? (l1 || "") : null });
    };
  }

  // Hebrew, languages, dietary
  if ((m = core.match(new RegExp(`^(He(?::(?:MoBi|Mo|Bi))?)${LV}(?:>(?:He(?::(?:MoBi|Mo|Bi))?)?${LV})?$`)))) {
    const hasArrow = core.includes(">");
    yield (p) => {
      if (p.hebrew) return false;
      p.hebrew = m[1];
      p.hebrewLevel = hasArrow ? (m[3] || "") : (m[2] || "");
      setNuance(p, C.Hebrew, { ...nu, previous: hasArrow ? (m[2] || "") : null });
    };
  }
  if ((m = core.match(new RegExp(`^Lg:((?:He|Yi|Ld|Hk|Ja|Ar)+)${LV}(?:>(?:Lg:\\1)?${LV})?$`)))) {
    const hasArrow = core.includes(">");
    yield (p) => {
      if (p.languages.length) return false;
      p.languages = camel(m[1]);
      p.languageLevel = hasArrow ? (m[3] || "") : (m[2] || "");
      setNuance(p, C.Language, { ...nu, previous: hasArrow ? (m[2] || "") : null });
    };
  }
  if ((m = core.match(/^Di:((?:Vg|V|P|Gf|Lf|Fm)+)$/))) {
    yield (p) => { if (p.dietary.length) return false; p.dietary = camel(m[1]).map((c) => "Di:" + c); setNuance(p, C.Dietary, nu); };
  }
}

function* heritage(scope, core, nu) {
  let m;
  if ((m = core.match(/^(E\?|E#)$/))) {
    yield (p) => { if (p.heritage.length) return false; p.heritage = [m[1]]; p.heritageScope = scope; setNuance(p, C.Heritage, nu); };
  }
  for (const [op, combination] of [["", "compound"], ["/", "blend"], ["\\|", "contextual"]]) {
    if (!new RegExp(`^${HER}(?:${op}${HER})+$`).test(core)) continue;
    yield (p) => {
      if (p.heritage.length) return false;
      p.heritage = camel(core);
      p.heritageCombination = combination;
      p.heritageScope = scope;
      setNuance(p, C.Heritage, nu);
    };
  }
  if (new RegExp(`^${HER}$`).test(core)) {
    yield (p) => {
      if (p.heritage.length && (p.heritageCombination !== "separate" || p.heritageScope !== scope)) return false;
      p.heritage = [...p.heritage, core];
      p.heritageCombination = "separate";
      p.heritageScope = scope;
      setNuance(p, C.Heritage, nu);
    };
  }
}

function* scoped(scope, core, nu) {
  const hasNuance = nu.salience != null || nu.intensity || nu.exception != null;
  if (["^", "^^", "^^^", "@"].includes(scope)) yield* heritage(scope, core, nu);
  if (hasNuance) return; // context tokens carry no nuance

  const ctxKey = FAMILY_SCOPES.includes(scope) ? "familyContext" : COMMUNITY_SCOPES.includes(scope) ? "communityContext" : null;
  if (!ctxKey) return;
  let m;
  if ((m = core.match(new RegExp(`^(${DEN})(?:\\|(${DEN}))?(?:>(${DEN}))?${LV}$`)))) {
    yield (p) => {
      const ctx = p[ctxKey];
      if (ctx.denomination) return false;
      ctx.scope = scope;
      ctx.denomination = baseOf(m[1]);
      ctx.orthodoxSubtype = subOf(m[1]);
      ctx.alternative = m[2] || "";
      ctx.transition = m[3] || "";
      ctx.level = m[4] || "";
    };
  }
  if ((m = core.match(new RegExp(`^(K|Sh|Ho)${LV}$`)))) {
    const field = { K: "kashrut", Sh: "shabbat", Ho: "holidays" }[m[1]];
    yield (p) => {
      const ctx = p[ctxKey];
      if (J.levelPresent(ctx[field])) return false;
      ctx.scope = scope;
      ctx[field] = m[2] || "";
    };
  }
}

const baseOf = (d) => d.split(":")[0];
const subOf = (d) => (d.includes(":") ? d.split(":").slice(1).join(":") : "");
function setOrthodoxSub(p, sub) {
  if (sub.startsWith("Ha") && sub.length > 2) { p.orthodoxSubtype = "Ha"; p.hasidicDynasty = sub.slice(2); }
  else p.orthodoxSubtype = sub;
}

/**
 * Final token strings for a profile. When the profile came from a decoded block (profile.tokenOrder), tokens
 * that still exist keep their original positions (DEP-0248 8.3: preserve order); new or changed tokens are
 * placed after the token that precedes them in builder order.
 */
export function outputTokens(profile) {
  const out = J.profileTokenStrings(profile);
  const original = profile.tokenOrder || [];
  if (!original.length) return out;
  const used = new Array(out.length).fill(false);
  const pos = out.map(() => -1);
  original.forEach((tok, oi) => {
    const i = out.findIndex((t, j) => !used[j] && t === tok);
    if (i >= 0) { used[i] = true; pos[i] = oi; }
  });
  let last = -1;
  let eps = 0;
  const keys = out.map((_, i) => {
    if (pos[i] >= 0) { last = pos[i]; eps = 0; return last; }
    eps += 1e-3;
    return last + eps;
  });
  return out.map((t, i) => [keys[i], i, t]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
}

/** Decode a pasted block into an editable profile that remembers the original token order. */
export function profileFromBlock(text) {
  const { version, tokens } = parseBlock(text);
  const profile = profileFromTokens(tokens);
  profile.tokenOrder = tokens;
  return { version, tokens, profile };
}

/** Token string → Token for validation: leading scope, then the rest as one expression. */
export function tokenFromString(s) {
  const m = s.match(/^(\^@|\^{1,3}|@{1,3})?(.*)$/s);
  return J.newToken({ scope: m[1] || "", expr: m[2] });
}

/** Validate final token strings; returns { errors: [...], warnings: [...], perToken: [msg|null] }. */
export function checkTokens(strings) {
  const perToken = strings.map((s) => {
    try { J.validateToken(tokenFromString(s)); return null; } catch (e) { return e.message; }
  });
  const errors = [];
  if (strings.length < 3) errors.push(`A block needs at least three tokens (you have ${strings.length}).`);
  perToken.forEach((e, i) => { if (e) errors.push(`Token ${i + 1} (${strings[i]}): ${e}`); });
  const size = new TextEncoder().encode(strings.join(" ")).length;
  const warnings = size > J.SizeLimit ? [`The block content is ${size} bytes; the recommended maximum is ${J.SizeLimit}.`] : [];
  return { errors, warnings, perToken };
}
