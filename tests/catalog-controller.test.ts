import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import { act, createElement, type ComponentType, type ReactNode } from "react";
import ts from "typescript";
import * as catalog from "../lib/catalog";
import { parseCatalogPage } from "../lib/catalog-tmdb";
import type { CatalogRange, CatalogState } from "../lib/catalog";
import { normalizeMovie } from "../lib/movies";

function sampleRange(state: CatalogState, title: string): CatalogRange {
  return {
    state,
    genres: state.mode === "browse" ? [{ id: 35, name: "Comedy" }] : null,
    notices: [],
    movies: [normalizeMovie({ id: 1, title })!],
    failedPage: null,
    terminal: false,
    cutoff: null,
  };
}

function loadCatalog() {
  const filename = resolve("components/movie-catalog.tsx");
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const loaded = { exports: {} };
  const replacements: Record<string, unknown> = {
    "next/link": {
      __esModule: true,
      default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
    },
    "@/lib/catalog": catalog,
    "@/components/movie-poster": { MoviePoster: () => null },
    "@/components/page-state": {
      LoadingState: ({ label }: { label: string }) => createElement("p", { role: "status" }, label),
      EmptyState: ({ title }: { title: string }) => createElement("p", { role: "status" }, title),
    },
  };
  const localRequire = createRequire(filename);
  const load = runInThisContext(`(function(require, module, exports) {${outputText}\n})`);
  load(
    (name: string) => Object.hasOwn(replacements, name) ? replacements[name] : localRequire(name),
    loaded,
    loaded.exports,
  );
  return (loaded.exports as {
    MovieCatalog: ComponentType<{ initial: CatalogRange; requestedSearch: string }>;
  }).MovieCatalog;
}

type PendingRead = { href: string; settle: (response: Response) => void };
type Fixture = {
  window: Window & typeof globalThis;
  container: HTMLElement;
  reads: PendingRead[];
};

async function withCatalog(
  url: string, initial: CatalogRange, requestedSearch: string, exercise: (fixture: Fixture) => Promise<void>,
) {
  const requireFixture = createRequire(__filename);
  const { JSDOM } = requireFixture("jsdom") as {
    JSDOM: new (html: string, options: { url: string }) => { window: Fixture["window"] };
  };
  const { window } = new JSDOM("<div id='root'></div>", { url: `https://cinema.test${url}` });
  const reads: PendingRead[] = [];
  const globals = {
    window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (href: string) => new Promise<Response>(settle => { reads.push({ href, settle }); }),
  };
  const originals = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const { createRoot } = requireFixture("react-dom/client") as typeof import("react-dom/client");
  const container = window.document.getElementById("root")!;
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(loadCatalog(), { initial, requestedSearch })));
    await exercise({ window, container, reads });
  } finally {
    await act(async () => root.unmount());
    window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll("button")].find(control => control.textContent === label);
  assert.ok(match, `Expected a ${label} button`);
  return match;
}

test("catalog cards show one-decimal TMDB ratings, unrated movies, and a valid zero in both modes", async () => {
  const page = parseCatalogPage({
    page: 1, total_pages: 1, total_results: 5,
    results: [
      { id: 1, title: "Rated", vote_average: 7.84, vote_count: 120 },
      { id: 2, title: "No votes", vote_average: 7.84, vote_count: 0 },
      { id: 3, title: "Unavailable", vote_count: 12 },
      { id: 4, title: "Valid zero", vote_average: 0, vote_count: 1 },
      { id: 5, title: "Unrated zero", vote_average: 0, vote_count: 0 },
    ],
  }, 1)!;
  for (const state of [catalog.defaultBrowse(), { mode: "search", query: "Movie", page: 1 } as const]) {
    const initial = { ...sampleRange(state, "Unused"), movies: page.movies, terminal: true };
    const href = catalog.catalogHref(state);
    await withCatalog(href, initial, href.split("?")[1], async ({ container, reads }) => {
      assert.deepEqual(
        [...container.querySelectorAll(".movie-card-rating")].map(badge => badge.textContent),
        ["TMDB 7.8/10", "TMDB Not rated", "TMDB Not rated", "TMDB 0.0/10", "TMDB Not rated"],
      );
      assert.deepEqual(
        [...container.querySelectorAll(".movie-grid a")].map(card => card.getAttribute("href")),
        ["/movies/1", "/movies/2", "/movies/3", "/movies/4", "/movies/5"],
      );
      assert.equal(reads.length, 0, "Rendering cards must not fetch movie details");
    });
  }
});

test("catalog retries a failed new transition without replacing committed results or pushing a failed URL", async () => {
  const initial = sampleRange(catalog.defaultBrowse(), "Previously loaded Browse movie");
  await withCatalog("/?sort=popular&page=1", initial, "sort=popular&page=1", async ({ window, container, reads }) => {
    const query = container.querySelector<HTMLInputElement>('input[name="q"]')!;
    const setNativeValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    const originalHistoryLength = window.history.length;
    await act(async () => {
      setNativeValue.call(query, "Inception");
      query.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await act(async () => button(container, "Search").click());
    assert.equal(reads[0].href, "/api/catalog?q=Inception");
    await act(async () => reads[0].settle(new Response(null, { status: 503 })));
    assert.equal(window.location.search, "?sort=popular&page=1");
    assert.equal(window.history.length, originalHistoryLength);
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /Movies couldn’t load/);
    assert.match(container.textContent!, /Browse movies/);
    assert.match(container.textContent!, /Previously loaded Browse movie/);

    await act(async () => button(container, "Try again").click());
    assert.equal(reads[1].href, "/api/catalog?q=Inception");
    const searchResult = sampleRange({ mode: "search", query: "Inception", page: 1 }, "Inception");
    await act(async () => reads[1].settle(Response.json(searchResult)));
    assert.equal(window.location.search, "?q=Inception&page=1");
    assert.equal(window.history.length, originalHistoryLength + 1);
    assert.equal(container.querySelector("select"), null);
    assert.match(container.querySelector("h2")!.textContent!, /Search results for “Inception”/);
    assert.equal(container.querySelector('[role="alert"]'), null);
  });
});

test("catalog remount and uncached history use the actual URL during loading, failure, and reset", async () => {
  const initial = sampleRange(catalog.defaultBrowse(), "Stale page-one movie");
  await withCatalog("/?sort=popular&page=2", initial, "sort=popular&page=1", async ({ window, container, reads }) => {
    const originalHistoryLength = window.history.length;
    assert.equal(reads[0].href, "/api/catalog?sort=popular&page=2");
    assert.equal(window.location.search, "?sort=popular&page=2");
    assert.equal(container.querySelector("h2")!.textContent, "Catalog");
    assert.equal(container.querySelector("select"), null);
    assert.doesNotMatch(container.textContent!, /Stale page-one movie/);

    await act(async () => reads[0].settle(Response.json(sampleRange(
      { ...catalog.defaultBrowse(), page: 2 }, "Appended page-two movie",
    ))));
    assert.equal(window.location.search, "?sort=popular&page=2");
    assert.equal(window.history.length, originalHistoryLength);
    assert.match(container.textContent!, /Appended page-two movie/);

    // Simulate a history entry whose catalog snapshot is not available.
    await act(async () => {
      window.history.replaceState(null, "", "/?q=Inception&page=2");
      window.dispatchEvent(new window.PopStateEvent("popstate"));
    });
    assert.equal(reads[1].href, "/api/catalog?q=Inception&page=2");
    assert.equal(container.querySelector("h2")!.textContent, "Catalog");
    assert.equal(container.querySelector("select"), null);
    await act(async () => reads[1].settle(new Response(null, { status: 503 })));
    assert.equal(window.location.search, "?q=Inception&page=2");
    assert.equal(container.querySelector("select"), null);
    assert.doesNotMatch(container.textContent!, /Appended page-two movie/);
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /Movies couldn’t load/);

    await act(async () => button(container, "Reset filters").click());
    assert.equal(reads[2].href, "/api/catalog?sort=popular&page=1");
    await act(async () => reads[2].settle(Response.json(initial)));
    assert.equal(window.location.search, "?sort=popular&page=1");
    assert.equal(container.querySelector("h2")!.textContent, "Browse movies");
    assert.match(container.textContent!, /Stale page-one movie/);
    assert.equal(container.querySelector('[role="alert"]'), null);
  });
});
