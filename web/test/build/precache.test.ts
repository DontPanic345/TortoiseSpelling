import { describe, expect, it } from "vitest";
import { precacheManifest, type BuiltFile } from "../../build/precache";

const files: BuiltFile[] = [
  { name: "index.html", source: "<html></html>" },
  { name: "assets/index-abc.js", source: "console.log(1)" },
  { name: "assets/index-abc.js.map", source: "{}" },
  { name: "icons/icon.svg", source: new Uint8Array([1, 2, 3]) },
  { name: "sw.js", source: "old" },
];

describe("precacheManifest", () => {
  it("lists the scope and every file, but not sw.js or source maps", () => {
    expect(precacheManifest(files).files).toEqual([
      "./",
      "./assets/index-abc.js",
      "./icons/icon.svg",
      "./index.html",
    ]);
  });

  it("gives a 12 digit hex version", () => {
    expect(precacheManifest(files).version).toMatch(/^[0-9a-f]{12}$/);
  });

  it("changes the version when one byte of one file changes", () => {
    const changed = files.map((file) =>
      file.name === "assets/index-abc.js" ? { ...file, source: "console.log(2)" } : file,
    );
    expect(precacheManifest(changed).version).not.toBe(precacheManifest(files).version);
  });

  it("changes the version when a file is renamed", () => {
    const renamed = files.map((file) =>
      file.name === "index.html" ? { ...file, name: "other.html" } : file,
    );
    expect(precacheManifest(renamed).version).not.toBe(precacheManifest(files).version);
  });

  it("ignores the order of the input", () => {
    expect(precacheManifest([...files].reverse())).toEqual(precacheManifest(files));
  });

  it("ignores source maps and the old worker when working out the version", () => {
    const others = files.map((file) => (file.name.endsWith(".map") || file.name === "sw.js" ? { ...file, source: "x" } : file));
    expect(precacheManifest(others)).toEqual(precacheManifest(files));
  });
});
