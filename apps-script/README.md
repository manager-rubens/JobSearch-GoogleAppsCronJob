# Job Search Google Apps Cron Job

Google Apps Script project for Ruben's job-search digests.

The script supports two delivery modes:

- Web App endpoint: accepts a JSON payload and sends an HTML email with `GmailApp.sendEmail(..., { htmlBody })`.
- Gmail payload relay: reads internal Gmail messages with subject `[JOB_DIGEST_PAYLOAD]`, parses the JSON payload, and sends the same HTML email. This is useful when an external cron environment cannot reach the Apps Script Web App URL directly.

## Templates

The script currently renders two generic templates:

- `job-alerts`: generic digest for job alert emails from sources such as LinkedIn, Glassdoor, recruiters, or saved searches.
- `company-jobs`: configurable company careers digest. The company, logo, colors, source label, headline, and location/title copy all come from the payload.

The renderer is selected by `payload.template`. Company-specific search logic belongs in the Codex cron job payload generation, not in this Apps Script project.

## Files

- `Code.gs`: Apps Script source.
- `appsscript.json`: Apps Script manifest.
- `sample-payloads/job-alerts.json`: example payload for the generic digest.
- `sample-payloads/company-jobs.json`: example payload for a configurable company careers digest.

## Setup

1. Create or open a standalone Google Apps Script project.
2. Copy `Code.gs` into the Apps Script editor.
3. Copy `appsscript.json` into the project manifest.
4. Run `setupScriptProperties()` once.
5. Copy the `WEBHOOK_TOKEN` from the execution log.
6. Use that token in Codex cron payloads or test payloads.

## Deploy as Web App

1. Click `Deploy` -> `New deployment`.
2. Select type `Web app`.
3. Set `Execute as` to `Me`.
4. Set access to `Anyone with the link`.
5. Deploy and copy the Web App URL.

This endpoint accepts POST JSON payloads:

```json
{
  "token": "YOUR_WEBHOOK_TOKEN",
  "template": "company-jobs",
  "companyName": "Empresa Exemplo",
  "brandLogoUrl": "https://example.com/logo.png",
  "brandColor": "#102a33",
  "brandAccentColor": "#0ea5a3",
  "sourceLabel": "Fonte oficial da empresa",
  "locationLabel": "Vagas em Sao Paulo",
  "to": "manager.rubens@gmail.com",
  "subject": "Vagas Empresa Exemplo em Sao Paulo - 2026-05-04",
  "headline": "Ruben, encontrei vagas abertas da Empresa Exemplo em Sao Paulo.",
  "stats": {
    "emailsScanned": 0,
    "jobsExtracted": 12,
    "jobsSelected": 3
  },
  "signals": ["Empresa Exemplo", "Sao Paulo", "Lideranca", "Delivery"],
  "jobs": [],
  "otherJobs": [],
  "ignored": [],
  "note": "Avaliacao baseada em fonte publica ou oficial de carreiras."
}
```

## Gmail Payload Relay

Use this when the automation environment can send Gmail but cannot call the Web App URL.

1. Run `setupPayloadRelayTrigger()` once.
2. The script creates two daily triggers:
   - around `08:15` America/Sao_Paulo
   - around `20:15` America/Sao_Paulo
3. Codex sends an internal email to `manager.rubens@gmail.com`:
   - Subject: `[JOB_DIGEST_PAYLOAD] <automation-id> YYYY-MM-DD`
   - Body: raw JSON payload.
4. The trigger reads unprocessed payload emails, sends the HTML digest, labels the payload thread as `CodexDigestProcessed`, and archives it.

Errors are labeled as `CodexDigestError` and reported by email.

## Local Tests in Apps Script

After running `setupScriptProperties()`, run:

- `testSendJobAlertsDigest()`
- `testSendCompanyJobsDigest()`

Both functions use the stored `WEBHOOK_TOKEN` and send to the configured `DEFAULT_TO`.

## Security

Do not commit real tokens into this repository.

Secrets belong in Apps Script Properties:

- `WEBHOOK_TOKEN`
- `DEFAULT_TO`

Sample payloads use placeholder tokens only.
