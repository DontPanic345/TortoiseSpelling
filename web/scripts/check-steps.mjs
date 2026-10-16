// The web runner's device-free step check: `bddgen` fails on a feature step with no definition,
// and `bddgen export --unused-steps` lists definitions no feature uses (it exits 0 either way,
// so this script fails when the list isn't empty). Needs no browser.
import { spawnSync } from "node:child_process";

const config = ["-c", "playwright.specs.config.ts"];
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function bddgen(args) {
  return spawnSync(npx, ["bddgen", ...args, ...config], { encoding: "utf8", shell: process.platform === "win32" });
}

const generated = bddgen([]);
if (generated.status !== 0) {
  process.stdout.write(generated.stdout);
  process.stderr.write(generated.stderr);
  console.error("\n✗ A feature step has no definition in web/steps/.");
  process.exit(1);
}

const unused = bddgen(["export", "--unused-steps"]);
const output = `${unused.stdout}${unused.stderr}`;
if (unused.status !== 0) {
  process.stdout.write(output);
  process.exit(1);
}
const count = /Unused steps \((\d+)\)/.exec(output);
if (!count || count[1] !== "0") {
  process.stdout.write(output);
  console.error("\n✗ A step definition in web/steps/ is used by no feature.");
  process.exit(1);
}
console.log("✓ Every step is defined and used.");
