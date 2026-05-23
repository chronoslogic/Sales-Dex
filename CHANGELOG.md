# Changelog

All notable changes to Sales Dex are documented here.

## [Unreleased]

### Changed

- Replaced the Salesforce CLI default-org star action with a local Sales Dex favorite classification.
- Added favorite persistence to local client information.
- Updated the table and documentation to use **Favorite** instead of **Default**.
- Protected in-progress client information edits from being overwritten by background org detail refreshes.
- Replaced the table **Copy alias** action with a red **Disconnect org** action that keeps the confirmation prompt.
- Replaced the header mark with a local Sales Dex SVG logo inspired by a red handheld scanner and Salesforce cloud lens.
- Added sortable org table headers with direction arrows.
- Kept logged-out orgs visible as **Disconnected** and added reconnect/remove actions for disconnected rows.
- Treat saved local orgs missing from Salesforce CLI as **Disconnected** so previously logged-out orgs do not vanish.
- Renamed the summary count to **Tracked orgs** to avoid confusing disconnected orgs with connected orgs.
- Cleaned raw Salesforce CLI warning text before showing it in the app.
- Allowed local-only disconnected orgs to be removed from the Sales Dex list.
- Backfilled username, org ID, instance URL, and login URL after login/reconnect or when a connected local row is missing details.
- Made Salesforce CLI JSON parsing tolerate warning text so org details are captured reliably.
- Added a connected-org clipboard action that copies a Codex-ready CLI connection prompt.
- Made client name required when starting a new Salesforce connection.
- Show New connection validation and login errors directly inside the modal.
- Disabled Client information fields while org details are loading and removed the Favorite checkbox from the form.
- Kept copy toast messages above the modal backdrop so they no longer appear blurred.
- Centered table headers and added subtle column lines for clearer table structure.
- Reworked the page background with a subdued blue circuit and hex-grid visual treatment.
- Changed app notices into centered Salesforce-style toast banners with titles and auto-dismiss for success and warning messages.
- Changed **Last log in at** to use a dedicated CLI login timestamp captured after successful Sales Dex login/reconnect actions.
- Added macOS universal packaging, stable release artifact names, and GitHub Release download links for Windows and macOS users.

## [0.1.1] - 2026-05-23

### Changed

- Replaced the always-visible side details panel with a modal opened from the org table.
- Moved the login form into a **New connection** header modal.
- Renamed **Client record** to **Client information**.
- Renamed **Last used** to **Last log in at**.
- Reworked README and user guide to be easier for non-technical users.
- Added a clearer **How To Install** section.
- Clarified that Eduardo is the maintainer and users only download the app for now.

### Fixed

- Fixed the initial org details empty state clipping caused by a shared compact CSS class.
- Fixed setting the default org by using global Salesforce CLI config instead of project-local config.
- Fixed mobile header wrapping so all top actions stay visible.

## [0.1.0] - 2026-05-23

### Added

- Initial Sales Dex desktop/web app.
- Local React interface for managing Salesforce CLI orgs.
- Local Node/Express API with allowlisted Salesforce CLI actions.
- Org inventory using `sf org list --json`.
- Org details using `sf org display --target-org <alias> --json`.
- Client metadata stored locally in JSON.
- Quick actions:
  - copy alias
  - copy username
  - open org
  - set default org
  - refresh status
  - disconnect org
  - start web login
- English UI.
- Premium Sales Dex visual identity.
- Windows portable executable build.
- Example metadata file at `data/orgs.example.json`.

### Security

- Added `.gitignore` rules to avoid committing local org metadata, release artifacts, logs, and screenshots.
- API moved to `/local-api/*` to reduce conflicts with browser blockers.
- Removed arbitrary command execution from the product design.
- Action endpoints do not return raw Salesforce CLI command payloads.

### Known Limitations

- Windows artifact is not code signed.
- macOS artifact generation is configured but should be built on macOS.
- macOS distribution still needs Developer ID signing and notarization for a polished rollout.
- Auto-update is not implemented yet.
