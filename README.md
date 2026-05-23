# Sales Dex

**Sales Dex** is a local desktop app for Salesforce consultants, admins, and developers who work across many clients and orgs in the same day.

It gives users a clean command center for Salesforce CLI orgs: see what is connected, identify production vs sandbox, attach client context, validate connection status, open orgs, set a default target, and start new CLI logins without memorizing aliases or long commands.

Sales Dex was created by **Eduardo Souza**.

## Purpose

Working with multiple Salesforce clients usually means switching between many browser sessions, CLI aliases, production orgs, sandboxes, and local terminal commands. Sales Dex reduces that context-switching friction.

The app does **not** replace Salesforce CLI. It sits on top of the local `sf` CLI and makes the active org inventory easier to see, organize, and use safely.

## What Sales Dex Does

- Lists Salesforce orgs authenticated in the local Salesforce CLI.
- Shows org details such as username, alias, Org ID, instance URL, login URL, status, environment, and API version.
- Lets users associate a CLI org with local client metadata:
  - client name
  - environment
  - risk level
  - notes
- Provides quick actions:
  - copy alias
  - copy username
  - open org in browser
  - set org as default CLI target
  - refresh connection status
  - disconnect org from local CLI
  - start a new web login
- Keeps actions allowlisted. There is no free-form terminal command box.

## What Sales Dex Does Not Do

- It does not store Salesforce passwords.
- It does not upload org data to a cloud service.
- It does not run arbitrary shell commands.
- It does not make metadata or data changes inside Salesforce.
- It does not replace normal Salesforce permissions, MFA, session policies, or CLI authentication.

## How It Works

Sales Dex runs entirely on the user's machine.

```text
Sales Dex desktop UI
  -> local Node/Express API
  -> allowlisted Salesforce CLI commands
  -> local JSON metadata file
```

The local API executes specific Salesforce CLI commands:

| Feature | Salesforce CLI command |
| --- | --- |
| List orgs | `sf org list --json` |
| Show org details | `sf org display --target-org <alias> --json` |
| Open org | `sf org open --target-org <alias>` |
| Set default org | `sf config set target-org=<alias>` |
| Disconnect org | `sf org logout --target-org <alias>` |
| New login | `sf org login web --alias <alias>` |

## Requirements

For regular users:

- Windows or macOS.
- Salesforce CLI installed.
- The `sf` command available to the app.
- A Salesforce account for each org the user wants to authenticate.
- Browser access for Salesforce CLI web login.

For developers:

- Node.js.
- npm.
- Git.
- Salesforce CLI.

Current development stack:

| Dependency | Version |
| --- | --- |
| Sales Dex | `0.1.0` |
| Electron | `42.2.0` |
| React | `19.2.6` |
| Vite | `7.3.3` |
| Express | `5.2.1` |
| TypeScript | `5.9.3` |
| Salesforce CLI | External local dependency |

## Install and First Use

1. Install Salesforce CLI.
2. Authenticate at least one org:

```bash
sf org login web --alias client-prod
```

3. Open Sales Dex.
4. Click **Refresh**.
5. Select an org row to validate details.
6. Fill in client metadata if desired.
7. Use quick actions from the table or details panel.

## Local Metadata

Sales Dex stores client labels, risk level, environment, and notes locally.

In development, the file is:

```text
data/orgs.json
```

In the packaged desktop app, the file is stored in the user's app data directory. This keeps each user's client metadata private to their machine.

An example file is available at:

```text
data/orgs.example.json
```

Do not commit real `data/orgs.json` files. They can contain usernames, aliases, Org IDs, client names, and notes.

## Safety Model

Sales Dex is intentionally conservative:

- API endpoints are scoped under `/local-api/*`.
- There is no endpoint for arbitrary shell commands.
- Actions are allowlisted in code.
- Production orgs are visibly labeled.
- Setting a production org as default requires confirmation.
- Disconnecting an org requires confirmation.
- Action responses avoid returning raw Salesforce CLI payloads.

Sales Dex is still a local tool that can affect the user's Salesforce CLI state. Users should confirm the selected org before setting defaults, opening production orgs, or logging out.

## Desktop Builds

Build the Windows portable executable:

```bash
npm run dist:win
```

Build macOS artifacts from a Mac runner or Mac machine:

```bash
npm run dist:mac
```

Build outputs are generated in:

```text
release/
```

The current Windows artifact is:

```text
Sales-Dex-0.1.0-x64.exe
```

## Development

Install dependencies:

```bash
npm install
```

Run the web app and local API:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Run the desktop app:

```bash
npm run desktop
```

Build the frontend:

```bash
npm run build
```

## Repository Contents

```text
electron/          Electron desktop entrypoint
server/            Local Node/Express API
src/               React UI
data/              Local metadata examples
build/             App icon assets
release/           Generated app artifacts, ignored by git
```

## Current Status

Version `0.1.0` is the first internal MVP.

It supports Windows packaging today. macOS support is architecturally supported through Electron, but production-ready macOS distribution should add Apple code signing and notarization.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

No public license has been selected yet. Treat this repository as private/internal unless a license is added.
