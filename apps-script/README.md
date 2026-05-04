# Job Search Google Apps Cron Job

Google Apps Script project for Ruben's job-search digests.

The script supports two delivery modes:

- Web App endpoint: accepts a JSON payload and sends an HTML email with `GmailApp.sendEmail(..., { htmlBody })`.
- Gmail payload relay: reads internal Gmail messages with subject `[JOB_DIGEST_PAYLOAD]`, parses the JSON payload, and sends the same HTML email. This is useful when an external cron environment cannot reach the Apps Script Web App URL directly.

## Templates

The script currently renders two templates:

- `job-alerts`: generic LinkedIn/Glassdoor-style digest for job alert emails.
- `siemens-energy`: Siemens Energy branded digest with company logo and Siemens Energy palette.

The renderer is selected by `payload.template`.

## Files

- `Code.gs`: Apps Script source.
- `appsscript.json`: Apps Script manifest.
- `sample-payloads/job-alerts.json`: example payload for the generic digest.
- `sample-payloads/siemens-energy.json`: example payload for the Siemens Energy digest.

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
  "template": "job-alerts",
  "to": "manager.rubens@gmail.com",
  "subject": "Vagas recomendadas para Ruben - 2026-05-04",
  "headline": "Ruben, encontrei 3 vagas com bom alinhamento ao seu perfil.",
  "stats": {
    "emailsScanned": 10,
    "jobsExtracted": 30,
    "jobsSelected": 3
  },
  "signals": ["Tech Manager", "Liderança", "IA"],
  "jobs": [],
  "otherJobs": [],
  "ignored": [],
  "note": "Avaliação provisória quando a descrição completa não está pública."
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
- `testSendSiemensEnergyDigest()`

Both functions use the stored `WEBHOOK_TOKEN` and send to the configured `DEFAULT_TO`.

## Security

Do not commit real tokens into this repository.

Secrets belong in Apps Script Properties:

- `WEBHOOK_TOKEN`
- `DEFAULT_TO`

Sample payloads use placeholder tokens only.
