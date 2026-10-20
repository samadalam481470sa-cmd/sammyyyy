# sammyyyy

Scratchpad for TheNetTicket operational audits and harnesses (the app source lives elsewhere).

| Path | Purpose |
| --- | --- |
| [docs/thenetticket-signin-flaws.md](docs/thenetticket-signin-flaws.md) | Flaws found in live `/sign-in?redirect=/dashboard` (open redirect, localhost appUrl, `/scan` cold auth) |
| [docs/thenetticket-fraud-failure-results.md](docs/thenetticket-fraud-failure-results.md) | David fraud/failure matrix: email, refunds, disputes, offline void — code findings on test + what’s still blocked |
| [docs/thenetticket-concurrency-testing.md](docs/thenetticket-concurrency-testing.md) | How to test 10–100 concurrent buyers (Vitest races, HTTP load, Cursor subagents) |
| [concurrency-test/](concurrency-test/) | Runnable fee check + read load + staging buyer-race harness |

```bash
cd concurrency-test && npm run all-safe
```
