# sammyyyy

Scratchpad for TheNetTicket operational audits and harnesses (the app source lives elsewhere).

| Path | Purpose |
| --- | --- |
| [docs/thenetticket-concurrency-testing.md](docs/thenetticket-concurrency-testing.md) | How to test 10–100 concurrent buyers (Vitest races, HTTP load, Cursor subagents) |
| [concurrency-test/](concurrency-test/) | Runnable fee check + read load + staging buyer-race harness |

```bash
cd concurrency-test && npm run all-safe
```
