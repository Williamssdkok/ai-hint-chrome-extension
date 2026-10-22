# Release checklist

1. Decide whether this is a Standard release, Lite release, or both.
2. Update the relevant `version` in `manifest.json` and/or `editions/lite/manifest.json`. Update the matching README, options badge, and store draft where needed.
3. Review the privacy statements, permissions, changelog/roadmap, and screenshot for the exact edition.
4. Build and inspect the ZIPs locally with `scripts/package.ps1 -Edition Standard` and `scripts/package.ps1 -Edition Lite`. Confirm the ZIP root contains `manifest.json` and the correct edition-specific files.
5. Commit and push the version change. Wait for the **Build extension editions** and **Secret scan** workflows to pass.
6. For a Standard release, push a `v` tag that exactly matches its manifest version (for example `v2.5.1`). For a Lite-only release, use `lite-v` plus its version (for example `lite-v1.2.0`).
7. The release workflow packages the editions and attaches ZIPs to a GitHub Release. Review the release files and notes.
8. If publishing to Chrome Web Store, upload only the matching ZIP, use that edition's listing and privacy disclosure, capture current product screenshots, and verify the final dashboard declarations before submitting.

GitHub Release creation is automated; Chrome Web Store submission remains a manual owner action.
