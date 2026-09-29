# Concurrency harness — run results (2026-09-28)

Target: `https://ticket.thenetvr.com`

## Fee check ($1.00 → $1.50)

All 7 checks **PASS**: homepage copy, Terms §7, effective date 2026-09-17, bundled `LEGAL.platformFee` from 150¢, no stale `$1` homepage string.

## Read load (safe against production)

| Users | Requests | Failures | p50 | p95 | Wall |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 60 | 0 | 113ms | 2893ms | 3.1s |
| 50 | 300 | 0 | 83ms | 2666ms | 4.2s |
| 100 | 600 | 0 | 87ms | 1698ms | 3.2s |

Public routes stayed healthy at 100 concurrent virtual users. The long p95 tail is consistent with occasional cold Lambda/CloudFront paths; p50 stays under ~120ms.

## Buyer write race

**Not yet runnable end-to-end from this agent.** Blockers (2026-09-29):

1. No public event on `dev.ticket.thenetvr.com` (all probed `/venue/...` → Event not found).
2. Automated seller signup on DEV is stopped by **Cloudflare Turnstile** (“Verify you are human”), so we cannot create a throwaway free event ourselves.
3. Production write races remain refused (Terms §8 + real capacity).

The harness now knows the real buyer API (`POST /api/orders` with `eventId`, `timeslotId`, `items`, `buyerEmail` + `Idempotency-Key`, then optional `POST .../checkout`).

**Unblock:** paste a DEV public event path (free tickets preferred), e.g. `/venue/your-venue/concurrency-load-test` with capacity ≥ 100 (happy path) or capacity 5 (oversell). Then:

```bash
BASE_URL=https://dev.ticket.thenetvr.com \
EVENT_PATH=/venue/.../... \
npm run race-buyers -- --users 100 --write --checkout
```
