# TheNetTicket — concurrent buyer testing (10–100 users)

**Why this exists.** Overselling, double-charging, lost holds, and wrong platform fees are high-severity money bugs. The product already promises “when two people go for the last ticket at the same moment, only one sale goes through.” That claim needs evidence under concurrency, not unit tests alone.

**Repo note.** This workspace (`sammyyyy`) does not contain TheNetTicket source. Fixes and DB-level race tests belong in the app repo. This package is a black-box / staging harness that can run from here against a deployment, plus the playbook for when to use Cursor subagents.

---

## What “10–100 concurrent users” actually means

Three different layers get confused. Use all three; none replaces the others.

| Layer | Tool | Concurrency | What it proves |
| --- | --- | --- | --- |
| **A. Capacity races in the app repo** | Vitest + real Postgres (`test/integration/idempotency-and-holds.test.ts` and siblings) | Hundreds of parallel `Promise`s in one process | DB constraints, hold accounting, fee math, webhook idempotency |
| **B. HTTP load against a deployment** | `concurrency-test/read-load.mjs`, `race-buyers.mjs` | 10–100 Node fetch workers | Lambda/API Gateway latency, 5xx rate, hold API under flocking buyers |
| **C. Multi-persona browser buyers** | 2–5 Cursor `computerUse` / cloud subagents | A few real Chromiums | UX under contention (error copy, Stripe redirect, wallet page) — not load |

**Do not** spin up 50–100 cloud agents to generate load. Agents are slow, expensive, and rate-limit themselves. For 10–100 concurrent buyers, use Node (layer B) or k6/Artillery. Use subagents only for a handful of qualitative browser races (layer C).

---

## Risk matrix (what to race)

From the 2026-09-17 fee change and the product notes:

1. **Last-ticket oversell** — `capacity = C`, fire `N > C` create-order requests at the same instant. Exactly `C` must hold; the rest must fail cleanly (not 500, not silent success).
2. **Hold vs Stripe window** — hold is 30 minutes (Stripe Checkout minimum). A payment completing after hold expiry must not issue a ticket; a capacity-resold refund must return the platform fee.
3. **Idempotent checkout / webhook** — double-submit and double-webhook must not double-issue.
4. **Platform fee $1.50** — paid online tickets take 150¢ (or venue override); free tickets and door sales take 0; fee retained on normal refund.
5. **Paid floor $5.00** — API + UI + DB check refuse paid prices under the floor.
6. **Read path under flock** — marketing, event page, health stay healthy while buyers hammer checkout.

Layers A+B cover 1–5. Layer C covers “what the buyer sees” for 1 and 3.

---

## Safe vs unsafe targets

| Target | Read load (layer B read) | Write races (layer B write) | Browser subagents (C) |
| --- | --- | --- | --- |
| Production `ticket.thenetvr.com` | Yes, capped (default in this harness) | **No** — Terms forbid probing/overload; holds steal real capacity | Fee/copy checks only |
| Staging / local-dev | Yes | Yes, on a throwaway event with tiny capacity | Yes |
| App-repo integration DB | N/A | Preferred home for oversell proofs | N/A |

Production Terms §8: *“You may not … probe or overload our systems.”* Keep write races on staging.

---

## How to run what we have here

```bash
cd concurrency-test
npm install

# 1) Fee regression after the $1.00 → $1.50 change
npm run fee-check

# 2) Concurrent read users against production (safe)
npm run read-load -- --users 10
npm run read-load -- --users 50
npm run read-load -- --users 100

# 3) Write race — staging only, requires a real event
BASE_URL=https://staging.example.com \
EVENT_PATH=/venue/your-venue/your-event \
TICKET_TYPE_ID=... \
ENTRY_TIME_ID=... \
CAPACITY=5 \
npm run race-buyers -- --users 20 --write
```

`race-buyers` refuses to run against the production host unless you pass `--i-understand-this-hits-real-capacity` (still not recommended).

---

## Using Cursor subagents (layer C)

Goal: 3–5 real browsers racing one last ticket on **staging**, not 100 agents.

1. Create a staging event with `capacity = 1` (or 2) and a free ticket type so Stripe is out of the path.
2. Launch **3** `computerUse` (or cloud) subagents in one message, each with a distinct buyer email and the same event URL.
3. Instruct each to: open the event → select the only entry time → checkout → screenshot the result (wallet vs sold-out).
4. Assert offline: exactly one wallet/success, the others show a clear sold-out / capacity error — never a second ticket.

That is the right use of subagents: sparse, visual, adversarial. Pair it with `race-buyers.mjs` at `--users 50` on the same staging event for the statistical proof.

---

## What belongs in the TheNetTicket app repo

Port or keep these as Vitest integration tests (they already have `idempotency-and-holds.test.ts`):

- `platformFeeCentsFor(null, n) === 150 * n` after the default change
- Concurrent `INSERT` into holds with `capacity = 1` → one winner
- Free ticket path never creates a Stripe session
- Auto-refund-on-resale returns the platform fee; normal refund keeps it

Those tests are the cheapest place to get to hundreds of concurrent actors with deterministic assertions.

---

## Fee change checklist (commit `1cdefed`)

After deploy, `npm run fee-check` must see:

- Homepage: “We take **$1.50** per paid ticket”
- Terms §7: “Our fee is **$1.50** per paid ticket sold online”
- Bundled `LEGAL.platformFee` from `150` cents
- Effective date **2026-09-17**

It does **not** prove Lambda `NUXT_PLATFORM_FEE_CENTS_DEFAULT=150` for live charges — that needs a staging paid sale or a seller-context API response showing `platformFeeCents: 150` for a venue with a null override.
