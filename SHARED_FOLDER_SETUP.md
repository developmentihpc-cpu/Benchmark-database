# Benchmark DB — shared "My Projects" for the team

This lets your whole team keep **My Projects** in one JSON file on a shared drive,
instead of each person's browser. Nothing sensitive goes to GitHub — the project
data lives **only** in the file you choose in your shared folder.

## What you need

- **Google Chrome or Microsoft Edge** (the shared-file feature uses the browser's
  File System Access API, which Firefox and Safari don't support). On Windows,
  Edge is already installed.
- A **shared folder everyone can reach** — a mapped network drive, or a synced
  folder (OneDrive / SharePoint / Dropbox). The folder appears as a normal path
  on each person's PC.

## One-time setup

**1. Put the app file in the shared folder.**
Copy **`benchmark-db-shared.html`** into the shared folder. (It loads the app from
the live site, so it stays up to date; it only needs an internet connection.)

**2. The first person creates the shared project file.**
- Open `benchmark-db-shared.html` from the shared folder (it opens on **My Projects**).
- In the storage bar at the top, click **"Create new…"**.
- Save it **in the shared folder** as `benchmark_projects.json`.
- Add your projects — they now save straight into that file.

**3. Everyone else connects to it.**
- Open `benchmark-db-shared.html`.
- Click **"Connect shared file…"** and pick the `benchmark_projects.json` the first
  person created.
- That's it — you now see and edit the same projects as everyone else.

> The browser remembers the file, so next time it reconnects automatically. If it
> asks you to **"Reconnect shared file"** after reopening, just click it once (the
> browser requires a click to re-grant access each session).

## Day to day

- **Adding / editing / deleting** a project writes to the shared file immediately.
- To pull in changes a teammate made while you had the app open, click **Refresh**.
- **Export JSON / CSV** still works for backups or reports.

## Good to know

- **Security:** the project data is written only to the file you pick in your shared
  folder. It is never sent to GitHub, the live website, or any server.
- **Who can see it:** anyone with access to the shared folder (and the file) can open
  it in the app. Control access with your folder's normal permissions.
- **Editing at the same time:** when you save, the app re-reads the file and merges
  by project, so two people editing *different* projects is fine. If two people edit
  the *same* project at once, the last save wins — click **Refresh** before big edits
  to be safe.
- **If you use Firefox/Safari or can't use the shared file:** the app still works with
  **Export → (save to the shared folder)** and **Import** to share manually.

## For maintainers

`benchmark-db-shared.html` is a copy of `index.html` with a `<base>` tag pointing at
the GitHub Pages site and a `data-shared="1"` flag (so it opens on My Projects). The
shared-file logic lives in `js/app.js` (the `mp*Shared` functions, File System Access
API + an IndexedDB-stored file handle). Regenerate the copy only if the Pages URL
changes.
