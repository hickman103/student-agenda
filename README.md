# Student Agenda

A homework planner for Rensselaer Central High School students, with the bell schedule, announcements, and the school calendar built in. Built from [Bomber Bell](https://github.com/hickman103/bomber-bell) — same bell times, same school calendar, same live-period logic and traffic-light colors.

One codebase, three ways to run it:

| Form | How students get it |
|---|---|
| **Web app** | Open the hosted URL in any browser |
| **Mobile app (iOS / Android)** | Open the URL, then *Add to Home Screen* (iOS Safari) or *Install app* (Android Chrome). Runs full-screen with its own icon and works offline |
| **Chrome extension** | Toolbar icon (or Alt+Shift+A) opens Student Agenda in Chrome's side panel, docked beside whatever page the student is on |

## What students get

| Tab | What it does |
|---|---|
| **Today** | Live period with countdown (green → yellow at 10 min → red while passing), what's due today and tomorrow, new announcements, next few calendar dates |
| **Homework** | Add, edit, check off. Grouped Overdue / Today / Tomorrow / This week / Later. Done list kept separately |
| **Bells** | Today's schedule with the live period marked and the student's class names. Full Day, 2-Hour Delay, and Early Dismissal views |
| **News** | Announcements pushed from `data/announcements.json`. Unread badge on the tab |
| **Calendar** | Month view: no-school days, make-up days, special schedules, grading dates, and the student's homework due dates |

**Settings** (gear icon): class names for Periods 1–7 and FLEX, lunch wave (A/B/C), 2-hour delay group (A/B, with the FLEX teacher lists), and backup/restore.

## Privacy

Homework and settings are stored only in the browser's `localStorage` on the student's device. Nothing is sent to a server, there are no accounts, and no analytics. The only network request is for `data/announcements.json`.

Trade-off: clearing browser data or switching devices loses the homework. Settings → **Back up** downloads a JSON file; **Restore** loads it on another device.

## Posting announcements

Announcements and student data never mix: homework and settings live in each student's browser, and the app only *reads* the announcements file. Posting, editing, or deleting announcements — or pushing any app update — leaves every student's homework alone. A malformed file is ignored and the last good copy stays up.

**Quickest way:** on GitHub, open `data/announcements.json` → pencil icon → add an item at the top of `items` → *Commit changes*. Live within about 10 minutes (GitHub Pages caches files for up to 10).

Edit `data/announcements.json` and publish. Students see it the next time they open the app (or come back to the tab). The Chrome extension reads the same hosted file if it was built with `NEWS_URL` (see below); the last copy fetched is kept for offline use.

```json
{
  "id": "2026-12-03-assembly",
  "date": "2026-12-03",
  "title": "Assembly during FLEX",
  "body": "Report to the gym during FLEX on Thursday.",
  "pinned": false,
  "expires": "2026-12-04"
}
```

- `id` must be unique — it's how the app tracks read/unread.
- `date` is when it appears; future-dated posts stay hidden until then.
- `expires` (optional) hides it on and after that date.
- `pinned` keeps it at the top.

**2-hour delay:** add the date to `delayDays` (e.g. `"delayDays": ["2026-12-03"]`) and every student's app switches to the delay schedule that day. Students can also flip "Today is a 2-hour delay" on the Bells tab themselves if they hear before the file is updated; it turns itself off the next day.

## Schedules and calendar

All times are Central (America/Chicago), the school's zone. The clock, countdowns, "today," and due-date labels use Chicago time even when a device is set to Eastern or anything else (`nowCT()` in `app.js`).

Everything lives in `data/calendar.js`:

- `Schedule` — bell times. `t(h, m, pm)` takes a clock time and returns minutes after midnight, so `t(1, 30, true)` is 1:30 PM.
- `SchoolCalendar.noSchool` / `makeup` — closed days, as `yyyy-MM-dd` keys. If a weather make-up day gets used, move it out of `makeup`.
- `SchoolCalendar.special` — days with a non-standard schedule (Homecoming, early dismissals).
- `SchoolCalendar.events` — dates students see on the calendar (quarter ends, midterm reports, graduation).

**Early dismissal (Nov 10 and Nov 12, 2026):** unlike Bomber Bell, this app does *not* compute scaled period times. The RCHS bell schedule says period times for those days haven't been published and shouldn't be estimated, so the app shows a countdown to 1:00 PM dismissal and tells students to listen for announcements. When official times are published, add an `earlyBlocks` list to `Schedule.blocks()`.

Sources: RCHS Bell Schedule 2026–2027, the approved RCSC 2026–2027 calendar (08/19/2025, early dismissals added 09/29/2026), and the RCHS Academic Schedule 2026–2027.

## Run locally

No build step, no dependencies.

```bash
cd ~/Developer/student-agenda && python3 -m http.server 8742
```

Then open http://localhost:8742. (Service workers need `http://localhost` or HTTPS — opening `index.html` as a file works but won't install or run offline.)

## Chrome extension

The extension is the same app, opened in Chrome's side panel. `extension/` holds the only extension-specific files (`manifest.json`, `background.js`); `build.sh` copies the shared app files next to them.

```bash
./build.sh
```

Output: `dist/extension/` and `dist/student-agenda-extension.zip`.

Once the web app is hosted, build with its announcements URL so posts reach the extension without a new release:

```bash
NEWS_URL=https://hickman103.github.io/student-agenda/data/announcements.json ./build.sh
```

Without `NEWS_URL` the extension shows the announcements bundled at build time.

**Try it:** `chrome://extensions` → turn on Developer mode → *Load unpacked* → pick `dist/extension`. Click the toolbar icon (pin it from the puzzle-piece menu).

**Notes**
- Homework in the extension is stored separately from the web app (each has its own storage). Settings → Back up / Restore moves it between them.
- Bump `version` in `extension/manifest.json` for every release.
- Calendar or bell changes need a rebuild and a new release; announcements don't (with `NEWS_URL`).

## Deploying to students

1. **Live at https://hickman103.github.io/student-agenda/** — GitHub Pages, published from `main`. Every push to `main` redeploys; changes reach students within about 10 minutes. (Google Sites embedding won't work; the app needs its own origin for offline + install.)
2. **Chromebooks:** Google Admin console → Devices → Chrome → Apps & extensions → Users & browsers → select the student OU → add by URL ("Add the Chrome app or extension by ID / URL" → Web app) → set to **Force install**. It appears on the shelf as "Agenda."
3. **Phones:** students open the URL and choose *Add to Home Screen* (iOS Safari) or *Install app* (Android Chrome).
4. **Chrome extension:** publish `dist/student-agenda-extension.zip` to the Chrome Web Store as **Private** (visible only to the rensselaerschools.org domain) or **Unlisted**, then in Google Admin → Apps & extensions → Users & browsers → student OU → add by extension ID → **Force install** and **Pin to browser toolbar**.

Updates go live on the next open — the service worker is network-first, so there's no cache to bump.

## Files

```
index.html               shell, dialogs
data/config.js           announcements URL (rewritten by build.sh for the extension)
extension/manifest.json  Chrome extension manifest (side panel)
extension/background.js  opens the side panel from the toolbar icon
build.sh                 packages the extension into dist/
app.js                   state, views, live readout, homework
styles.css               light/dark theme, phone + Chromebook layouts
data/calendar.js         bells, closures, special days, calendar events
data/announcements.json  news + delayDays (edit this one to post)
sw.js                    offline cache
manifest.webmanifest     install metadata
icons/                   app icons
```
