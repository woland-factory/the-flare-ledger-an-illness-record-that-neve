import { expect, test } from "@playwright/test";
import { randomIp, signup, uniqueEmail } from "./helpers";

test("sign up, read profile, then sign out", async ({ request }) => {
  const { email } = await signup(request);

  const me = await request.get("/api/me");
  expect(me.status()).toBe(200);
  expect((await me.json()).email).toBe(email);

  const out = await request.post("/api/auth/signout");
  expect(out.status()).toBe(204);

  const after = await request.get("/api/me");
  expect(after.status()).toBe(401);
});

test("duplicate signup returns 409", async ({ request }) => {
  const email = uniqueEmail();
  await signup(request, email);
  const dup = await request.post("/api/auth/signup", {
    data: { email, password: "test-password-123" },
    headers: { "x-forwarded-for": randomIp() },
  });
  expect(dup.status()).toBe(409);
});

test("bad signin returns 401 without revealing the field", async ({ request }) => {
  const { email } = await signup(request);
  const res = await request.post("/api/auth/signin", {
    data: { email, password: "wrong-password" },
    headers: { "x-forwarded-for": randomIp() },
  });
  expect(res.status()).toBe(401);
  const body = await res.json();
  // One combined message, so it never reveals which field was wrong.
  expect(body.error.message).toBe("Email or password is incorrect.");
});

test("every protected route rejects an unauthenticated request", async ({ playwright }) => {
  const anon = await playwright.request.newContext();
  const cases: Array<[() => Promise<{ status(): number }>, string]> = [
    [() => anon.get("/api/me"), "GET /api/me"],
    [() => anon.get("/api/flares"), "GET /api/flares"],
    [() => anon.post("/api/flares"), "POST /api/flares"],
    [() => anon.get("/api/flares/00000000-0000-0000-0000-000000000000"), "GET /api/flares/:id"],
    [
      () =>
        anon.patch("/api/flares/00000000-0000-0000-0000-000000000000", {
          data: { onset_choice: "today" },
        }),
      "PATCH /api/flares/:id",
    ],
    [() => anon.post("/api/auth/signout"), "POST /api/auth/signout"],
  ];
  for (const [call, label] of cases) {
    expect((await call()).status(), label).toBe(401);
  }
  await anon.dispose();
});

test("another user's flare is reported as not found (404)", async ({ playwright }) => {
  const a = await playwright.request.newContext();
  const b = await playwright.request.newContext();
  await signup(a);
  await signup(b);

  const created = await a.post("/api/flares");
  const flareId = (await created.json()).flare.id;

  expect((await b.get(`/api/flares/${flareId}`)).status()).toBe(404);
  expect(
    (
      await b.patch(`/api/flares/${flareId}`, { data: { onset_choice: "today" } })
    ).status(),
  ).toBe(404);

  await a.dispose();
  await b.dispose();
});

test("start a flare, then set and persist the onset", async ({ request }) => {
  await signup(request);

  const created = await request.post("/api/flares");
  expect(created.status()).toBe(201);
  const flare = (await created.json()).flare;
  expect(flare.status).toBe("open");
  expect(flare.onsetPrecision).toBe("exact");

  const patched = await request.patch(`/api/flares/${flare.id}`, {
    data: { onset_choice: "few_days_ago" },
  });
  expect(patched.status()).toBe(200);
  expect((await patched.json()).flare.onsetPrecision).toBe("approx");

  const reload = await request.get(`/api/flares/${flare.id}`);
  expect((await reload.json()).flare.onsetPrecision).toBe("approx");
});

test("malformed onset payloads are rejected with 400", async ({ request }) => {
  await signup(request);
  const flare = (await (await request.post("/api/flares")).json()).flare;
  const bad = [
    { onset_choice: "whenever" },
    { onset_choice: "around_date" },
    { onset_choice: "around_date", around_date: "2999-01-01" },
    { onset_choice: "today", severity: 5 },
  ];
  for (const data of bad) {
    const res = await request.patch(`/api/flares/${flare.id}`, { data });
    expect(res.status(), JSON.stringify(data)).toBe(400);
  }
});

test("auth endpoint is rate limited per IP (429)", async ({ playwright }) => {
  const ctx = await playwright.request.newContext();
  const ip = randomIp();
  let sawLimit = false;
  for (let i = 0; i < 11; i++) {
    const res = await ctx.post("/api/auth/signin", {
      data: { email: "nobody@example.com", password: "whatever-123" },
      headers: { "x-forwarded-for": ip },
    });
    if (i < 10) {
      expect(res.status()).toBe(401);
    } else {
      sawLimit = res.status() === 429;
    }
  }
  expect(sawLimit).toBe(true);
  await ctx.dispose();
});

test("mutations are rate limited per user (429)", async ({ request }) => {
  await signup(request);
  let status = 0;
  // Limit is set to 20 for the e2e server.
  for (let i = 0; i < 21; i++) {
    status = (await request.post("/api/flares")).status();
  }
  expect(status).toBe(429);
});
