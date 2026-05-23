# Sales Dex User Guide

This guide is for people using Sales Dex as a desktop app.

## Before You Start

Install Salesforce CLI and authenticate at least one org:

```bash
sf org login web --alias client-prod
```

Sales Dex reads the orgs already authenticated in Salesforce CLI.

## Main Screen

The main table shows:

- client
- alias
- username
- Org ID
- instance URL
- environment type
- connection status
- last used date
- default org marker

Click any row to load detailed org information.

## Client Metadata

Sales Dex lets you add local context to each org:

- client name
- environment
- risk level
- notes

This information is stored only on your machine.

## Quick Actions

| Action | What it does |
| --- | --- |
| Copy alias | Copies the selected alias to the clipboard. |
| Copy username | Copies the username to the clipboard. |
| Open | Opens the org in the browser using Salesforce CLI. |
| Default | Sets the org as the local Salesforce CLI default target. |
| Status | Refreshes detailed connection status. |
| Disconnect | Logs the org out of Salesforce CLI on your machine. |
| Start login | Starts a Salesforce CLI web login with the alias you provide. |

## Important Notes

- Sales Dex does not know your Salesforce password.
- Sales Dex does not send org metadata to a remote server.
- Sales Dex can change your local default Salesforce CLI target.
- Always check the selected org before working with production.

## Troubleshooting

### No orgs appear

Run:

```bash
sf org list
```

If no orgs appear there, authenticate one:

```bash
sf org login web --alias client-prod
```

### Salesforce CLI is not found

Make sure `sf` works in a terminal:

```bash
sf --version
```

If it does not, install or repair Salesforce CLI.

### macOS cannot find `sf`

Apps launched from Finder may not inherit the same PATH as Terminal. Future versions may include explicit path detection for common locations such as:

```text
/opt/homebrew/bin/sf
/usr/local/bin/sf
```
