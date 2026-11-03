# Release notes

The `release` job reads **`docs/releases/<tag>.md`** when it exists — e.g.
`docs/releases/v2.3.0.md` for tag `v2.3.0`. That is the place for curated notes
written by hand.

If the file is missing, the workflow generates a body from the commits between
the previous tag and the new one (commit subject, body and the full-changelog
link). Nothing is ever published with an empty body.

Why not `generate_release_notes: true`? This repository pushes directly to
`master` without pull requests, and GitHub's generated notes only list merged
PRs — they came back empty on v2.2.0 and v2.2.1.

## Writing curated notes

Create the file before pushing the tag:

```bash
$EDITOR docs/releases/v2.3.0.md
git add docs/releases/v2.3.0.md
git commit -m "docs: release notes for v2.3.0"
git tag -a v2.3.0 -m "v2.3.0"
git push origin master v2.3.0
```

Keep it in English, in the same tone as the app's public documentation.
