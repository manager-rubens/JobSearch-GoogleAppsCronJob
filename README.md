# JobSearch-GoogleAppsCronJob

Google Apps Script source for Ruben's automated job-search email digests.

The project lives in [`apps-script/`](apps-script/):

- generic job-alert digest template
- configurable company careers digest template
- Gmail payload relay for Codex cron jobs that cannot call external endpoints
- Web App endpoint for direct POST delivery

Company selection and company-specific search rules belong in the Codex cron job. This Apps Script project only renders and sends the payload it receives.

See [`apps-script/README.md`](apps-script/README.md) for setup and deployment instructions.
