# Release checklist and branch protection

## Branch protection (do once, as a repository admin)
`main` deploys to production. After the first CI run has finished on GitHub (so the check names exist), protect it:

    gh api -X PUT repos/<owner>/<repo>/branches/main/protection --input - <<'JSON'
    {
      "required_status_checks": { "strict": true, "contexts": ["server", "web-and-audit", "mobile"] },
      "enforce_admins": false,
      "required_pull_request_reviews": { "required_approving_review_count": 1 },
      "restrictions": null,
      "allow_force_pushes": false,
      "allow_deletions": false
    }
    JSON

Or in the GitHub web page: Settings → Branches → Add rule for `main` → require a pull request, require the status checks `server`, `web-and-audit`, `mobile`, block force pushes. Setting `enforce_admins` to true also stops the owner pushing straight to main. Not applied yet: it changes the repository's rules, so it needs the owner to run it.

## Before every release
1. CI is green on the pull request (server suites, web build, advisories, mobile checks).
2. Render settings: `AI_API_KEY`, `MONGODB_URI`, Clerk keys, `HF_TOKEN`, `OPENWEATHER_API_KEY` set; `ALLOW_DEV_AUTH` and `AI_MOCK` **absent**; `PUBLIC_APP_URL` set; with more than one instance leave `RATE_LIMIT_STORE` unset (shared store is the default in production).
3. Uploads: set `STORAGE_DRIVER=s3` and the `S3_*` settings, then copy old pictures once with `node server/src/scripts/migrate-uploads.mjs`. Until then pictures live on the server disk and are lost on redeploy.
4. Health: point the uptime monitor at `/api/ready` (503 when the database is down).
5. Rotate any secret that was ever shown in a chat or a log (the Hugging Face token pasted in a conversation).
6. Phones: run `docs/DEVICE-TESTS.md` on the minimum phones; build the release app with a real signing key (not the debug key).
7. Privacy notice and photo retention are written and linked in the app (photos go to two outside services).
