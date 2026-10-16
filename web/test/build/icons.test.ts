import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const icons = new URL("../../public/icons/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8"),
) as { icons: { src: string; sizes: string; type: string }[] };

function pngSize(name: string): string {
  const bytes = readFileSync(new URL(name, icons));
  expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
  // The IHDR chunk follows the 8-byte signature and the chunk's length and type.
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe("icons", () => {
  it("the copied SVG is docs/icon.svg, byte for byte", () => {
    const copy = readFileSync(new URL("icon.svg", icons));
    const original = readFileSync(new URL("../../../docs/icon.svg", import.meta.url));
    expect(copy.equals(original)).toBe(true);
  });

  it("each PNG is the size the manifest says", () => {
    const pngs = manifest.icons.filter((icon) => icon.type === "image/png");
    expect(pngs.length).toBeGreaterThan(0);
    for (const icon of pngs) expect(pngSize(icon.src.replace("icons/", ""))).toBe(icon.sizes);
  });

  it("the iPhone touch icon is 180 by 180", () => {
    expect(pngSize("apple-touch-icon.png")).toBe("180x180");
  });
});
