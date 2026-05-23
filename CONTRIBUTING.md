# Contributing

Sales Dex is currently an internal MVP. Contributions should keep the app simple, local-first, and safe for Salesforce multi-client work.

## Development Setup

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Build Checks

Before opening a pull request:

```bash
npm run build
```

For Windows packaging:

```bash
npm run dist:win
```

## Contribution Guidelines

- Keep Salesforce CLI actions allowlisted.
- Do not add arbitrary command execution.
- Do not commit real org metadata, logs, screenshots, or release files.
- Keep user-facing text in English.
- Keep the UI clear about production vs sandbox orgs.
- Prefer small, maintainable changes.

## Adding Salesforce Actions

Any new action should document:

- the exact Salesforce CLI command
- why the command is needed
- whether it changes local CLI state
- whether it changes Salesforce org data or metadata
- what confirmation is required

Write capabilities inside Salesforce should be treated as high risk and reviewed separately.
