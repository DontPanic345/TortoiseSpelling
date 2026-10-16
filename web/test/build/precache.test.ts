import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { serviceWorkerSource, type BuiltFile } from "../../build/precache";

const template = readFileSync(new URL("../../sw-template.js", import.meta.url), "utf8");

const files: BuiltFile[] = [
  { name: "index.html", source: "<html></html>" },
  { name: "assets/index-abc.js", source: "console.log(1)" },
  { name: "assets/index-abc.js.map", source: "{}" },
  { name: "icons/icon.svg", source: new Uint8Array([1, 2, 3]) },
  { name: "sw.js", source: "old" },
];

function listed(output: string): string[] {
  const match = /const FILES = (\[.*\]);/.exec(output);
  return JSON.parse(match?.[1] ?? "[]") as string[];
}

function versionOf(output: string): string {
  return /const VERSION = "([0-9a-f]+)";/.exec(output)?.[1] ?? "";
}

describe("serviceWorkerSource", () => {
  it("lists the scope and every file, but not sw.js or source maps", () => {
    expect(listed(serviceWorkerSource(template, files))).toEqual([
      "./",
      "./assets/index-abc.js",
      "./icons/icon.svg",
      "./index.html",
    ]);
  });

  it("leaves no placeholder behind", () => {
    const output = serviceWorkerSource(template, files);
    expect(output).not.toContain("__FILES__");
    expect(output).not.toContain("__VERSION__");
    expect(versionOf(output)).toMatch(/^[0-9a-f]{12}$/);
  });

  it("changes the version when one byte of one file changes", () => {
    const changed = files.map((file) =>
      file.name === "assets/index-abc.js" ? { ...file, source: "console.log(2)" } : file,
    );
    expect(versionOf(serviceWorkerSource(template, changed))).not.toBe(
      versionOf(serviceWorkerSource(template, files)),
    );
  });

  it("changes the version when a file is renamed", () => {
    const renamed = files.map((file) =>
      file.name === "index.html" ? { ...file, name: "other.html" } : file,
    );
    expect(versionOf(serviceWorkerSource(template, renamed))).not.toBe(
      versionOf(serviceWorkerSource(template, files)),
    );
  });

  it("ignores the order of the input", () => {
    expect(serviceWorkerSource(template, [...files].reverse())).toBe(
      serviceWorkerSource(template, files),
    );
  });

  it("ignores source maps and the old worker when working out the version", () => {
    const others = files.map((file) => (file.name.endsWith(".map") || file.name === "sw.js" ? { ...file, source: "x" } : file));
    expect(serviceWorkerSource(template, others)).toBe(serviceWorkerSource(template, files));
  });
});
