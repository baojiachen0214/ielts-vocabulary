# Project maintenance

- The site is static. Do not clear or rewrite user localStorage history to repair progress. Derive corrected progress from existing records.
- Any shipped change to HTML, CSS, JavaScript, or vocabulary data must bump the `app-version` meta tag in `index.html` and the matching `version` in `version.json`. Use `YYYY.MM.DD.N` and increment N for another release that day.
- Keep the update notice passive. Update only after the user clicks the save-and-update button, saving current drafts first.
- Run the relevant Node tests for behavior changes. `npm ci` installs development-only dependencies; `npm test` runs isolated mock-browser checks. Never run simulated answers against a user's actual site storage.
- The year-to-Cambridge regression test covers full annual coverage followed by both Cambridge banks, not just sample words. Preserve this coverage when changing queue or progress logic.
