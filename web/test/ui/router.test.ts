// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/preact";
import { beforeEach, describe, expect, it } from "vitest";
import { back, navigate, parseRoute, replace, routeHash, useRoute, type Route } from "../../src/ui/router";

const ROUTES: [Route, string][] = [
  [{ name: "home" }, "#/"],
  [{ name: "review" }, "#/review"],
  [{ name: "practice" }, "#/practice"],
  [{ name: "completion" }, "#/completion"],
  [{ name: "add" }, "#/add"],
  [{ name: "words" }, "#/words"],
  [{ name: "settings" }, "#/settings"],
  [{ name: "edit", id: 42 }, "#/edit/42"],
];

/** history.back() is asynchronous; wait for the popstate it fires. */
function afterPop(): Promise<void> {
  return new Promise((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
}

describe("routes", () => {
  it.each(ROUTES)("%j is %s both ways", (route, hash) => {
    expect(routeHash(route)).toBe(hash);
    expect(parseRoute(hash)).toEqual(route);
  });

  it("reads a hash without the slash", () => {
    expect(parseRoute("#words")).toEqual({ name: "words" });
  });

  it.each(["", "#", "#/", "#/nowhere", "#/review/extra", "#/edit", "#/edit/abc", "#/edit/-1", "#/edit/1.5"])(
    "%j becomes home",
    (hash) => {
      expect(parseRoute(hash)).toEqual({ name: "home" });
    },
  );
});

describe("navigation", () => {
  beforeEach(() => {
    history.replaceState(null, "", "#/");
  });

  it("useRoute follows navigate and replace", () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current).toEqual({ name: "home" });
    act(() => navigate({ name: "words" }));
    expect(result.current).toEqual({ name: "words" });
    act(() => replace({ name: "settings" }));
    expect(result.current).toEqual({ name: "settings" });
  });

  it("useRoute follows popstate", () => {
    const { result } = renderHook(() => useRoute());
    act(() => {
      history.replaceState(null, "", "#/add");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current).toEqual({ name: "add" });
  });

  it("back replaces when nothing was pushed", () => {
    history.replaceState(null, "", "#/settings");
    const { result } = renderHook(() => useRoute());
    const length = history.length;
    act(() => back({ name: "home" }));
    expect(result.current).toEqual({ name: "home" });
    expect(history.length).toBe(length);
  });

  it("back goes back after a push", async () => {
    const { result } = renderHook(() => useRoute());
    act(() => navigate({ name: "words" }));
    expect(history.state).toEqual({ depth: 1 });
    await act(async () => {
      const popped = afterPop();
      back({ name: "settings" });
      await popped;
    });
    expect(result.current).toEqual({ name: "home" });
  });

  it("after a push and the browser's back, back replaces rather than leaving the app", async () => {
    const { result } = renderHook(() => useRoute());
    act(() => navigate({ name: "words" }));
    await act(async () => {
      const popped = afterPop();
      history.back();
      await popped;
    });
    expect(result.current).toEqual({ name: "home" });
    expect(history.state).toEqual(null);

    act(() => replace({ name: "settings" }));
    const length = history.length;
    act(() => back({ name: "home" }));
    expect(result.current).toEqual({ name: "home" });
    expect(history.length).toBe(length);
  });

  it("a replace keeps the depth", () => {
    navigate({ name: "words" });
    replace({ name: "completion" });
    expect(history.state).toEqual({ depth: 1 });
  });
});
