# TheNetTicket — fraud, email & void findings

**Sources:** full GitHub read of email / payment / refund / fraud / gate-scan paths, schema, tests, SES infra, and design docs (2026-10-20); corroborated against the deployed bundles on `test.ticket.thenetvr.com` and `ticket.thenetvr.com`.  
**Nothing in the app source was modified.** Live Stripe card tests on test remain blocked from this workspace (no test event + Turnstile on seller signup).

---

## Short answers

| Question | Answer |
| --- | --- |
| Buyer never gets the ticket email | Tickets are still **valid**. The app does **not** record that email failed. No resend. No buyer self-service lookup by email. |
| Refund inside the app | **Yes — voided.** Status set to `refunded` before Stripe is called; online scan rejects; wallet hides QR. Covered by integration tests. |
| Refund or fraud dispute in Stripe | **No.** Webhook ignores those events. Ticket stays valid and can still open the gate. |

---

## Combined results

Payment is confirmed by the Stripe webhook, which marks the order paid, creates tickets, then sends email (`server/api/webhooks/stripe.post.ts`); if that send fails, the failure is only logged—the order still counts as success—and because `orders` has no “email sent” column (`server/database/schema.ts`) the seller dashboard cannot show who never received tickets. SES bounces surface only as a CloudWatch rate (alarm at 5/hour in `infra/modules/app/ses.tf`), so a single typo address never alarms, and any bounced or complained address is permanently suppressed (`infra/stacks/network/ses.tf`) while the app still believes mail went out. There is no resend (handoff.md items 12/14, notes.md §7); staff must copy the ticket link from Orders (`app/pages/dashboard/orders.vue`), and buyers who leave the Stripe success page have no email-based recovery—only `/tickets/{accessToken}` if they still have that URL. Worse, `confirmOrderPaid` splits “mark paid” from “create tickets,” so a retry after a partial failure can treat the order as already processed and skip email entirely, and if the webhook records Stripe’s event id then times out without throwing, Stripe’s retry is dropped as a duplicate while the order stays `pending` until the hold expires—buyer paid, no ticket—while the wallet only polls every 3s for 20 tries and never asks Stripe directly (`app/pages/tickets/[accessToken].vue`). On voids: an in-app refund sets tickets to `refunded` before calling Stripe and rolls status back if Stripe fails (`server/services/refunds.ts`), so online check-in returns “Refunded — do not admit” (`server/services/checkin.ts`), the wallet hides the QR, and `test/integration/checkin-and-refunds.test.ts` covers that path. Refunds and fraud disputes made in the Stripe dashboard never reach the app: the webhook handles six event types and `default: return`s everything else as “informational for the MVP,” including `charge.refunded`, and the codebase never mentions “dispute,” so chargebacks leave tickets valid even though `app/pages/legal/refunds.vue` claims a disputed charge cancels the ticket while the dispute is open. When an in-app refund fails, the API tells staff to refund in Stripe (`server/api/seller/orders/[id]/refund.post.ts`)—sending them into that gap—and afterward the order still shows Paid, so Refund in the app is rejected by Stripe and the code restores tickets to valid, with no manual Void button. The Orders UI never sends the API’s “fraudulent” reason (empty body). Offline (and after a 1.5s online timeout fallback), the gate only verifies the signature and checks `unavailableTicketIds` from the last `/api/scanner/bundle` load (`app/composables/useGateScanner.ts`); a ticket refunded after that sync still has a valid signature and is admitted as “Valid — admit,” and when that scan later syncs the server records `refunded` but only treats `already_used` as a conflict (`server/api/checkin/sync.post.ts`), so the operator is not warned.

---

## Evidence map (files)

### Email path
- `server/api/webhooks/stripe.post.ts` — pay → create tickets → send email; failures logged only
- `server/services/orders.ts` (`confirmOrderPaid`) — paid mark vs ticket create vs email; retry / duplicate-event hazards
- `server/database/schema.ts` — no email-delivery field on orders
- `infra/modules/app/ses.tf` / `infra/stacks/network/ses.tf` — bounce alarm threshold; suppression list
- `app/pages/tickets/[accessToken].vue` — pending poll 3s × 20, then stops
- `app/pages/dashboard/orders.vue` — copy link only; no resend
- `handoff.md` (12, 14), `notes.md` §7 — resend called out as unbuilt

### In-app refund (works)
- `server/services/refunds.ts` — status `refunded` before Stripe; restore on Stripe failure
- `server/services/checkin.ts` — online “Refunded — do not admit”
- `test/integration/checkin-and-refunds.test.ts` — covered

### Stripe-side refund / fraud (broken)
- `server/api/webhooks/stripe.post.ts` — six event types; `default: return` for the rest (incl. `charge.refunded`)
- No `dispute` / fraud handlers anywhere in repo search
- `app/pages/legal/refunds.vue` — promises dispute cancellation; code does not
- `server/api/seller/orders/[id]/refund.post.ts` — on failure, directs staff to Stripe Dashboard
- Orders UI posts `{}` — never sends `fraudulent` reason

### Offline / slow-network gate
- `app/composables/useGateScanner.ts` + `server/api/scanner/bundle.get.ts` — void list only at load
- Offline: valid signature + id not in `unavailableTicketIds` → admit
- Online: 1.5s timeout then same offline path
- `server/api/checkin/sync.post.ts` — synced `refunded` scan not counted as operator conflict

### Deployed corroboration (this workspace)
- Test/prod scanner chunks: `unavailableTicketIds` → else `Valid — admit`; detail text “when this device last synced”
- Seller orders chunk: `POST /api/seller/orders/:id/refund`, fee retained by default, `buyerEmailed` toast
- Wallet chunk: `refunded` → “Refunded — no longer valid”
- `POST /api/webhooks/stripe` on test: exists, signature-verified (event-type list not exposed without source)

---

## Live tests still to run (test only)

Prod has real money — use `test.ticket.thenetvr.com` + Stripe test mode only.

1. Buy with `bounce@simulator.amazonses.com` — any dashboard warning? Close success page; can buyer recover tickets?
2. Buy with `4242…4242`, refund in **Stripe Dashboard**, scan + open wallet; then click Refund in the app and record the restore-to-valid behavior.
3. Buy with `4000 0000 0000 0259` (auto dispute) — scan afterward.
4. Load event on `/scan`, refund in-app, airplane mode, scan; reconnect — is there a conflict?

---

## Fixes to suggest

1. **Webhook:** handle `charge.refunded` and `charge.dispute.created` (and ideally `radar.early_fraud_warning.created`); void matching tickets the same way in-app refunds do. Align legal refunds copy with reality until shipped.
2. **Manual void:** add a “Void ticket” / “Void order” action that does **not** call Stripe (needed after Dashboard refunds and for fraud).
3. **Email delivery:** persist send/bounce/complaint state on the order (or outbox table); seller “Resend tickets”; optional buyer lookup-by-email with strict rate limits.
4. **Gate scanner:** while online, refresh `unavailableTicketIds` on an interval; treat a synced offline scan of a `refunded` ticket as a **conflict** the operator must see—not only `already_used`.

---

## Priority for November / December events

| Priority | Item | Why |
| --- | --- | --- |
| P0 | Stripe `charge.refunded` + `charge.dispute.created` → void | Live money path; policy page already promises dispute cancel |
| P0 | Manual void without Stripe | Unblocks staff after Dashboard refund / failed in-app refund |
| P1 | Offline scanner refresh + conflict on refunded sync | Door can admit voided QR today |
| P1 | Email sent/failed flag + resend | Paid buyers with typo/bounce emails |
| P2 | Webhook timeout / duplicate-event hardening in `confirmOrderPaid` | Paid-but-pending / skipped-email races |
| P2 | Fix legal copy or implement it | Avoid promising dispute cancel before code does |
