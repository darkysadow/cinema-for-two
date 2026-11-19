import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import { act, createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
import * as cinema from "../lib/cinema";
import { createCinemaWithFeedback } from "../lib/cinema-create-feedback";
import type { CreateCinemaState } from "../app/watchlist/cinema-actions";
import type { WatchlistItem } from "../lib/watchlist";

// Evaluate the actual TS module with only framework/data boundaries replaced.
// This avoids installing a browser or DOM library and does not fake React hooks.
function loadSource<T>(path: string, replacements: Record<string, unknown>): T {
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = createRequire(resolve(path));
  const evaluate = runInThisContext(`(function(require, module, exports) {${source}\n})`);
  evaluate((id: string) => Object.hasOwn(replacements, id) ? replacements[id] : localRequire(id), loaded, loaded.exports);
  return loaded.exports as T;
}

type CreationAction = (state: CreateCinemaState, form: FormData) => Promise<CreateCinemaState>;
const items: WatchlistItem[] = [3, 1, 2].map((tmdb_movie_id) => ({
  tmdb_movie_id, title: `Fixture ${tmdb_movie_id}`, poster_path: null, release_year: 2024,
}));

function loadWatchlistCinema(createCinemaSession: CreationAction) {
  return loadSource<{ WatchlistCinema: ComponentType<{ items: WatchlistItem[]; ownUsername: string | null }> }>(
    "components/watchlist-cinema.tsx", {
      "next/link": { __esModule: true, default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children) },
      "@/app/watchlist/cinema-actions": { createCinemaSession },
      "@/lib/cinema": cinema,
      "@/lib/cinema-create-feedback": { createCinemaWithFeedback },
      "./movie-poster": { MoviePoster: () => null },
      "./watchlist-form": { WatchlistForm: () => createElement("form", null, createElement("button", null, "Remove")) },
    },
  ).WatchlistCinema;
}

test("server-rendered shortlist cannot show native selections before React is ready", () => {
  const WatchlistCinema = loadWatchlistCinema(async () => ({ error: null }));
  const html = renderToStaticMarkup(createElement(WatchlistCinema, { items, ownUsername: "alex" }));
  const checkboxes = html.match(/<input\b[^>]*type="checkbox"[^>]*>/g) ?? [];
  assert.equal(checkboxes.length, 3);
  for (const checkbox of checkboxes) {
    assert.doesNotMatch(checkbox, /\b(?:form|name)=/);
    assert.match(checkbox, /\bdisabled=""/);
  }
  assert.match(html, /Loading session controls/);
  assert.match(html, /Your cinema username: <strong>alex<\/strong>/);
  assert.doesNotMatch(html, /name="candidateId"/);
  assert.doesNotMatch(html, /0 of 5 selected/);
  assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""/);
  let formDepth = 0;
  for (const tag of html.match(/<\/?form\b[^>]*>/g) ?? []) {
    formDepth += tag.startsWith("</") ? -1 : 1;
    assert.ok(formDepth >= 0 && formDepth <= 1, "remove and create forms must not be nested");
  }
  assert.equal(formDepth, 0);
});

test("the creation form preserves checked movies and submitted IDs after native action resets", async () => {
  // Load the real React DOM client after installing the fixture DOM globals.
  const requireFixture = createRequire(__filename);
  const { JSDOM } = requireFixture("jsdom") as {
    JSDOM: new (html: string) => { window: Window & typeof globalThis };
  };
  const { window } = new JSDOM("<!doctype html><div id='root'></div>");
  const globals = {
    window, document: window.document, navigator: window.navigator,
    FormData: window.FormData, IS_REACT_ACT_ENVIRONMENT: true,
  };
  const originalGlobals = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const { createRoot } = requireFixture("react-dom/client") as typeof import("react-dom/client");
  const container = window.document.getElementById("root")!;
  const root = createRoot(container);
  try {
    const submissions: { username: string; movieIds: string[] }[] = [];
    let settleSubmission: ((state: CreateCinemaState) => void) | undefined;
    const WatchlistCinema = loadWatchlistCinema(async (_previous, form) => {
      submissions.push({ username: String(form.get("username")), movieIds: form.getAll("candidateId").map(String) });
      return new Promise((resolveAction) => { settleSubmission = resolveAction; });
    });
    await act(async () => root.render(createElement(WatchlistCinema, { items, ownUsername: "alex" })));
    const form = container.querySelector<HTMLFormElement>(".cinema-form")!;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const username = form.querySelector<HTMLInputElement>('input[name="username"]')!;
    const [first, second] = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    let resets = 0;
    form.addEventListener("reset", () => { resets += 1; });
    const setNativeValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;

    async function enterUsername(value: string) {
      await act(async () => {
        setNativeValue.call(username, value);
        username.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
    }

    async function submit(value: string, error: string | null) {
      assert.equal(button.disabled, false);
      await act(async () => button.click());
      assert.deepEqual(submissions.at(-1), { username: value, movieIds: ["3", "1"] });
      assert.equal(button.disabled, true);
      await act(async () => {
        assert.ok(settleSubmission);
        settleSubmission({ error });
        settleSubmission = undefined;
      });
      assert.equal(button.disabled, false);
      if (error) assert.equal(form.querySelector('[role="alert"]')?.textContent, error);
      assert.equal(username.value, value);
      assert.match(form.textContent!, /2 of 5 selected/);
      assert.deepEqual(new window.FormData(form).getAll("candidateId"), ["3", "1"],
        "the next native form submission must still send both checked movie IDs");
      assert.equal(first.checked, true);
      assert.equal(second.checked, true);
    }

    await act(async () => { second.click(); first.click(); });
    const selfError = "Enter a username other than your own.";
    await enterUsername("alex");
    await submit("alex", selfError);
    await submit("alex", selfError); // Immediate retry without any input event.
    const unknownError = "No account matches that username.";
    await enterUsername("missing");
    await submit("missing", unknownError);
    await submit("missing", unknownError);
    await enterUsername("partner");
    await submit("partner", null);
    assert.equal(form.querySelector('[role="alert"]'), null);
    assert.equal(resets, 5, "React invoked the real HTMLFormElement.reset after each action");
  } finally {
    await act(async () => root.unmount());
    window.close();
    for (const [key, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("transport rejection becomes settled inline feedback and permits a subsequent attempt", async () => {
  const form = new FormData();
  const error = await createCinemaWithFeedback(async () => { throw new TypeError("Failed to fetch"); }, { error: null }, form);
  assert.match(error.error!, /Couldn’t confirm session creation/);
  assert.deepEqual(await createCinemaWithFeedback(async () => ({ error: "No account matches that username." }), error, form),
    { error: "No account matches that username." });
});

test("successful Server Action redirects are not swallowed by transport feedback", async () => {
  await assert.rejects(createCinemaWithFeedback(async () => redirect("/sessions/ffffffff-ffff-4fff-8fff-ffffffffffff"),
    { error: null }, new FormData()), (error: unknown) => {
    return typeof error === "object" && error !== null && "digest" in error &&
      String(error.digest).startsWith("NEXT_REDIRECT;");
  });
});

test("the creation action sends selected form IDs to the RPC and navigates only after success", async () => {
  const calls: { path: string; method: string; body: unknown }[] = [];
  let outcome: "success" | "unknown" | "self" | "unavailable" = "success";
  const sessionId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const supabase = createClient("https://supabase-fixture.invalid", "fixture-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const request = new Request(input, init);
      assert.equal(new URL(request.url).origin, "https://supabase-fixture.invalid");
      calls.push({ path: new URL(request.url).pathname, method: request.method, body: await request.json() });
      if (outcome === "unknown") return Response.json({ code: "22023", message: "unknown_username" }, { status: 400 });
      if (outcome === "self") return Response.json({ code: "22023", message: "self_invite" }, { status: 400 });
      if (outcome === "unavailable") throw new TypeError("Fixture connection failed");
      return Response.json(sessionId);
    } },
  });
  const { createCinemaSession } = loadSource<{ createCinemaSession: (state: CreateCinemaState, form: FormData) => Promise<CreateCinemaState> }>(
    "app/watchlist/cinema-actions.ts", {
      "@/lib/auth": { readAuth: async () => ({ kind: "signed-in", ownerId: "fixture-host", supabase }) },
      "@/lib/cinema": cinema,
      "next/navigation": { redirect },
    },
  );
  const form = new FormData();
  [3, 1, 2].forEach((id) => form.append("candidateId", String(id)));
  form.set("username", " partner ");
  await assert.rejects(createCinemaSession({ error: null }, form), (error: unknown) =>
    typeof error === "object" && error !== null && "digest" in error && String(error.digest).includes(`/sessions/${sessionId}`));
  assert.deepEqual(calls, [{ path: "/rest/v1/rpc/create_cinema_session", method: "POST",
    body: { invitee_username: "partner", candidate_ids: [3, 1, 2] } }]);
  outcome = "unknown";
  assert.deepEqual(await createCinemaSession({ error: null }, form), { error: "No account matches that username." });
  outcome = "self";
  form.set("username", "alex");
  assert.deepEqual(await createCinemaSession({ error: null }, form), { error: "Enter a username other than your own." });
  outcome = "unavailable";
  assert.deepEqual(await createCinemaSession({ error: null }, form), { error: "Couldn’t create the session. Try again." });
  const count = calls.length;
  form.delete("candidateId");
  assert.deepEqual(await createCinemaSession({ error: null }, form), { error: "Choose 2 to 5 different movies from your Watchlist." });
  assert.equal(calls.length, count, "invalid selections must never invoke the RPC");
});

test("the username display reads only the authenticated viewer's username column", async () => {
  const viewerId = "bbbbbbbb-2222-4222-8222-222222222222";
  const calls: URL[] = [];
  const supabase = createClient("https://supabase-fixture.invalid", "fixture-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      calls.push(new URL(input instanceof Request ? input.url : input));
      return Response.json([{ username: "partner" }]);
    } },
  });
  const { readOwnCinemaUsername } = loadSource<{
    readOwnCinemaUsername: (viewer: { ownerId: string; supabase: typeof supabase }) => Promise<string | null>;
  }>("lib/cinema-server.ts", { "server-only": {}, "./cinema": cinema });
  assert.equal(await readOwnCinemaUsername({ ownerId: viewerId, supabase }), "partner");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].origin, "https://supabase-fixture.invalid");
  assert.equal(calls[0].pathname, "/rest/v1/cinema_profiles");
  assert.deepEqual([...calls[0].searchParams], [["select", "username"], ["user_id", `eq.${viewerId}`]]);
});
