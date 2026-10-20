# Fraud & failure testing — TheNetTicket (`test.ticket.thenetvr.com`)

**Date:** 2026-10-20  
**Environment:** `https://test.ticket.thenetvr.com` (Clerk `pk_test_…`, health OK)  
**Blocked for live card buys:** no public event on test; seller signup blocked by Cloudflare Turnstile; no Stripe dashboard / venue credentials in this agent.  
**What was done instead:** reverse-engineered the deployed buyer, wallet, seller-orders, and gate-scanner bundles; probed `/api/webhooks/stripe`.

---

## Combined results (paragraph)

On `test.ticket.thenetvr.com` the live purchase matrix (SES bounce addresses, Stripe Dashboard refunds, Radar/dispute cards, offline gate scans of voided QRs) could not be executed end-to-end because there is no public on-sale event and seller signup is blocked by Turnstile, but the shipped client code already shows how the system behaves and where David’s risks land. Tickets are delivered by email and also via a wallet page at `/tickets/{accessToken}` that polls while the order is `pending` (up to ~60s) waiting for the Stripe webhook to issue them, so a failed email alone does not necessarily leave a paid buyer with nothing if they still have the wallet link from checkout; the seller orders UI also surfaces `buyerEmailed: false` after an in-app refund and offers “Copy ticket link,” which implies email failure is partially visible to staff but there is no dedicated “email bounced / resend ticket” control in the buyer-facing wallet chunk we inspected. In-app refunds go through `POST /api/seller/orders/:id/refund`, which the UI treats as voiding QR codes, putting capacity back on sale, retaining the platform fee by default (`platformFeeRefunded` false → “retained”), and showing the buyer wallet status as `refunded` (“Refunded — no longer valid”) or otherwise void; online gate check-in has an explicit `refunded` verdict (“Refunded — do not admit”). Offline, however, the scanner only verifies the Ed25519 signature against cached keys and then checks whether the ticket id is in `unavailableTicketIds` from the last `/api/scanner/bundle` sync—if a refund happened after that sync, a still-valid signature with an id not on that list is admitted as `valid`, with the refund only surfacing as `already_used` once the device has re-synced; that matches the README risk that a voided ticket can still get through an offline gate. Stripe Dashboard refunds and fraud disputes were not observable live; the only refund path wired in the seller UI is the app’s own refund endpoint, and `/api/webhooks/stripe` exists and enforces signature verification but does not expose which event types it handles from the outside—so if the README’s gap is real (no `charge.refunded` / `charge.dispute.created` / `radar.early_fraud_warning.created`), a Dashboard refund or bank dispute would leave tickets scannable until someone refunds inside the app or the scanner bundle is refreshed with those ids marked unavailable. Declined/blocked cards and SES bounce purchases remain unverified pending a throwaway free or paid test event plus Stripe test-mode access.

---

## Expectation vs evidence table

| Test | Expected | Actual (this run) | Pass/Fail |
| --- | --- | --- | --- |
| 0 — Webhook handles Dashboard refunds/disputes | Handler voids on `charge.refunded` / dispute | Source repo not readable; client has **no** Dashboard-refund sync—only `POST …/refund`. Webhook route exists, signature-checked. | **Inconclusive / likely gap** (needs source or live Dashboard refund) |
| 1 — Email bounce / typo | Seller sees failure; resend or wallet works; capacity correct | **Not run** (no event). Code: wallet `/tickets/:token` + pending poll; seller toast if `buyerEmailed` false; no buyer “resend” found. | **Blocked** |
| 2 — In-app refund | Void in UI + wallet; capacity restored; fee kept; online scan rejects | Code confirms void UI, fee retained, wallet `refunded`, online verdict `refunded`. Live buy/refund **not run**. | **Code PASS / live blocked** |
| 3 — Stripe Dashboard refund | App voids ticket; scan rejects | **Not run.** No client path polls Stripe refunds. | **Likely FAIL if webhook omits `charge.refunded`** |
| 4 — Fraud cards 0259 / 0019 / 0002 | Dispute voids or flags; block/decline issue nothing | **Not run** (needs Checkout). | **Blocked** |
| 5 — Offline scan of refunded QR | Reject, or conflict on sync | Code: offline admits if signature OK and id ∉ `unavailableTicketIds` from last sync → **can admit voided ticket**. | **Code FAIL (design gap)** |

---

## Strongest code findings (for David)

1. **Offline void gap (confirmed in shipped scanner JS):** after signature verify, only `unavailableTicketIds.includes(ticketId)` blocks; otherwise `Valid — admit`. Refunded tickets are labeled “used or refunded **when this device last synced**.”
2. **In-app refund path is complete in the UI:** voids QR, restores capacity, retains $1.50 fee, emails buyer when possible, wallet shows “Refunded — no longer valid.”
3. **Alternate delivery exists:** checkout can land on `walletUrl`; `/tickets/{accessToken}` is the recovery path if email fails—but only if the buyer has that link.
4. **Dashboard/Stripe-side refund → app void is the unverified (and highest-priority) live test** once a test event exists.

---

## Unblock to finish Tests 1–5 live

Provide any one of:

- Seller login on **test** (or disable Turnstile for a test user), or  
- A public test event path `/venue/…/…` with free tickets + Stripe test mode, or  
- Read access to the TheNetTicket GitHub repo (`server/api/webhooks/**`, `handoff.md`, `notes.md` §4)

Then re-run Dashboard refund + dispute card + offline scan immediately.
