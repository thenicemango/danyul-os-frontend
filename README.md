# DANYUL OS — PUBLIC FRONTEND REPOSITORY

This is the public frontend side of v3. See `../START_HERE.md` in the distributed ZIP for the full non-engineer checklist.

Existing v2 `index.html`, `app.js` and `cloud.js` are preserved. New `research-inbox.js` displays manually reviewable suggestions from Supabase. GitHub Actions deploys only `index.html`, `app.js`, `cloud.js`, `research-inbox.js` and generated `config.js` to GitHub Pages.

Build variables: `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` via GitHub Settings → Secrets and variables → Actions → Variables.

**Never put a service-role/secret key in this repository.** The anon/publishable key is public by design and RLS protects private records.
