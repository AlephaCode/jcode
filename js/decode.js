// Decode page: explain a pasted block token by token, validate it, and hand it to the Create page for editing.
import * as J from "./jewcode.js";
import { profileFromBlock, checkTokens } from "./parse.js";
import { createLink } from "./state.js";
import { $, h } from "./ui.js";

const NAMES = Object.fromEntries(J.codes().filter((c) => /^[A-Z][a-z]*$/.test(c.value)).map((c) => [c.value, c.label]));
Object.assign(NAMES, { B: "Background", D: "Denomination", E: "Heritage", Di: "Diet", "B?": "Background unknown or complicated",
  "B#": "Background: decline to state", "D?": "Unaffiliated or unknown", "D#": "Denomination: decline to state",
  "E?": "Heritage unknown", "E#": "Heritage: decline to state" });

const SUB_NAMES = {};
for (const c of J.orthodoxSubSpecifiers()) SUB_NAMES["O:" + c.value] = c.label;
for (const c of J.hasidicDynasties()) SUB_NAMES["Ha:" + c.value] = c.label;
for (const c of J.argumentsFor("Di").options) SUB_NAMES["Di:" + c.value] = c.label;
for (const c of J.languageSubSpecifiers()) SUB_NAMES["Lg:" + c.value] = c.label;
for (const c of J.argumentsFor("He").options) SUB_NAMES["He:" + c.value] = c.label;
for (const c of J.argumentsFor("Bc").options) SUB_NAMES["Bc:" + c.value] = `via ${c.label}`;

const MODS = {
  "+": ["positive", "strongly positive", "very strongly positive"],
  "-": ["negative", "strongly negative", "very strongly negative"],
  "~": ["approximate", "very approximate", "extremely hedged"],
  "?": ["uncertain", "very uncertain", "deeply uncertain"],
  "*": ["complicated", "really complicated", "don't even ask"],
  "!": ["intense", "very intense", "extremely intense"],
  "#": ["decline to state", "firmly decline", "how dare you ask"],
};
const SCOPES = {
  "^": "my immediate family", "^^": "my extended family", "^^^": "my ancestral heritage",
  "@": "my immediate community", "@@": "my broader community", "@@@": "the wider Jewish world",
  "^@": "my family's community",
};

const describeMods = (run) => (run.match(/(.)\1*/g) || []).map((m) => (MODS[m[0]] ? MODS[m[0]][Math.min(m.length, 3) - 1] : m)).join(", ");

// Best-effort reading: codes, modifiers, operators and scopes in order. Not a full precedence parser.
function explain(tok) {
  const out = [];
  const lex = tok.match(/\^@|\^{1,3}|@{1,3}|[A-Z][a-z]*|[+\-~?*!#]+|[:/|&<>\[\]()]|./g) || [];
  let parent = null;
  let afterColon = false;
  let layered = 0;
  for (let i = 0; i < lex.length; i++) {
    const x = lex[i];
    const next = lex[i + 1];
    if (SCOPES[x]) { out.push(["scope", `in ${SCOPES[x]}:`]); continue; }
    if (/^[A-Z]/.test(x)) {
      // B?, D#, … are single codes
      if (/^[BDE]$/.test(x) && next && /^[?#]/.test(next)) {
        out.push(["code", NAMES[x + next[0]]]);
        if (next.length > 1) out.push(["mod", describeMods(next.slice(1))]);
        i++;
        continue;
      }
      if (afterColon && parent) {
        out.push(["code", SUB_NAMES[`${parent}:${x}`] || SUB_NAMES[`Ha:${x}`] || `sub-type ${x}`]);
        if (x === "Ha") parent = "Ha";
      } else {
        out.push(["code", NAMES[x] || `unknown code ${x}`]);
        parent = x;
      }
      continue;
    }
    afterColon = false;
    if (/^[+\-~?*!#]+$/.test(x)) {
      const prefix = next && (/^[A-Z\[]/.test(next) || SCOPES[next]);
      out.push(["mod", (prefix ? "importance: " : "") + describeMods(x)]);
      continue;
    }
    switch (x) {
      case ":": out.push(["op", "specifically"]); afterColon = true; break;
      case "/": out.push(["op", "blended with"]); break;
      case "|": out.push(["op", next ? "or, depending on context," : "depending on context"]); break;
      case "&": out.push(["op", "and"]); break;
      case "<": out.push(["op", "as a foundation, with additions from"]); layered++; break;
      case ">":
        if (layered) { layered--; break; }
        out.push(["op", i === 0 ? "becoming" : next ? "→ now" : "(that was before; now unspecified)"]);
        break;
      case "[": out.push(["op", "("]); break;
      case "]": out.push(["op", ")"]); break;
      case "(": out.push(["op", "except sometimes:"]); break;
      case ")": break;
      default: out.push(["bad", `unexpected "${x}"`]);
    }
  }
  return out;
}

function render() {
  const raw = $("#input").value;
  const out = $("#result");
  out.replaceChildren();
  if (!raw.trim()) { $("#edit").hidden = true; return; }

  const { version, tokens, profile } = profileFromBlock(raw);
  const { errors, warnings, perToken } = checkTokens(tokens);
  const extras = new Set(profile.extraTokens);

  const mapped = tokens.filter((t) => !extras.has(t)).length;
  out.append(h("p", { class: "summary" },
    `${tokens.length} token${tokens.length === 1 ? "" : "s"}`,
    version ? ` · version ${version}` : " · no version header",
    ` · ${mapped} map to the Create questions`,
    profile.extraTokens.length ? `, ${profile.extraTokens.length} will be kept exactly as written` : ""));
  if (version && version !== J.Version1) out.append(h("p", { class: "warn", text: `This page knows version ${J.Version1}; this block says ${version}.` }));
  if (errors.length) out.append(h("ul", { class: "error" }, errors.map((e) => h("li", { text: e }))));
  if (warnings.length) out.append(h("p", { class: "warn", text: warnings.join(" ") }));

  out.append(h("table", { class: "dec" },
    h("thead", {}, h("tr", {}, h("th", { text: "Token" }), h("th", { text: "Reading" }), h("th", { text: "In Create" }))),
    h("tbody", {}, tokens.map((t, i) => h("tr", { class: perToken[i] ? "invalid" : "" },
      h("th", { scope: "row" }, h("code", { text: t })),
      h("td", {},
        explain(t).map(([k, text]) => (k === "code" ? h("strong", { text }) : k === "mod" ? h("em", { text: `(${text})` }) : h("span", { class: k, text }))).flatMap((n) => [n, " "]),
        perToken[i] ? h("div", { class: "bad small", text: `Not valid: ${perToken[i]}` }) : null),
      h("td", { class: "small muted", text: extras.has(t) ? "kept as written" : "answers a question" }))))));

  out.append(h("p", { class: "muted small", text: "Readings are best-effort. Per the spec, levels are each person's own subjective sense and can't be compared between people." }));

  const edit = $("#edit");
  edit.hidden = false;
  edit.href = createLink(profile);
}

// Open a block passed in the fragment (#b=<base64url>), e.g. from the Create page.
function loadFromHash() {
  const m = location.hash.match(/[#&]b=([A-Za-z0-9_-]+)/);
  if (!m) return;
  try {
    const text = new TextDecoder().decode(Uint8Array.from(atob(m[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
    $("#input").value = text;
  } catch { /* ignore a malformed link */ }
}

loadFromHash();
$("#input").addEventListener("input", render);
for (const btn of document.querySelectorAll("[data-example]")) {
  btn.addEventListener("click", () => { $("#input").value = EXAMPLES[btn.dataset.example]; render(); });
}
render();

const EXAMPLES = {
  spec: `-----BEGIN JEW CODE BLOCK-----
Version: 1.0

Bj O+ K+ Sh+ Ho- Pr+ He:Mo+ Tx+ Lg:HeYi Cm+ Cu++ Rl+ G+ Il+ Z?

-----END JEW CODE BLOCK-----`,
  complex: `-----BEGIN JEW CODE BLOCK-----
Version: 1.0

Bj ^O @C R+ ^As|Mi K+(-) Sh+|Sh- Ho+ Cu++ Il*! +++Z?

-----END JEW CODE BLOCK-----`,
};
