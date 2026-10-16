import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { Plugin } from "vite";

export interface BuiltFile {
  name: string;
  source: string | Uint8Array;
}

const SERVICE_WORKER = "sw.js";

function isPrecached(name: string): boolean {
  return name !== SERVICE_WORKER && !name.endsWith(".map");
}

/**
 * The service worker with its file list and version filled in. The version is the first 12 hex
 * digits of a SHA-256 over every file's name and contents in sorted order, so any change to any
 * file changes it.
 */
export function serviceWorkerSource(template: string, files: BuiltFile[]): string {
  const kept = files.filter((file) => isPrecached(file.name)).sort((a, b) => (a.name < b.name ? -1 : 1));
  const hash = createHash("sha256");
  for (const file of kept) {
    hash.update(`${file.name}\0${Buffer.byteLength(file.name)}\0`);
    hash.update(file.source);
    hash.update("\0");
  }
  const names = ["./", ...kept.map((file) => `./${file.name}`)];
  return template
    .replace("__FILES__", () => JSON.stringify(names))
    .replace("__VERSION__", () => hash.digest("hex").slice(0, 12));
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Emits sw.js, which precaches the whole build: the bundle and everything copied from public/. */
export function precache(template: string): Plugin {
  let publicDir = "";
  return {
    name: "tortoise-precache",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    async generateBundle(_options, bundle) {
      const files: BuiltFile[] = Object.values(bundle).map((output) => ({
        name: output.fileName,
        source: output.type === "chunk" ? output.code : output.source,
      }));
      for (const path of listFiles(publicDir)) {
        files.push({
          name: relative(publicDir, path).split(sep).join("/"),
          source: await readFile(path),
        });
      }
      this.emitFile({
        type: "asset",
        fileName: SERVICE_WORKER,
        source: serviceWorkerSource(template, files),
      });
    },
  };
}
