import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import { act, createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import ts from "typescript";
import * as movies from "../lib/movies";

function loadPoster() {
  const filename = resolve("components/movie-poster.tsx");
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const loaded = { exports: {} };
  const localRequire = createRequire(filename);
  const load = runInThisContext(`(function(require, module, exports) {${outputText}\n})`);
  load((name: string) => name === "@/lib/movies" ? movies : localRequire(name), loaded, loaded.exports);
  return (loaded.exports as { MoviePoster: ComponentType<{ path: string; title: string }> }).MoviePoster;
}

async function withHydratedPoster(failedBeforeHydration: boolean) {
  const requireFixture = createRequire(__filename);
  const { JSDOM } = requireFixture("jsdom") as {
    JSDOM: new (html: string) => { window: Window & typeof globalThis };
  };
  const Poster = loadPoster();
  const element = createElement(Poster, { path: "/first.jpg", title: "Fixture" });
  const { window } = new JSDOM(`<div id="root">${renderToString(element)}</div>`);
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const container = window.document.getElementById("root")!;
  const image = container.querySelector("img")!;
  // Model the browser's completed 404 before React attaches event handlers.
  Object.defineProperty(image, "complete", { configurable: true, value: failedBeforeHydration });
  Object.defineProperty(image, "naturalWidth", { configurable: true, value: 0 });
  if (failedBeforeHydration) image.dispatchEvent(new window.Event("error"));
  const { hydrateRoot } = requireFixture("react-dom/client") as typeof import("react-dom/client");
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(container, element); });
    if (!failedBeforeHydration) {
      assert.ok(container.querySelector("img"), "A pending image must remain visible");
      await act(async () => image.dispatchEvent(new window.Event("error")));
    }
    assert.equal(container.querySelector("img"), null);
    assert.match(container.textContent!, /No poster/);
    await act(async () => root!.render(createElement(Poster, { path: "/second.jpg", title: "Next movie" })));
    assert.equal(container.querySelector("img")?.getAttribute("src"), "https://image.tmdb.org/t/p/w342/second.jpg");
  } finally {
    if (root) await act(async () => root!.unmount());
    window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test("poster recovers an image failure that completed before hydration and can show a new source", async () => {
  await withHydratedPoster(true);
});

test("poster retains a pending image and handles its later error without hiding a new source", async () => {
  await withHydratedPoster(false);
});
