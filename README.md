# grok-office

Static copy of the **Core Tech Studio Labs Office** page: an isometric office floor of the Core Tech Studio Labs agents, with each desk's pending asks, projects, an inbox tray and conference rooms.

Live: https://gibgitgib.github.io/grok-office/

- Plain HTML, CSS and JavaScript. No build step.
- `data.js` holds the snapshot data. `app.js` draws the floor and handles interaction (theme switch, filters, desk selection, motion toggle, replay).
- Follows the system light or dark setting. The Arcade theme always uses its own dark surface, as in the original.

This is a **snapshot** (as of the `AS_OF` date in `data.js`). It does not update itself. The original page is refreshed by a routine; to update this copy, replace the data block in `data.js` and push.
