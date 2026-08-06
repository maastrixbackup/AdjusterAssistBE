# 🚀 AdjusterAssistBE - Release & Versioning Guide

This guide explains how to manage release versions, git tags, and deployments using `standard-version` and GitHub Actions.

---

## 📌 Available Release Commands

You don't need to manually update `package.json`. Use the following scripts to automate version bumps, changelogs, and Git tagging:

| Command                 | Usage Purpose                                    | Example Output Version        |
| :---------------------- | :----------------------------------------------- | :---------------------------- |
| `npm run release:dev`   | Development / Sprint testing builds on `develop` | `1.1.0-dev.0` → `1.1.0-dev.1` |
| `npm run release:patch` | Bug fixes & small patches for Production         | `1.1.0` → `1.1.1`             |
| `npm run release:minor` | New features added (backward compatible)         | `1.1.0` → `1.2.0`             |

---

## 🛠️ Scenario 1: Releasing a Development Build (On `develop` Branch)

Use this flow during active sprint development, internal testing, or when pushing updates to the Staging/Dev environment on Render.

### Step-by-Step Workflow:

1. **Ensure you are on the `develop` branch and up to date:**

   ```bash
   git checkout develop
   git pull origin develop

   ```

2. Run the pre-release command:
   `npm run release:dev`

    ### What this does automatically:
        Increments the prerelease version in package.json (e.g., 1.1.0-dev.0 → 1.1.0-dev.1).
        Generates/updates the CHANGELOG.
        Commits the changes locally.
        Creates the matching Git tag (e.g., v1.1.0-dev.1).

2. Push the commit AND tags to GitHub:
   `git push --follow-tags origin develop`


## Scenario 2: Releasing a Production Build
Use this flow when feature testing is complete and you are ready to publish a stable release to Production.

For a Bug Fix / Patch Release: `npm run release:patch`
(Bumps version e.g. from 1.1.0 to 1.1.1)

For a New Feature / Major Update: `npm run release:minor`
(Bumps version e.g. from 1.1.0 to 1.2.0)

Push production code AND tags to GitHub: `git push --follow-tags origin main`