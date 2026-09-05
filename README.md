# RecoverAI

RecoverAI is an explainable payment-recovery operations workspace: deterministic rules decide the financial action, while AI only personalizes customer communication.

## Why it matters

Payment failures are expensive, noisy, and difficult to audit. RecoverAI classifies failures, prioritizes recovery work, records the decision trace, and keeps AI away from financial authority.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local preview URL printed by the dev server.

## Demo pitch

Simulate a failed payment, watch the rule engine classify it in one click, retry it in demo mode, and generate a customer message without allowing AI to change the decision.

The demo includes CSV exports, recovery timelines, audit logs, reusable message templates, analytics, and a Reset Demo Data control.
