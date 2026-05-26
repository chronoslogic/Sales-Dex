# Sales Dex

**Sales Dex** is a local desktop app that helps Salesforce teams see and manage the Salesforce orgs connected on their computer.

It is especially useful for people who work with multiple clients, sandboxes, and production orgs during the same day.

Created by **Eduardo Souza** with **Codex**.

## Download

Download the latest version from the GitHub Releases page:

[Download Sales Dex](https://github.com/chronoslogic/Sales-Dex/releases/latest)

Current version:

```text
0.1.3
```

Current available download:

| System | Download |
| --- | --- |
| Windows 64-bit | [Sales-Dex-Windows-x64.exe](https://github.com/chronoslogic/Sales-Dex/releases/latest/download/Sales-Dex-Windows-x64.exe) |
| macOS Apple Silicon | [Sales-Dex-macOS-arm64.dmg](https://github.com/chronoslogic/Sales-Dex/releases/latest/download/Sales-Dex-macOS-arm64.dmg) |
| macOS Intel | [Sales-Dex-macOS-x64.dmg](https://github.com/chronoslogic/Sales-Dex/releases/latest/download/Sales-Dex-macOS-x64.dmg) |

## What Sales Dex Does

Sales Dex shows the Salesforce orgs that are already connected on your computer through Salesforce CLI.

With Sales Dex, you can:

- see which Salesforce orgs are connected
- identify production orgs and sandboxes
- see the username, alias, Org ID, and instance URL
- add a client name and notes to each org
- mark an org risk level as Low, Medium, or High
- favorite important orgs inside Sales Dex
- open an org in the browser
- disconnect an org from your local Salesforce CLI
- start a new Salesforce login

## What Sales Dex Does Not Do

Sales Dex does **not**:

- store Salesforce passwords
- upload org information to a cloud server
- change Salesforce data
- deploy metadata
- create or edit Salesforce configuration
- replace Salesforce permissions, MFA, or login security

It is a local helper app for org visibility and switching.

## Requirements

Before using Sales Dex, each user needs:

- Windows or macOS computer
- Salesforce CLI installed
- access to at least one Salesforce org
- permission to log in to that Salesforce org

Sales Dex depends on Salesforce CLI. If Salesforce CLI is not installed, Sales Dex will not be able to list or open orgs.

Official Salesforce CLI download page:

[Salesforce CLI Downloads](https://developer.salesforce.com/tools/salesforcecli/)

## How To Install

### Step 1: Install Salesforce CLI

1. Open the official Salesforce CLI download page:

   [Salesforce CLI Downloads](https://developer.salesforce.com/tools/salesforcecli/)

2. Choose the installer for your computer.

   Most Windows users should choose **Download for Windows x64**.

   Most macOS users should choose the macOS installer for their Mac.

3. Run the Salesforce CLI installer.

4. After installation, open Command Prompt or PowerShell and type:

   ```bash
   sf --version
   ```

5. If you see a version number, Salesforce CLI is installed correctly.

### Step 2: Download Sales Dex

1. Open the latest Sales Dex release:

   [Sales Dex Releases](https://github.com/chronoslogic/Sales-Dex/releases/latest)

2. Download the file for your computer:

   | System | File |
   | --- | --- |
   | Windows | [Sales-Dex-Windows-x64.exe](https://github.com/chronoslogic/Sales-Dex/releases/latest/download/Sales-Dex-Windows-x64.exe) |
   | macOS Apple Silicon | [Sales-Dex-macOS-arm64.dmg](https://github.com/chronoslogic/Sales-Dex/releases/latest/download/Sales-Dex-macOS-arm64.dmg) |
   | macOS Intel | [Sales-Dex-macOS-x64.dmg](https://github.com/chronoslogic/Sales-Dex/releases/latest/download/Sales-Dex-macOS-x64.dmg) |

   Most newer Macs use **Apple Silicon**. Older Macs use **Intel**. If you are not sure, open the Apple menu and click **About This Mac**.

3. Save it somewhere easy to find, for example:

   ```text
   Downloads
   Desktop
   Company Tools
   ```

### Step 3: Open Sales Dex

#### Windows

1. Double-click `Sales-Dex-Windows-x64.exe`.

2. If Windows shows a security warning, confirm that the file came from the official company/GitHub release before opening it.

3. Sales Dex will open as a desktop app.

4. Click **Refresh**.

#### macOS

1. Double-click the macOS `.dmg` file you downloaded.

2. Drag **Sales Dex** into **Applications** if macOS asks.

3. Open **Sales Dex** from Applications.

4. If macOS blocks the app because it is not signed yet, right-click **Sales Dex**, click **Open**, and confirm that the file came from the official company/GitHub release.

5. Click **Refresh**.

## First Use

If you already logged in to Salesforce CLI before, your orgs should appear after clicking **Refresh**.

If no orgs appear:

1. In Sales Dex, click **New connection**.
2. Enter the client name.
3. Enter an alias, for example:

   ```text
   client-prod
   ```

4. Choose **Production** or **Sandbox**.
5. Click **Start login**.
6. Your browser will open Salesforce login.
7. Log in normally.
8. Return to Sales Dex and click **Refresh**.

## Button Guide

| Button | What it does |
| --- | --- |
| Refresh | Reloads the org list from Salesforce CLI. |
| Copy alias | Copies the org alias to your clipboard. |
| Copy username | Copies the Salesforce username to your clipboard. |
| Codex prompt | Copies a ready-to-paste prompt for Codex to verify and use the connected Salesforce CLI org. |
| Open | Opens the selected org in your browser. |
| Favorite | Marks or unmarks the org as a Sales Dex favorite. |
| Status | Checks the selected org connection again. |
| Disconnect | Logs the selected org out of Salesforce CLI on your computer and keeps it visible as **Disconnected**. |
| Reconnect | Starts Salesforce login again for a disconnected org. |
| Remove from list | Removes a disconnected org from the local Sales Dex list. |
| Start login | Starts a new Salesforce login after a client name and alias are entered. |
| Save client information | Saves client name, environment, risk level, favorite, and notes on your computer. |

## Important Safety Notes

- Always check whether an org is **Production** or **Sandbox** before using it.
- Disconnecting an org only logs it out from your local Salesforce CLI. It stays visible in Sales Dex until you reconnect it or remove it from the local list.
- Sales Dex stores your notes and client labels locally on your machine.
- Sales Dex does not send your Salesforce org list to an external server.

## Updates

For now, users do not update the app themselves from inside Sales Dex.

When a new version is ready, Eduardo will publish it in GitHub Releases. Users can download the new version from:

[Sales Dex Releases](https://github.com/chronoslogic/Sales-Dex/releases)

## Troubleshooting

### Sales Dex opens, but no orgs appear

Click **Refresh**.

If the list is still empty, Salesforce CLI may not have any logged-in orgs yet. Use **New connection** in Sales Dex, or ask the maintainer for help.

### Salesforce CLI is not installed

Install Salesforce CLI from the official Salesforce download page:

[Salesforce CLI Downloads](https://developer.salesforce.com/tools/salesforcecli/)

### Windows blocks the app

The current Windows app is not code signed yet. Windows may show a warning the first time you open it.

Only open the file if you downloaded it from the official Sales Dex GitHub release or received it from the maintainer.

### I need help

Contact the maintainer:

```text
Eduardo
```

## For Maintainers

The sections below are for the person maintaining Sales Dex.

Regular users do not need these steps.

### Development Setup

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

### Build Windows App

```bash
npm run dist:win
```

The executable is generated in:

```text
release/
```

### Build macOS App

```bash
npm run dist:mac
```

macOS builds should be created on a Mac or a macOS GitHub Actions runner.

The GitHub release workflow builds:

```text
Sales-Dex-Windows-x64.exe
Sales-Dex-macOS-arm64.dmg
Sales-Dex-macOS-x64.dmg
Sales-Dex-macOS-arm64.zip
Sales-Dex-macOS-x64.zip
```

To publish a release, push a version tag such as:

```bash
git tag v0.1.3
git push origin v0.1.3
```

GitHub Actions will attach the Windows and macOS downloads to the release.

### Technical Stack

| Dependency | Version |
| --- | --- |
| Sales Dex | `0.1.3` |
| Electron | `42.2.0` |
| React | `19.2.6` |
| Vite | `7.3.3` |
| Express | `5.2.1` |
| TypeScript | `5.9.3` |
| Salesforce CLI | External local dependency |

## More Documentation

- [User Guide](docs/USER_GUIDE.md)
- [Security Notes](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Architecture](docs/ARCHITECTURE.md)

## License

No public license has been selected yet. Treat this repository as private/internal unless a license is added.
