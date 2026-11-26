// The pages load dist/*.js (classic scripts, so they work over file://). Keep them in sync with js/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("dist/ bundles are up to date (run: npm run build)", () => {
  const r = spawnSync(process.execPath, ["scripts/bundle.mjs", "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});
