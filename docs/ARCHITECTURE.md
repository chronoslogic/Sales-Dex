# Sales Dex Architecture

Sales Dex is a local-first Electron application.

## Components

```text
Electron shell
  -> React frontend
  -> Local Express API
  -> Salesforce CLI
  -> Local JSON metadata
```

## Frontend

The UI is built with React and Vite.

Main file:

```text
src/main.tsx
```

Styles:

```text
src/styles.css
```

## Local API

The local API is implemented in:

```text
server/server.mjs
```

Endpoints are scoped under:

```text
/local-api/*
```

## Desktop Entry Point

Electron starts the local API and loads the packaged frontend.

```text
electron/main.cjs
```

## Data Storage

Development:

```text
data/orgs.json
```

Packaged desktop app:

```text
<user app data>/Sales Dex/data/orgs.json
```

## Packaging

Electron Builder creates desktop artifacts.

Windows portable:

```bash
npm run dist:win
```

macOS:

```bash
npm run dist:mac
```

Release artifacts use stable names so GitHub latest-download links do not change between versions:

```text
Sales-Dex-Windows-x64.exe
Sales-Dex-macOS-arm64.dmg
Sales-Dex-macOS-x64.dmg
Sales-Dex-macOS-arm64.zip
Sales-Dex-macOS-x64.zip
```

Windows builds run on `windows-latest`.
macOS builds run on `macos-latest` because macOS packages must be built on macOS.
