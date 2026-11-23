# grok-office

Static copy of the **Core Tech Studio Labs Office** page: an isometric office floor of the Core Tech Studio Labs agents, with each desk's pending asks, projects, an inbox tray and conference rooms.

Live: https://gibgitgib.github.io/grok-office/

- Plain HTML, CSS and JavaScript. No build step for the page itself.
- `data.js` holds the snapshot data. `app.js` draws the floor and handles interaction (theme switch, filters, desk selection, motion toggle, replay).
- Follows the system light or dark setting. The Arcade theme always uses its own dark surface, as in the original.

## Linear is the source of truth

Desk items and projects are stored in the CoreTech Labs team in Linear, marked with the **Office** label. Any harness can update the page by writing those issues and projects. The conventions are in the Linear document [Office dashboard: how harnesses write here](https://linear.app/coretech-labs/document/office-dashboard-how-harnesses-write-here-f12a29086a47).

`scripts/sync-from-linear.mjs` queries Linear and regenerates `data.js`, keeping the roster, zones, rooms and About blurb from `scripts/office-static.json`. A GitHub Action runs it hourly and on demand.

The action no-ops with a clear log line until this repository secret is set:

1. Create a Linear personal API key at Linear **Settings → API → Personal API keys**.
2. Add it as `LINEAR_API_KEY` at https://github.com/GibGitGib/grok-office/settings/secrets/actions

To try the generator locally against the checked-in fixture (no API key needed):

```
node scripts/sync-from-linear.mjs --fixture scripts/fixtures/linear-office.json
```
