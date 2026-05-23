# Changelog

All notable changes to Sales Dex are documented here.

## [Unreleased]

### Changed

- Reworked README and user guide to be easier for non-technical users.
- Added a clearer **How To Install** section.
- Clarified that Eduardo is the maintainer and users only download the app for now.

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
