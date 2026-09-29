# Concurrent buyer testing for TheNetTicket

Harnais for **10–100 concurrent users** against a TheNetTicket deployment, plus a fee regression check for the $1.50 platform fee.

Full playbook (layers A/B/C, when to use subagents): [../docs/thenetticket-concurrency-testing.md](../docs/thenetticket-concurrency-testing.md).

## Quick start

```bash
npm install
npm run fee-check
npm run read-load -- --users 10
npm run read-load -- --users 100
npm run all-safe          # fee-check + 10/50/100 read users
```

Write races (staging only):

```bash
BASE_URL=https://your-staging.example \
EVENT_PATH=/venue/demo/demo \
TICKET_TYPE_ID=… ENTRY_TIME_ID=… CAPACITY=5 \
npm run race-buyers -- --users 20 --write
```

## Outputs

Reports land in `out/` and are copied to `/opt/cursor/artifacts/` when that directory exists.
