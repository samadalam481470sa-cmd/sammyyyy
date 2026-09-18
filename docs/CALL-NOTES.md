# 7:00 PM review — screen plan and decisions needed

## Five-screen wireframe

```text
NEWPORT
┌───────────────────────────────────────────────────────────────────────┐
│ Executive overview                                                   │
│ [Platform EBITDA] [MGAs owned] [Live pipeline] [Retail agencies]     │
│ [Aggregate EBITDA chart................] [Acquisition thesis....]     │
│ [Top targets...........................] [Portfolio overlap......]     │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│ Insurance spreadsheet                      [Everyone at Newport] Share│
│ [+ Add row] [Search................] [Filters] [Export] [Backup]      │
│ # │ Policy │ Client │ Status │ MGA │ LOB │ Region │ Premium │ ...    │
│ 1 │ NSP... │ ...editable cells, frozen headers, large scroll grid... │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│ Clients & follow-ups                                                 │
│ [Client accounts] [Open follow-ups] [Renewals due] [At risk]         │
│ [Client register........................] [Due follow-up queue...]     │
│                                            [Add to Outlook] [Complete]│
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│ M&A pipeline                                                         │
│ [Sourced] [Qualified] [Diligence] [Under LOI]                        │
│ [20+ years] [12%+ CAGR] [$2M+ EBITDA] [Region / LOB filters]         │
│ [Targets ranked by transparent thesis fit........................]    │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│ One platform / synergy analysis                                      │
│ [Aggregate EBITDA] [Capability overlap matrix]                       │
│ [Pairwise MGA overlap] [Single-source capabilities] [Cross-sell]     │
└───────────────────────────────────────────────────────────────────────┘
```

## Ask Mary to confirm these before the next iteration

1. Is EBITDA really “before interest, bad debt and taxes,” or should the board
   view use conventional EBITDA with bad debt shown only as an adjustment?
2. Should the growth screen use CAGR across all available actual years, latest
   YoY growth, or both? The MVP ranks on FY21–FY25 actual CAGR and displays YoY.
3. Does “region” mean where the MGA is headquartered, where the program is
   filed, or where premium is actually written? The MVP uses program-written
   region and keeps headquarters separately.
4. Are line of business and coverage type separate dimensions on her screen?
   The MVP separates them because “Commercial Property” and “Excess & Surplus”
   answer different questions.
5. Can a retail agency place through multiple platform MGAs? If yes, replace the
   current one-MGA foreign key with an appointment table.
6. Is 20 years a hard gate or a flag? The MVP flags a nineteen-year operator but
   does not hide it, so the board can make the exception deliberately.
7. Does “everyone” mean every Newport employee in Entra ID, all Lovell Minnick
   advisors, or both? This determines the SSO organization boundary.
8. Which client events must sync to Outlook: only manually scheduled follow-ups,
   or also automatic renewal reminders 120/90/60 days before expiration?
9. Who may edit the main insurance register, and who may only view it? The MVP
   defaults everyone to viewer and supports explicit editor grants.
10. What must a backup restore guarantee, and how long should backups be kept?
    The MVP provides a complete JSON export; production needs encrypted scheduled
    backups plus a tested restore procedure.
