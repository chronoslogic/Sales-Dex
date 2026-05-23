# Security

Sales Dex is a local tool that runs Salesforce CLI commands on the user's machine. It is designed to reduce context-switching risk, but users should still treat it as part of their Salesforce administration workflow.

## Local-Only Design

Sales Dex does not use a hosted backend. The app runs locally and calls the local Salesforce CLI.

```text
Desktop UI -> local API -> local Salesforce CLI
```

## Sensitive Data

Sales Dex may display or store:

- Salesforce usernames
- org aliases
- Org IDs
- instance URLs
- local client labels
- local notes entered by the user

Do not commit `data/orgs.json`, screenshots, logs, or release artifacts that contain real client information.

## Command Execution

Sales Dex does not expose a free-form shell command endpoint.

The local API only runs specific allowlisted Salesforce CLI commands needed by the UI. New commands should be reviewed carefully before being added.

## Production Org Safety

Production orgs are clearly labeled. Some actions, such as setting a production org as default, require confirmation.

Before adding any future write capability, the app should require:

- selected org confirmation
- environment confirmation
- impact summary
- explicit user approval
- audit-friendly local logging

## Reporting Security Issues

For now, report security concerns directly to the repository owner or project maintainer.
