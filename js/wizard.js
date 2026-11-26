// Create page: the question flow of jewcodegen's TUI wizard (pkg/jcg/wizard), one question per page.
// Question texts and option labels follow form.go; sequencing follows model.go (stages → "add more" terms → fine-tune).
import * as J from "./jewcode.js";
import { outputTokens, checkTokens } from "./parse.js";
import { encodeProfile, profileFromHash } from "./state.js";
import { $, h, copyText, flash } from "./ui.js";

const C = J.Category;
const Op = J.Operator;

const CATEGORIES = [
  [C.Background, "Background"], [C.Denomination, "Denomination"], [C.Heritage, "Heritage"],
  [C.Kashrut, "Kashrut"], [C.Shabbat, "Shabbat"], [C.Holiday, "Holidays"], [C.Prayer, "Prayer"],
  [C.Dietary, "Dietary"], [C.Hebrew, "Hebrew"], [C.Textual, "Textual literacy"], [C.Language, "Languages"],
  [C.Community, "Community involvement"], [C.Cultural, "Cultural identification"], [C.Religious, "Religious identification"],
  [C.God, "Relationship to G-d"], [C.Israel, "Relationship to Israel"], [C.Zionism, "Zionism"],
];
const labelOf = (key) => (CATEGORIES.find(([k]) => k === key) || [key, key])[1];

/* ---------------- options (form.go) ---------------- */

const opt = (label, value) => ({ label, value });
const codeOption = (c) => opt(`${c.value} — ${c.label}`, c.value);
const categoryOptions = (cat) => [opt("Omit (not relevant)", ""), ...J.codesForCategory(cat).map(codeOption)];
const denominationOptions = (none) => [opt(none, ""), ...J.codesForCategory(C.Denomination).filter((c) => !J.isDisclosureCode(c.value)).map(codeOption)];
const conversionPathOptions = () => [
  opt("Not specified", ""),
  ...J.codesForCategory(C.Denomination).filter((c) => !J.isDisclosureCode(c.value)).map((c) => opt(`Bc:${c.value} — through the ${c.label} movement`, c.value)),
  ...J.codesForCategory(C.Heritage).filter((c) => !J.isDisclosureCode(c.value)).map((c) => opt(`Bc:${c.value} — following the ${c.label} tradition`, c.value)),
];
const subSpecifierOptions = (none, list) => [opt(none, ""), ...list.map(codeOption)];
const orthodoxSubtypeOptions = () => [...subSpecifierOptions("No subtype", J.orthodoxSubSpecifiers()), opt("Satmar Hasidic", "HaSat"), opt("Breslov Hasidic", "HaBz")];
const levelOptions = () => [
  opt("Omit (not relevant)", null),
  opt("No modifier", ""),
  opt("+ — positive / observant", "+"),
  opt("++ — strongly positive", "++"),
  opt("+++ — very strongly positive", "+++"),
  opt("- — negative / loosely", "-"),
  opt("-- — strongly negative", "--"),
  opt("--- — very strongly negative", "---"),
  opt("~ — approximate, -ish", "~"),
  opt("? — uncertain, questioning", "?"),
  opt("* — complicated, not on a spectrum", "*"),
  opt("# — decline to state", "#"),
];
const positionOptions = () => levelOptions().slice(1);
const previousOptions = () => [opt("No change", null), ...positionOptions()];
const exceptionOptions = () => [opt("No exceptions", null), ...levelOptions().slice(2)];
const additionLevelOptions = () => [opt("No modifier", null), ...levelOptions().slice(2)];
const groupModifierOptions = () => [
  opt("No modifier", null), opt("+ — positive", "+"), opt("++ — strongly positive", "++"), opt("+++ — very strongly positive", "+++"),
  opt("- — negative", "-"), opt("-- — strongly negative", "--"), opt("--- — very strongly negative", "---"),
  opt("~ — approximate / -ish", "~"), opt("? — uncertain", "?"), opt("* — complicated", "*"), opt("# — decline to state", "#"),
];
const salienceOptions = () => [
  opt("Not specified", null), opt("+ — somewhat central", "+"), opt("++ — very central", "++"), opt("+++ — core to who I am", "+++"),
  opt("~ — approximately; not sure the label fits me", "~"), opt("? — questioning whether it is relevant to me", "?"),
];
const intensityOptions = () => [opt("Not specified", 0), opt("! — intense", 1), opt("!! — very intense", 2), opt("!!! — extremely intense", 3)];
const additionScopeOptions = () => [
  opt("Mine (no scope)", ""), opt("^ — my family's", "^"), opt("^^ — my extended family's", "^^"), opt("^^^ — ancestral", "^^^"),
  opt("@ — my community's", "@"), opt("@@ — my broader community's", "@@"), opt("@@@ — the widest Jewish context", "@@@"),
  opt("^@ — my family's community", "^@"),
];
const SKIP = "skip";
const familyScopeOptions = () => [
  opt("^ — parents, siblings, immediate family", "^"), opt("^^ — grandparents, extended family", "^^"),
  opt("^^^ — ancestral heritage", "^^^"), opt("Skip this section (no family context)", SKIP),
];
const communityScopeOptions = () => [
  opt("@ — immediate community: shul, chavurah, neighborhood", "@"), opt("@@ — broader community: movement, region", "@@"),
  opt("@@@ — widest context: klal yisrael", "@@@"), opt("^@ — the community your family was part of", "^@"),
  opt("Skip this section (no communal context)", SKIP),
];
const operatorOptions = () => [
  opt("Nothing more", Op.None),
  opt("Together, one unified identity (OC, ShHo, Bj^Bc)", Op.Compound),
  opt("And, explicitly (O&C)", Op.And),
  opt("Somewhere in between, unsettled (O/C, K+/K-)", Op.Blend),
  opt("Depends on the context (O|C, Sh+|Sh-)", Op.Contextual),
  opt("Changed over time, from … to (O>R, K->K+)", Op.Transition),
  opt("A foundation with additions (O<R>)", Op.Additive),
  opt("Specifically, a sub-specifier (O:Mo)", Op.SubSpecify),
  opt("A separate token (Sh~ @Sh++)", Op.Separate),
  opt("Group part of it in square brackets ([~O]|C, [?K]!)", Op.Group),
];

/* ---------------- state ---------------- */

let profile = J.newProfile();
let step = { kind: "main", stage: 0 };
let fieldKey = null;
let history = [];
let error = "";
let wrap = true;

const specified = (c) => c !== "" && !J.isDisclosureCode(c);
const categoryPreview = (key) => J.categoryTokens(profile, key).map(J.tokenString).join(" ") || "(nothing yet)";

/* ---------------- field constructors ---------------- */

const one = (o) => ({ kind: "one", ...o });
const any = (o) => ({ kind: "any", ...o });
const input = (o) => ({ kind: "input", ...o });
const note = (o) => ({ kind: "note", ...o });
const levelQ = (key, title, field, desc) => one({ key, title, desc, options: levelOptions, get: () => profile[field], set: (v) => (profile[field] = v) });

function validateSubSpecifier(value) {
  if (value && !/^[A-Z][A-Za-z]*$/.test(value)) {
    return /^[A-Z]/.test(value) ? "Sub-specifiers may only contain ASCII letters." : "Sub-specifiers start with a capital letter (CamelCase).";
  }
  return "";
}

/* ---------------- stages (form.go) ---------------- */

const STAGES = [
  { label: "Background", categories: [C.Background], build: backgroundFields },
  { label: "Denomination", categories: [C.Denomination], build: denominationFields },
  { label: "Heritage", categories: [C.Heritage], build: heritageFields },
  { label: "Practice", categories: [C.Kashrut, C.Shabbat, C.Holiday, C.Prayer, C.Dietary], build: practiceFields },
  { label: "Knowledge", categories: [C.Hebrew, C.Textual, C.Language], build: knowledgeFields },
  { label: "Identity", categories: [C.Community, C.Cultural, C.Religious, C.God, C.Israel, C.Zionism], build: identityFields },
  { label: "Family & community", categories: [], build: contextFields },
];

function backgroundFields() {
  return [
    note({ key: "intro", title: "Build your Jew Code identity",
      desc: "Choose only what you want to share. Omit what is not relevant to you — absence is not negation (- is a stance). " +
        "~ means approximate / -ish, ? means uncertain, * complicated, # decline to state." }),
    one({ key: "bg", title: "Jewish background",
      desc: "B# is always a legitimate answer: converts are under no obligation to disclose. Next you can refine it, e.g. Bj^Bc (born Jewish, parents were converts).",
      options: () => categoryOptions(C.Background), get: () => profile.background, set: (v) => (profile.background = v) }),
    one({ key: "conv", title: "Conversion", hidden: () => profile.background !== "Bc",
      options: () => [
        opt("Convert (Bc)", J.Conversion.Convert), opt("In process of conversion (>Bc)", J.Conversion.InProgress),
        opt("Considering conversion (?>Bc)", J.Conversion.Considering), opt("Conversion complete — simply Jewish now (Bc>Bj)", J.Conversion.Complete),
      ],
      get: () => profile.conversion, set: (v) => (profile.conversion = v) }),
    one({ key: "convpath", title: "Conversion path (optional)", hidden: () => profile.background !== "Bc",
      desc: "The movement you converted through, or the tradition you follow (e.g. Bc:C, Bc:As).",
      options: conversionPathOptions, get: () => profile.conversionPath, set: (v) => (profile.conversionPath = v) }),
  ];
}

function denominationFields() {
  const hasOrthodox = () => (profile.denomination === "O" || profile.secondaryDenomination === "O") && specified(profile.denomination);
  const noDenomination = () => !specified(profile.denomination);
  return [
    one({ key: "den", title: "Denomination or affiliation",
      desc: "You can add a refinement next, e.g. O:Mo (Modern Orthodox) or O<R> (Orthodox foundation with Reform additions).",
      options: () => categoryOptions(C.Denomination), get: () => profile.denomination, set: (v) => (profile.denomination = v) }),
    one({ key: "denlvl", title: "How do you relate to it?", hidden: noDenomination, options: positionOptions,
      get: () => profile.denominationLevel, set: (v) => (profile.denominationLevel = v) }),
    one({ key: "den2", title: "Another denomination that is part of your identity (optional)", hidden: noDenomination,
      options: () => denominationOptions("None"), get: () => profile.secondaryDenomination, set: (v) => (profile.secondaryDenomination = v) }),
    one({ key: "denprev", title: "Previous denomination (optional)", hidden: noDenomination,
      desc: "Renders a transition, e.g. O>R (was Orthodox, now Reform).",
      options: () => denominationOptions("No change"), get: () => profile.previousDenomination, set: (v) => (profile.previousDenomination = v) }),
    one({ key: "denprevsub", title: "Previous Orthodox sub-movement (optional)", hidden: () => profile.previousDenomination !== "O",
      options: orthodoxSubtypeOptions, get: () => profile.previousOrthodoxSubtype, set: (v) => (profile.previousOrthodoxSubtype = v) }),
    one({ key: "dencomb", title: "How do the two denominations relate?",
      hidden: () => !specified(profile.denomination) || !specified(profile.secondaryDenomination),
      options: () => [
        opt("Separate affiliations (O C)", "separate"), opt("One unified identity, e.g. Conservadox (OC)", "compound"),
        opt("Somewhere in between, unsettled (O/C)", "blend"), opt("Depends on the context (O|C)", "contextual"),
        opt("A foundation with additions (O<C>)", "additive"),
      ],
      get: () => profile.denominationCombination, set: (v) => (profile.denominationCombination = v) }),
    one({ key: "densub", title: "Orthodox sub-movement (optional)", hidden: () => !hasOrthodox(),
      options: () => subSpecifierOptions("None", J.orthodoxSubSpecifiers()), get: () => profile.orthodoxSubtype, set: (v) => (profile.orthodoxSubtype = v) }),
    input({ key: "dendyn", title: "Hasidic dynasty (optional)", hidden: () => !hasOrthodox() || profile.orthodoxSubtype !== "Ha",
      desc: "A CamelCase sub-specifier, e.g. Sat (Satmar) or Bz (Breslov); renders O:HaSat.",
      suggestions: () => J.hasidicDynasties().map((c) => c.value), validate: validateSubSpecifier,
      get: () => profile.hasidicDynasty, set: (v) => (profile.hasidicDynasty = v) }),
  ];
}

function heritageFields() {
  return [
    any({ key: "her", title: "Heritage",
      desc: "Select all that apply; leave empty to omit. You can refine this next, e.g. ^As|Mi (Ashkenazi on one side of the family, Mizrahi on the other).",
      options: () => categoryOptions(C.Heritage).slice(1),
      validate: (v) => (v.length > 1 && v.some(J.isDisclosureCode) ? "Unknown (E?) and decline to state (E#) cannot be combined with other heritages." : ""),
      get: () => profile.heritage, set: (v) => (profile.heritage = v) }),
    one({ key: "hercomb", title: "How do your heritages combine?",
      hidden: () => profile.heritage.length < 2 || profile.heritage.some(J.isDisclosureCode),
      options: () => [
        opt("Separate heritages (As Se)", "separate"), opt("Fully both, one compound identity (AsSe)", "compound"),
        opt("Blended, integrated and not separable (As/Se)", "blend"), opt("By context or by side of the family (As|Se)", "contextual"),
      ],
      get: () => profile.heritageCombination, set: (v) => (profile.heritageCombination = v) }),
    one({ key: "herscope", title: "Whose heritage is this?", hidden: () => profile.heritage.length === 0,
      desc: "E.g. ^As|Se: Ashkenazi on one side of the family, Sephardi on the other.",
      options: () => [opt("Mine (no scope)", ""), opt("^ — my family's", "^"), opt("^^ — my extended family's", "^^"), opt("^^^ — ancestral", "^^^"), opt("@ — my community's", "@")],
      get: () => profile.heritageScope, set: (v) => (profile.heritageScope = v) }),
  ];
}

function practiceFields() {
  return [
    levelQ("k", "Kashrut", "kashrut", "After these questions you can refine any answer, e.g. Sh+|Sh- (different Shabbat observance in different contexts)."),
    levelQ("sh", "Shabbat observance", "shabbat"),
    levelQ("ho", "Holiday observance", "holidays"),
    levelQ("pr", "Prayer practice", "prayer", "Independent of belief in G-d."),
    any({ key: "di", title: "Dietary practices", desc: "Separate from kashrut; combined into one token (e.g. Di:VgGf). Leave empty to omit.",
      options: () => categoryOptions(C.Dietary).slice(1), get: () => profile.dietary, set: (v) => (profile.dietary = v) }),
  ];
}

function knowledgeFields() {
  return [
    one({ key: "he", title: "Hebrew literacy",
      desc: "After these questions you can refine any answer, e.g. Lg:He+++&Lg:Yi~ (Hebrew and Yiddish at different levels).",
      options: () => categoryOptions(C.Hebrew), get: () => profile.hebrew, set: (v) => (profile.hebrew = v) }),
    one({ key: "helvl", title: "Hebrew level", hidden: () => profile.hebrew === "", options: positionOptions,
      get: () => profile.hebrewLevel, set: (v) => (profile.hebrewLevel = v) }),
    levelQ("tx", "Textual literacy (Torah, Talmud, commentaries)", "textual"),
    any({ key: "lg", title: "Jewish languages", desc: "Combined into one token, e.g. Lg:HeYi. Leave empty to omit.",
      options: () => J.languageSubSpecifiers().map((c) => opt(c.label, c.value)), get: () => profile.languages, set: (v) => (profile.languages = v) }),
    one({ key: "lglvl", title: "Language level", hidden: () => profile.languages.length === 0, options: positionOptions,
      get: () => profile.languageLevel, set: (v) => (profile.languageLevel = v) }),
  ];
}

function identityFields() {
  return [
    levelQ("cm", "Community involvement", "community", "After these questions you can refine any answer, e.g. Il+|Il- (different relationships in different contexts)."),
    levelQ("cu", "Cultural identification", "cultural"),
    levelQ("rl", "Religious identification", "religious"),
    levelQ("g", "Relationship to G-d", "god"),
    levelQ("il", "Relationship to Israel", "israel"),
    levelQ("z", "Zionism", "zionism"),
  ];
}

function contextFields() {
  const fam = () => profile.familyContext;
  const com = () => profile.communityContext;
  const scopeAccessor = (ctx) => ({
    get: () => (ctx().skipped ? SKIP : ctx().scope),
    set: (v) => { if (v === SKIP) ctx().skipped = true; else { ctx().skipped = false; ctx().scope = v; } },
  });
  const ctxLevel = (key, title, ctx, field, hidden) => one({ key, title, hidden, options: levelOptions, get: () => ctx()[field], set: (v) => (ctx()[field] = v) });
  const famSkipped = () => fam().skipped;
  const comSkipped = () => com().skipped;
  return [
    one({ key: "famscope", title: "Which family context?",
      desc: "Scoped tokens describe the environment that shaped you, alongside your own position (e.g. ^O @C R). They are figurative; omit anything that does not apply.",
      options: familyScopeOptions, ...scopeAccessor(fam) }),
    one({ key: "famden", title: "Family denomination", hidden: famSkipped, options: () => denominationOptions("Omit"),
      get: () => fam().denomination, set: (v) => (fam().denomination = v) }),
    one({ key: "famsub", title: "Family Orthodox sub-movement (optional)", hidden: () => famSkipped() || fam().denomination !== "O",
      options: orthodoxSubtypeOptions, get: () => fam().orthodoxSubtype, set: (v) => (fam().orthodoxSubtype = v) }),
    one({ key: "famlvl", title: "How strongly was your family that?", hidden: () => famSkipped() || !specified(fam().denomination),
      options: positionOptions, get: () => fam().level, set: (v) => (fam().level = v) }),
    one({ key: "famalt", title: "Different on the other side of the family?", desc: "Renders ^O|C (Orthodox on one side, Conservative on the other).",
      hidden: () => famSkipped() || !specified(fam().denomination), options: () => denominationOptions("No"),
      get: () => fam().alternative, set: (v) => (fam().alternative = v) }),
    one({ key: "famtrans", title: "Did your family later move to another denomination?", desc: "Renders ^O>C.",
      hidden: () => famSkipped() || !specified(fam().denomination), options: () => denominationOptions("No"),
      get: () => fam().transition, set: (v) => (fam().transition = v) }),
    ctxLevel("famk", "Family kashrut", fam, "kashrut", famSkipped),
    ctxLevel("famsh", "Family Shabbat observance", fam, "shabbat", famSkipped),
    ctxLevel("famho", "Family holiday observance", fam, "holidays", famSkipped),

    one({ key: "comscope", title: "Which communal context?", options: communityScopeOptions, ...scopeAccessor(com) }),
    one({ key: "comden", title: "Community denomination", hidden: comSkipped,
      desc: "What your community is, not how involved you are (that is asked separately).",
      options: () => denominationOptions("Omit"), get: () => com().denomination, set: (v) => (com().denomination = v) }),
    one({ key: "comsub", title: "Community Orthodox sub-movement (optional)", hidden: () => comSkipped() || com().denomination !== "O",
      options: orthodoxSubtypeOptions, get: () => com().orthodoxSubtype, set: (v) => (com().orthodoxSubtype = v) }),
    one({ key: "comlvl", title: "How strongly is your community that?", hidden: () => comSkipped() || !specified(com().denomination),
      options: positionOptions, get: () => com().level, set: (v) => (com().level = v) }),
    one({ key: "comalt", title: "A different community in other contexts?", desc: "Renders @O|C.",
      hidden: () => comSkipped() || !specified(com().denomination), options: () => denominationOptions("No"),
      get: () => com().alternative, set: (v) => (com().alternative = v) }),
    ctxLevel("comk", "Community kashrut", com, "kashrut", comSkipped),
    ctxLevel("comsh", "Community Shabbat observance", com, "shabbat", comSkipped),
    ctxLevel("comho", "Community holiday observance", com, "holidays", comSkipped),
  ];
}

function additionHint(category) {
  switch (category) {
    case C.Background: return "For example: Bj^Bc (born Jewish, parents were converts).";
    case C.Denomination: return "For example: O:Mo (Modern Orthodox) or O<R> (Orthodox foundation with Reform additions).";
    case C.Heritage: return "For example: ^As|Mi (Ashkenazi on one side of the family, Mizrahi on the other).";
    case C.Language: return "For example: Lg:He+++&Lg:Yi~ (Hebrew and Yiddish, at different levels).";
    case C.Israel: case C.Zionism: return "For example: Il+|Il- (different relationships in different contexts).";
    default: return "For example: X+|X- (different positions in different contexts).";
  }
}

function additionPromptField(keys) {
  if (keys.length === 1) {
    const key = keys[0];
    return one({ key: "addmore", title: `Add more to your ${labelOf(key).toLowerCase()} answer?`,
      desc: () => `So far: ${categoryPreview(key)}. ${additionHint(key)} Choose Yes to add a term now, or No to continue.`,
      hidden: () => !J.canExtend(profile, key),
      options: () => [opt("No", false), opt("Yes", true)],
      get: () => profile.extendedCategories.includes(key),
      set: (v) => {
        const has = profile.extendedCategories.includes(key);
        if (v && !has) profile.extendedCategories.push(key);
        if (!v && has) profile.extendedCategories = profile.extendedCategories.filter((c) => c !== key);
      } });
  }
  const extendable = () => CATEGORIES.filter(([k]) => keys.includes(k) && J.canExtend(profile, k));
  return any({ key: "addmore", title: "Add more to any of these answers? (optional)",
    desc: "Select any answer to refine now; select none to continue. For each selected answer, you can add any number of terms, " +
      "choosing how they combine: together, with an operator (&, /, |, >, <>), as a sub-specifier (:), in a separate token, or grouped in square brackets.",
    hidden: () => extendable().length === 0,
    options: () => extendable().map(([k, l]) => opt(l, k)),
    get: () => keys.filter((k) => profile.extendedCategories.includes(k) && J.canExtend(profile, k)),
    set: (selected) => {
      profile.extendedCategories = [...profile.extendedCategories.filter((k) => !keys.includes(k)), ...keys.filter((k) => selected.includes(k))];
    } });
}

/* ---------------- addition terms ---------------- */

function additionFields(category, index) {
  const a = () => J.addition(profile, category, index);
  const title = `${labelOf(category)}: term ${index + 1}`;
  const codeHide = () => [Op.None, Op.SubSpecify, Op.Group].includes(a().operator);
  const argDef = () => J.argumentsFor(a().code || J.categoryBaseCode(profile, category));
  const argsVisible = () => !codeHide() && argDef().options.length > 0;
  const filterArgs = (values) => (values || []).filter((v, i, arr) => v && arr.indexOf(v) === i && argDef().options.some((o) => o.value === v));
  const groupHide = () => a().operator !== Op.Group;
  return [
    one({ key: "op", title, desc: () => `So far: ${categoryPreview(category)}. Choose Nothing more to finish this category, or add another term.`,
      options: () => (J.canSubSpecify(profile, category, index) ? operatorOptions() : operatorOptions().filter((o) => o.value !== Op.SubSpecify)),
      get: () => a().operator, set: (v) => (a().operator = v) }),
    one({ key: "code", title: `${title}: which code?`, desc: "Codes from other categories can be combined too (e.g. ShHo).", hidden: codeHide,
      options: () => [opt("The same code as the answer (e.g. Sh+|Sh-)", ""), ...J.additionCodes(category).map(codeOption)],
      get: () => a().code, set: (v) => (a().code = v) }),
    any({ key: "args", title: () => argDef().label, hidden: () => !argsVisible() || !argDef().multiple,
      desc: () => (argDef().required ? "Choose at least one detail for this code." : "Choose an optional detail, or leave it unspecified."),
      options: () => argDef().options.map((o) => opt(o.label, o.value)),
      validate: (v) => (argDef().required && filterArgs(v).length === 0 ? `Select at least one ${argDef().label.toLowerCase()}.` : ""),
      get: () => filterArgs(a().arguments), set: (v) => (a().arguments = filterArgs(v)) }),
    one({ key: "arg", title: () => argDef().label, hidden: () => !argsVisible() || argDef().multiple,
      desc: () => (argDef().required ? "Choose at least one detail for this code." : "Choose an optional detail, or leave it unspecified."),
      options: () => [opt("No additional detail", ""), ...argDef().options.map((o) => opt(o.label, o.value))],
      get: () => filterArgs(a().arguments)[0] || "", set: (v) => (a().arguments = filterArgs([v])) }),
    one({ key: "scope", title: "Whose is it?", desc: "A scope marker on the term itself, e.g. Bj^Bc: born Jewish, parents were converts.",
      hidden: codeHide, options: additionScopeOptions, get: () => a().scope, set: (v) => (a().scope = v) }),
    one({ key: "level", title: "Its level", hidden: codeHide, options: additionLevelOptions, get: () => a().level, set: (v) => (a().level = v) }),
    input({ key: "sub", title: `${title}: sub-specifier`, hidden: () => a().operator !== Op.SubSpecify,
      desc: "A CamelCase refinement of the last code, e.g. Mo for O:Mo or Sat for O:Ha:Sat.",
      suggestions: () => J.argumentsFor(J.categoryBaseCode(profile, category)).options.map((o) => o.value),
      validate: validateSubSpecifier, get: () => a().subSpecifier, set: (v) => (a().subSpecifier = v) }),
    one({ key: "gscope", title: "Whose context is this group?", hidden: groupHide,
      desc: "Optional scope for the grouped term, e.g. ^[~O] applies family context to the bracketed unit.",
      options: additionScopeOptions, get: () => a().scope, set: (v) => (a().scope = v) }),
    one({ key: "gstart", title: "Which part should be grouped?", hidden: groupHide,
      desc: "Choose a trailing part to make it a unit with its own modifiers.",
      options: () => J.groupOptions(profile, category, index).map((g) => opt(g.preview, g.start)),
      get: () => a().groupStart, set: (v) => (a().groupStart = v) }),
    one({ key: "gpre", title: "Modifier inside, before the group", hidden: groupHide,
      desc: "For example, ~ inside [~O] makes the denomination approximate.",
      options: groupModifierOptions, get: () => a().groupPrefix, set: (v) => (a().groupPrefix = v) }),
    one({ key: "gpost", title: "Modifier inside, after the group", hidden: groupHide,
      desc: "For example, [As+] gives the Ashkenazi term its own positive level.",
      options: additionLevelOptions, get: () => a().groupPostfix, set: (v) => (a().groupPostfix = v) }),
    one({ key: "glevel", title: "Modifier after the group", hidden: groupHide,
      desc: "For example, [As|Mi]+ applies the level to the grouped expression.",
      options: additionLevelOptions, get: () => a().level, set: (v) => (a().level = v) }),
    one({ key: "gint", title: "Intensity after the group", hidden: groupHide,
      desc: "For example, [?K]! makes the uncertainty itself intense.",
      options: intensityOptions, get: () => a().intensity, set: (v) => (a().intensity = v) }),
  ];
}

/* ---------------- fine-tune (nuance) ---------------- */

function nuanceFields() {
  const answered = () => J.answeredCategories(profile);
  const fields = [
    any({ key: "nuanced", title: "Fine-tune any answers? (optional)",
      desc: "Select none to finish. Fine-tuning adds salience (how central it is to you, e.g. ++K), intensity (K!), a change over time (K->K+) or an exception (K+(-)).",
      hidden: () => answered().length === 0,
      options: () => CATEGORIES.filter(([k]) => answered().includes(k)).map(([k, l]) => opt(l, k)),
      get: () => profile.nuancedCategories.filter((k) => answered().includes(k)),
      set: (v) => (profile.nuancedCategories = v) }),
  ];
  for (const [key, label] of CATEGORIES) {
    const n = () => J.nuance(profile, key);
    const hidden = () => !profile.nuancedCategories.includes(key) || !answered().includes(key);
    fields.push(
      one({ key: `${key}-sal`, title: `${label}: how central is this to your identity?`, hidden, options: salienceOptions,
        get: () => n().salience, set: (v) => (n().salience = v) }),
      one({ key: `${key}-int`, title: `${label}: how intense are your feelings about it?`, hidden, options: intensityOptions,
        get: () => n().intensity, set: (v) => (n().intensity = v) }),
      one({ key: `${key}-exc`, title: `${label}: different under certain conditions?`, hidden,
        desc: "A primary position with exceptions, e.g. K+(-): kosher, but not under certain conditions.",
        options: exceptionOptions, get: () => n().exception, set: (v) => (n().exception = v) }),
    );
    if (J.supportsTransition(key)) {
      fields.push(one({ key: `${key}-prev`, title: `${label}: where were you before?`, hidden,
        desc: "Renders a change over time, e.g. K++>+++ (very kosher, becoming stricter).",
        options: previousOptions, get: () => n().previous, set: (v) => (n().previous = v) }));
    }
  }
  return fields;
}

/* ---------------- sequencing (model.go) ---------------- */

function fieldsFor(st) {
  switch (st.kind) {
    case "main": {
      const stage = STAGES[st.stage];
      const fields = stage.build();
      if (stage.categories.length) fields.push(additionPromptField(stage.categories));
      return fields;
    }
    case "addition": return additionFields(st.category, st.index);
    case "nuance": return nuanceFields();
    default: return [];
  }
}
const visibleFields = (st) => fieldsFor(st).filter((f) => !(f.hidden && f.hidden()));

function nextExtendedCategory(stageIndex, after) {
  const cats = STAGES[stageIndex].categories;
  const start = after ? cats.indexOf(after) + 1 : 0;
  return cats.slice(start).find((k) => profile.extendedCategories.includes(k) && J.canExtend(profile, k)) || null;
}
const afterStage = (i) => (i + 1 < STAGES.length ? { kind: "main", stage: i + 1 } : { kind: "nuance" });

function nextStep(cur) {
  switch (cur.kind) {
    case "main": {
      const cat = nextExtendedCategory(cur.stage, "");
      return cat ? { kind: "addition", stage: cur.stage, category: cat, index: 0 } : afterStage(cur.stage);
    }
    case "addition": {
      if (J.addition(profile, cur.category, cur.index).operator !== Op.None) return { ...cur, index: cur.index + 1 };
      const cat = nextExtendedCategory(cur.stage, cur.category);
      return cat ? { kind: "addition", stage: cur.stage, category: cat, index: 0 } : afterStage(cur.stage);
    }
    default: return { kind: "done" };
  }
}

function current() {
  return visibleFields(step).find((f) => f.key === fieldKey) || null;
}

function enter(st) {
  // skip steps without any visible question
  let guard = 0;
  while (st.kind !== "done" && visibleFields(st).length === 0 && guard++ < 200) st = nextStep(st);
  step = st;
  fieldKey = st.kind === "done" ? null : visibleFields(st)[0].key;
}

function goNext() {
  const f = current();
  if (f) {
    const msg = f.validate ? f.validate(f.get()) : "";
    if (msg) { error = msg; return render(); }
  }
  error = "";
  history.push({ step, fieldKey });
  const list = visibleFields(step);
  const i = list.findIndex((x) => x.key === fieldKey);
  if (i >= 0 && i + 1 < list.length) fieldKey = list[i + 1].key;
  else enter(nextStep(step));
  render(true, true);
}

function goBack() {
  error = "";
  while (history.length) {
    const prev = history.pop();
    if (prev.step.kind === "done") { step = prev.step; fieldKey = null; return render(true); }
    if (visibleFields(prev.step).some((f) => f.key === prev.fieldKey)) {
      step = prev.step;
      fieldKey = prev.fieldKey;
      return render(true, true);
    }
  }
}

function jump(st) {
  error = "";
  history.push({ step, fieldKey });
  enter(st);
  render(true, true);
}

/* ---------------- rendering ---------------- */

const finalTokens = () => outputTokens(profile);
const blockText = () => J.renderBlock(finalTokens(), { wrap: wrap ? 40 : 0 });

function syncHash() {
  history_replace("#p=" + encodeProfile(profile));
}
function history_replace(hash) {
  window.history.replaceState(null, "", hash);
}

function renderNav() {
  const nav = $("#steps");
  const items = [
    ...STAGES.map((s, i) => [s.label, { kind: "main", stage: i }, step.kind !== "done" && step.kind !== "nuance" && step.stage === i]),
    ["Fine-tune", { kind: "nuance" }, step.kind === "nuance"],
    ["Review", { kind: "done" }, step.kind === "done"],
  ];
  nav.replaceChildren(...items.map(([label, st, active], i) =>
    h("li", {}, h("button", { type: "button", class: active ? "active" : "", "aria-current": active ? "step" : null,
      onclick: () => jump(st) }, h("span", { class: "n", text: String(i + 1) }), label))));
}

function renderPreview() {
  const tokens = finalTokens();
  $("#block").textContent = blockText();
  $("#count").textContent = `${tokens.length} token${tokens.length === 1 ? "" : "s"}`;
  const { errors, warnings } = checkTokens(tokens);
  const status = $("#status");
  status.className = "status " + (errors.length ? "bad" : "ok");
  status.textContent = errors.length ? errors[0] : warnings[0] || "Valid DEP-0248 block.";
  const extras = profile.extraTokens || [];
  $("#extras-note").hidden = extras.length === 0;
  $("#extras-note").textContent = extras.length ? `Kept as written from your decoded block: ${extras.join(" ")}` : "";
}

// Codes per main-stage question, to point out related tokens kept verbatim from a decoded block.
const FIELD_CODES = {
  bg: ["Bj", "Bp", "Bc", "Ba", "B"], den: ["O", "C", "M", "R", "Rc", "Rn", "Hu", "S", "Pd", "Jj", "Ji", "D"],
  her: ["As", "Se", "Mi", "Ye", "Et", "It", "Ro", "In", "Ka", "Eo", "E"], k: ["K"], sh: ["Sh"], ho: ["Ho"], pr: ["Pr"],
  di: ["Di"], he: ["He"], tx: ["Tx"], lg: ["Lg"], cm: ["Cm"], cu: ["Cu"], rl: ["Rl"], g: ["G"], il: ["Il"], z: ["Z"],
};
function relatedExtras(key) {
  const want = FIELD_CODES[key];
  if (!want || step.kind !== "main") return [];
  // ignore sub-specifiers (Lg:He is a language, not Hebrew literacy)
  return (profile.extraTokens || []).filter((t) => (t.replace(/:[A-Za-z0-9]+/g, "").match(/[A-Z][a-z]*/g) || []).some((c) => want.includes(c)));
}

function optionValueEq(a, b) {
  return a === b || (a == null && b == null);
}

function renderField(f) {
  const title = typeof f.title === "function" ? f.title() : f.title;
  const desc = typeof f.desc === "function" ? f.desc() : f.desc;
  const stageLabel = step.kind === "main" ? STAGES[step.stage].label
    : step.kind === "addition" ? `${STAGES[step.stage].label} · adding to ${labelOf(step.category)}`
    : "Fine-tune";
  const body = h("div", { class: "qbody" });
  const kindTag = { one: "◉ Pick one", any: "☑ Pick any", input: "Type", note: "" }[f.kind];

  if (f.kind === "one") {
    const options = f.options();
    if (!options.some((o) => optionValueEq(o.value, f.get())) && options.length) f.set(options[0].value);
    const name = "q-" + f.key;
    body.append(h("div", { class: "options", role: "radiogroup" }, options.map((o, i) => {
      const id = `${name}-${i}`;
      const checked = optionValueEq(o.value, f.get());
      // Mouse/touch choice advances like Enter in the TUI; keyboard arrows only change the selection.
      return h("label", { for: id, class: checked ? "checked" : "",
        onpointerup: (ev) => { if (ev.button === 0) { f.set(o.value); syncHash(); setTimeout(goNext, 120); } } },
        h("input", { type: "radio", name, id, checked,
          onchange: () => { f.set(o.value); syncHash(); render(true); } }),
        h("span", { text: o.label }));
    })));
  } else if (f.kind === "any") {
    const options = f.options();
    body.append(h("div", { class: "options" }, options.map((o, i) => {
      const id = `q-${f.key}-${i}`;
      const checked = f.get().includes(o.value);
      return h("label", { for: id, class: checked ? "checked" : "" },
        h("input", { type: "checkbox", id, checked, onchange: (ev) => {
          const cur = f.get().filter((v) => v !== o.value);
          // keep option order stable
          const next = ev.target.checked ? options.map((x) => x.value).filter((v) => v === o.value || cur.includes(v)) : cur;
          f.set(next); syncHash(); render(true);
          document.getElementById(id)?.focus();
        } }),
        h("span", { text: o.label }));
    })));
  } else if (f.kind === "input") {
    const listId = "dl-" + f.key;
    body.append(
      h("input", { class: "text", id: "q-input", value: f.get(), list: listId, autocomplete: "off", spellcheck: "false",
        oninput: (ev) => { f.set(ev.target.value.trim()); syncHash(); renderPreview(); } }),
      h("datalist", { id: listId }, (f.suggestions ? f.suggestions() : []).map((s) => h("option", { value: s }))));
  }

  return h("section", { class: "qcard" },
    h("div", { class: "qmeta" }, h("span", { text: stageLabel }), kindTag ? h("span", { class: "kind", text: kindTag }) : null),
    h("h2", { id: "qtitle", text: title }),
    desc ? h("p", { class: "qdesc", text: desc }) : null,
    relatedExtras(f.key).length ? h("p", { class: "kept" },
      "Your decoded block also has ", ...relatedExtras(f.key).flatMap((t, i) => [i ? " " : "", h("code", { text: t })]),
      ", which is kept exactly as written. You can change or remove it on the Review page.") : null,
    body,
    error ? h("p", { class: "error", role: "alert", text: error }) : null,
    h("div", { class: "qnav" },
      h("button", { type: "button", class: "ghost", disabled: history.length === 0, onclick: goBack, text: "← Back" }),
      h("button", { type: "button", id: "next", onclick: goNext, text: "Next →" })));
}

function renderReview() {
  const tokens = finalTokens();
  const { errors, warnings } = checkTokens(tokens);
  const extras = profile.extraTokens || [];
  return h("section", { class: "qcard review" },
    h("div", { class: "qmeta" }, h("span", { text: "Review" })),
    h("h2", { id: "qtitle", text: errors.length ? "Almost there" : "Your block is ready" }),
    h("p", { class: "qdesc", text: "Copy it from the panel, or jump to any section to change your answers." }),
    errors.length ? h("ul", { class: "error" }, errors.map((e) => h("li", { text: e }))) : null,
    warnings.length ? h("p", { class: "warn", text: warnings.join(" ") }) : null,
    h("div", { class: "editlist" },
      STAGES.map((s, i) => h("button", { type: "button", class: "ghost", onclick: () => jump({ kind: "main", stage: i }) }, `Edit ${s.label.toLowerCase()}`)),
      h("button", { type: "button", class: "ghost", onclick: () => jump({ kind: "nuance" }) }, "Edit fine-tuning")),
    h("div", { class: "field" },
      h("label", { for: "extras", text: "Extra tokens, kept exactly as written" }),
      h("input", { id: "extras", class: "text mono", value: extras.join(" "), spellcheck: "false",
        placeholder: "e.g. [G+&G-&G--]*  Sh+|Sh-",
        oninput: (ev) => { profile.extraTokens = ev.target.value.split(/\s+/).filter(Boolean); syncHash(); renderPreview(); } }),
      h("small", { class: "muted", text: "Anything the questions don't cover. Tokens from a decoded block that don't match a question show up here." })),
    h("div", { class: "qnav" },
      h("button", { type: "button", class: "ghost", disabled: history.length === 0, onclick: goBack, text: "← Back" }),
      h("button", { type: "button", class: "ghost", onclick: () => jump({ kind: "main", stage: 0 }), text: "Walk through from the start" })));
}

function render(focus = false, scroll = false) {
  renderNav();
  renderPreview();
  const main = $("#question");
  const f = current();
  main.replaceChildren(step.kind === "done" || !f ? renderReview() : renderField(f));
  if (focus) {
    const target = main.querySelector("input:checked, input.text, input") || main.querySelector("#qtitle");
    if (target) target.focus({ preventScroll: true });
    if (scroll && window.innerWidth < 900) main.scrollIntoView({ block: "start" });
  }
}

/* ---------------- boot ---------------- */

function start() {
  const loaded = profileFromHash();
  if (loaded) {
    profile = loaded;
    step = { kind: "done" };
    fieldKey = null;
  } else {
    enter({ kind: "main", stage: 0 });
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.isComposing) return;
    if (ev.target.closest && ev.target.closest("button, a, #extras")) return;
    if (step.kind === "done") return;
    ev.preventDefault();
    goNext();
  });
  $("#copy").addEventListener("click", async (ev) => flash(ev.target, (await copyText(blockText())) ? "Copied ✓" : "Copy failed"));
  $("#link").addEventListener("click", async (ev) => { syncHash(); flash(ev.target, (await copyText(location.href)) ? "Link copied ✓" : "Copy failed"); });
  $("#decode").addEventListener("click", () => {
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(J.renderBlock(finalTokens())))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    location.href = "decode.html#b=" + b64;
  });
  $("#wrap").addEventListener("change", (ev) => { wrap = ev.target.checked; renderPreview(); });
  $("#reset").addEventListener("click", () => {
    if (!confirm("Clear all your answers and start over?")) return;
    profile = J.newProfile();
    history = [];
    history_replace(location.pathname);
    enter({ kind: "main", stage: 0 });
    render(true);
  });
  render();
}

start();
