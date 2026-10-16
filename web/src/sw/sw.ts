import { openDatabase } from "../data/db";
import { createRepository, type Repository } from "../data/repository";
import { deviceClock } from "../domain/clock";
import { createPushApi } from "../push/pushApi";
import { createReminderSync } from "../push/reminderSync";
import { handleClick, handlePush, type WorkerDeps } from "./handlers";
import { pushKind } from "./notification";
import { swPushPlatform } from "./swPushPlatform";

declare const self: ServiceWorkerGlobalScope;
/** Filled in by build/precache.ts. */
declare const __PRECACHE__: string[];
declare const __VERSION__: string;
declare const __PUSH_SERVER__: string;

const CACHE = `tortoisespelling-${__VERSION__}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(__PRECACHE__.map((file) => new Request(file, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("tortoisespelling-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const wanted = request.mode === "navigate" ? "./" : request;
  event.respondWith(caches.match(wanted, { ignoreVary: true }).then((cached) => cached ?? fetch(request)));
});

let opened: Promise<Repository> | null = null;

function repository(): Promise<Repository> {
  opened ??= openDatabase(undefined, () => (opened = null)).then((db) => createRepository({ db }));
  return opened;
}

const deps: WorkerDeps = {
  repository,
  async sync() {
    if (__PUSH_SERVER__ === "") return;
    await createReminderSync({
      repository: await repository(),
      clock: deviceClock,
      push: swPushPlatform(self.registration),
      api: createPushApi(__PUSH_SERVER__, fetch),
    }).sync();
  },
  show: ({ title, body }) =>
    self.registration.showNotification(title, { body, tag: "reminder", icon: "./icons/icon-192.png" }),
  async windows() {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    return all.filter((client) => client.url.startsWith(self.registration.scope));
  },
  openWindow: (url) => self.clients.openWindow(url),
};

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(pushKind(event.data), deps));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(handleClick(deps));
});

self.addEventListener("pushsubscriptionchange", (event) => {
  (event as ExtendableEvent).waitUntil(deps.sync().catch(() => {}));
});
