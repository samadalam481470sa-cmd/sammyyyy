# Newport Portfolio Intelligence

A responsive CRM wireframe for Newport Specialty Partners. The MVP centralizes MGA acquisition targets, historical EBITDA, insurance programs, regional reach, and associated retail agencies.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Validation

```bash
npm test
npm run build
```

## Data model

The PostgreSQL MVP schema is in `database/schema.sql`. It includes:

- Pipeline and acquired MGA records
- Annual EBITDA history and a year-over-year performance view
- Multiple insurance programs per MGA
- Normalized lines of business, coverage types, and regions
- Retail agencies linked to their associated MGA
