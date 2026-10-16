import { afterEach } from "vitest";

// The domain and data tests run on node; only the files that ask for jsdom get a document.
if (typeof document !== "undefined") {
  const { act, cleanup } = await import("@testing-library/preact");
  // Preact runs an unmounted component's effect cleanups on a timer; `act` runs them now, so
  // none fires after the test file's window is gone.
  afterEach(() => act(() => cleanup()));

  // jsdom has no modal dialogs or scrolling. These stand in, toggling `open` as a browser would.
  const dialog = HTMLDialogElement.prototype;
  dialog.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  dialog.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  Element.prototype.scrollIntoView ??= () => {};
}
