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

1. Open the Sales Dex Releases page:

   [Sales Dex Releases](https://github.com/chronoslogic/Sales-Dex/releases/latest)

2. Download the Windows file:

   ```text
   Sales-Dex-0.1.0-x64.exe
   ```

3. Save the file somewhere easy to find.

4. Double-click the file to open Sales Dex.

5. If Windows shows a warning, make sure the file came from the official release page or from Eduardo before opening it.

6. Click **Refresh**.

### macOS

macOS downloads are not available yet.

The app is designed to support macOS later, but the current release is Windows-only.

## First Login

If Sales Dex opens but shows no orgs, you probably have not logged in to Salesforce CLI yet.

Use the **New login** panel:

1. Enter an alias.

   Example:

   ```text
   client-prod
   ```

2. Choose **Production** or **Sandbox**.

3. Click **Start login**.

4. Log in to Salesforce in your browser.

5. Return to Sales Dex.

6. Click **Refresh**.

## Main Screen

The main table shows:

- client
- alias
- username
- Org ID
- instance URL
- production or sandbox
- connection status
- last used date
- whether the org is the default org

Click an org row to see more details.

## Client Record

When you select an org, you can save extra local information:

- client name
- environment
- risk level
- notes

This is only saved on your computer.

## Buttons

| Button | Meaning |
| --- | --- |
| Refresh | Reloads the org list. |
| Copy alias | Copies the org alias. |
| Copy username | Copies the username. |
| Open | Opens the org in your browser. |
| Default | Sets the org as your default Salesforce CLI org. |
| Status | Checks the org connection again. |
| Disconnect | Logs the org out from Salesforce CLI on your computer. |
| Start login | Starts a new Salesforce login. |
| Save local record | Saves client notes on your computer. |

## Safety Tips

- Check whether the org is **Production** or **Sandbox**.
- Be extra careful with production orgs.
- Only set a production org as default when you are sure it is correct.
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
