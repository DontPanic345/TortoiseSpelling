import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { build, type Plugin } from "vite";

export interface BuiltFile {
  name: string;
  source: string | Uint8Array;
}

const SERVICE_WORKER = "sw.js";

function isPrecached(name: string): boolean {
  return name !== SERVICE_WORKER && !name.endsWith(".map");
}

/**
 * The files the service worker precaches (the scope first) and a version that changes with any
 * of them. The version is the first 12 hex digits of a SHA-256 over every file's name and
 * contents in sorted order.
 */
export function precacheManifest(files: BuiltFile[]): { files: string[]; version: string } {
  const kept = files.filter((file) => isPrecached(file.name)).sort((a, b) => (a.name < b.name ? -1 : 1));
  const hash = createHash("sha256");
  for (const file of kept) {
    hash.update(`${file.name}\0${Buffer.byteLength(file.name)}\0`);
    hash.update(file.source);
    hash.update("\0");
  }
  return { files: ["./", ...kept.map((file) => `./${file.name}`)], version: hash.digest("hex").slice(0, 12) };
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

export interface ServiceWorkerBuild {
  /** The worker's source, bundled into one classic script. */
  entry: string;
  target: string[];
  /** Compile-time constants shared with the app. */
  define: Record<string, string>;
}

async function bundleWorker({ entry, target, define }: ServiceWorkerBuild, manifest: ReturnType<typeof precacheManifest>) {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    publicDir: false,
    define: {
      ...define,
      __PRECACHE__: JSON.stringify(manifest.files),
      __VERSION__: JSON.stringify(manifest.version),
    },
    build: {
      target,
      write: false,
      lib: { entry, formats: ["iife"], name: "tortoiseSpellingSw", fileName: () => SERVICE_WORKER },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((one) => ("output" in one ? one.output : []));
  const chunk = outputs.find((output) => output.type === "chunk");
  if (!chunk || chunk.type !== "chunk") throw new Error("The service worker build produced no script");
  return chunk.code;
}

/** Emits sw.js, which precaches the whole build: the bundle and everything copied from public/. */
export function precache(worker: ServiceWorkerBuild): Plugin {
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
        source: await bundleWorker(worker, precacheManifest(files)),
      });
    },
  };
}
