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

Dry-run only — no staging `EVENT_PATH` / ticket-type IDs available from this workspace. Production write races are refused by the harness (Terms §8 + real capacity risk).

Next step on staging: create a throwaway event with `capacity = 5`, then:

```bash
BASE_URL=https://<staging> EVENT_PATH=/venue/.../... \
TICKET_TYPE_ID=… ENTRY_TIME_ID=… CAPACITY=5 \
npm run race-buyers -- --users 20 --write
```

Pair with 3 browser subagents for the last-ticket UX check (see `docs/thenetticket-concurrency-testing.md`).
