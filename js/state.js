// Profile ⇄ URL fragment. Only fields that differ from a fresh profile are stored, base64url-encoded,
// so links stay short. The fragment never reaches the server.
import * as J from "./jewcode.js";

function diff(value, base) {
  if (Array.isArray(value)) return JSON.stringify(value) === JSON.stringify(base) ? undefined : value;
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const d = diff(v, base ? base[k] : undefined);
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value === base ? undefined : value;
}

function merge(base, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch === undefined ? base : patch;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = base && typeof base[k] === "object" && base[k] !== null && !Array.isArray(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

const toB64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

// Additions and nuances are stored per item, minus their defaults; trailing "nothing more" slots are dropped
// (the chain stops at the first empty slot anyway).
function compact(profile) {
  const p = structuredClone(profile);
  const additions = {};
  for (const [cat, list] of Object.entries(p.additions || {})) {
    const items = (list || []).map((a) => diff(a, J.newAddition()) || {});
    while (items.length && (!items.at(-1).operator || items.at(-1).operator === J.Operator.None)) items.pop();
    if (items.length) additions[cat] = items;
  }
  p.additions = additions;
  const nuances = {};
  for (const [cat, n] of Object.entries(p.nuances || {})) {
    const d = diff(n, J.newNuance());
    if (d) nuances[cat] = d;
  }
  p.nuances = nuances;
  return p;
}

export function encodeProfile(profile) {
  return toB64(JSON.stringify(diff(compact(profile), J.newProfile()) || {}));
}

export function decodeProfile(encoded) {
  const patch = JSON.parse(fromB64(encoded));
  const p = merge(J.newProfile(), patch);
  // nested objects that newProfile() starts empty
  p.familyContext = { ...J.newContext(), ...p.familyContext };
  p.communityContext = { ...J.newContext(), ...p.communityContext };
  p.additions = Object.fromEntries(Object.entries(p.additions || {}).map(([k, list]) => [k, list.map((a) => J.newAddition(a))]));
  p.nuances = Object.fromEntries(Object.entries(p.nuances || {}).map(([k, n]) => [k, { ...J.newNuance(), ...n }]));
  return p;
}

export function profileFromHash(hash = location.hash) {
  const m = hash.match(/[#&]p=([A-Za-z0-9_-]*)/);
  if (!m) return null;
  try { return decodeProfile(m[1]); } catch { return null; }
}

export const createLink = (profile) => new URL("create.html#p=" + encodeProfile(profile), location.href).href;
