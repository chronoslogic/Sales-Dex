# Sales Dex User Guide

This guide explains how to install and use Sales Dex.

Sales Dex is for users who work with multiple Salesforce orgs and want an easier way to see which orgs are connected on their computer.

## Before You Install

You need Salesforce CLI installed first.

Official Salesforce CLI download page:

[Salesforce CLI Downloads](https://developer.salesforce.com/tools/salesforcecli/)

If you are not sure whether Salesforce CLI is installed, ask the maintainer or your team lead.

## How To Install Sales Dex

### Windows

1. Download the Windows app:

   [Sales-Dex-Windows-x64.exe](https://github.com/chronoslogic/Sales-Dex/releases/latest/download/Sales-Dex-Windows-x64.exe)

2. Save the file somewhere easy to find.

3. Double-click the file to open Sales Dex.

4. If Windows shows a warning, make sure the file came from the official release page or from Eduardo before opening it.

5. Click **Refresh**.

### macOS

1. Download the macOS app for your Mac:

   | Mac type | File |
   | --- | --- |
   | Apple Silicon | [Sales-Dex-macOS-arm64.dmg](https://github.com/chronoslogic/Sales-Dex/releases/latest/download/Sales-Dex-macOS-arm64.dmg) |
   | Intel | [Sales-Dex-macOS-x64.dmg](https://github.com/chronoslogic/Sales-Dex/releases/latest/download/Sales-Dex-macOS-x64.dmg) |

   Most newer Macs use **Apple Silicon**. Older Macs use **Intel**. If you are not sure, open the Apple menu and click **About This Mac**.

2. Open the `.dmg` file.

3. Drag **Sales Dex** into **Applications** if macOS asks.

4. Open **Sales Dex** from Applications.

5. If macOS blocks the app because it is not signed yet, right-click **Sales Dex**, click **Open**, and confirm that it came from the official release page or from Eduardo.

6. Click **Refresh**.

## First Login

If Sales Dex opens but shows no orgs, you probably have not logged in to Salesforce CLI yet.

Use the **New connection** panel:

1. Enter the client name.

2. Enter an alias.

   Example:

   ```text
   client-prod
   ```

3. Choose **Production** or **Sandbox**.

4. Click **Start login**.

5. Log in to Salesforce in your browser.

6. Return to Sales Dex.

7. Click **Refresh**.

## Main Screen

The main table shows:

- client
- alias
- username
- Org ID
- instance URL
- production or sandbox
- connection status
- last Salesforce CLI login captured by Sales Dex
- whether the org is a Sales Dex favorite

Click an org row to see more details.

## Client Record

When you select an org, you can save extra local information:

- client name
- environment
- risk level
- favorite
- notes

This is only saved on your computer.

## Buttons

| Button | Meaning |
| --- | --- |
| Refresh | Reloads the org list. |
| Copy alias | Copies the org alias. |
| Copy username | Copies the username. |
| Codex prompt | Copies a prompt for Codex to verify and use the connected Salesforce CLI org. |
| Open | Opens the org in your browser. |
| Favorite | Marks or unmarks the org as a Sales Dex favorite. |
| Status | Checks the org connection again. |
| Disconnect | Logs the org out from Salesforce CLI on your computer and keeps it visible as **Disconnected**. |
| Reconnect | Starts Salesforce login again for a disconnected org. |
| Remove from list | Removes a disconnected org from the local Sales Dex list. |
| Start login | Starts a new Salesforce login after a client name and alias are entered. |
| Save client information | Saves client notes and favorite status on your computer. |

## Safety Tips

- Check whether the org is **Production** or **Sandbox**.
- Be extra careful with production orgs.
- Sales Dex does not change Salesforce data.
- Sales Dex does not store your Salesforce password.

## Updates

Users do not update the app from inside Sales Dex.

When a new version is available, Eduardo will publish it on the GitHub Releases page:

[Sales Dex Releases](https://github.com/chronoslogic/Sales-Dex/releases)

Download the newest version and use it instead of the old one.

## Need Help?

Contact the maintainer:

```text
Eduardo
```
