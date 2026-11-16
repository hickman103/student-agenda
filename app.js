// Student Agenda — Rensselaer Central High School.
// Homework lives in localStorage on the student's device and never leaves it.
// Bells and calendar come from data/calendar.js; announcements from data/announcements.json.

// MARK: - State

const STORE = "studentAgenda.v1";
const PERIODS = ["1", "2", "FLEX", "3", "4", "5", "6", "7"];

const defaults = () => ({
  classes: {},          // period -> class name
  lunch: "A",
  group: "A",
  delayToday: null,     // yyyy-MM-dd the student flagged as a delay day
  homework: [],         // {id, title, period, due, notes, done, created}
  readNews: [],
  tab: "today",
  hwFilter: "todo"
});

let state = load();
let news = { items: [], delayDays: [] };
let calCursor = null;   // first of the month shown on the calendar tab
let calSelected = null; // yyyy-MM-dd

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch {
    return defaults();
  }
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); }
  catch { toast("Couldn't save — storage is full or blocked"); }
}

// MARK: - Dates

const pad = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.round((fromIso(b) - fromIso(a)) / 86400000);

const fmt = (d, opts) => d.toLocaleDateString("en-US", opts);
const longDate = (d) => fmt(d, { weekday: "long", month: "long", day: "numeric" });
const shortDate = (d) => fmt(d, { weekday: "short", month: "short", day: "numeric" });

function dayStatus(d) {
  const k = isoOf(d);
  const wd = d.getDay();
  const C = SchoolCalendar;
  if (wd === 0 || wd === 6) return { open: false, reason: "Weekend" };
  if (k < C.yearStart) return { open: false, reason: "Summer break" };
  if (C.makeup[k]) return { open: false, reason: C.makeup[k], makeup: true };
  if (k > C.yearEnd) return { open: false, reason: "Summer break" };
  if (C.noSchool[k]) return { open: false, reason: C.noSchool[k] };
  return { open: true };
}

function modeFor(d) {
  const k = isoOf(d);
  const sp = SchoolCalendar.special[k];
  if (sp) return { mode: sp.mode, note: sp.note, out: sp.out };
  if (news.delayDays.includes(k)) return { mode: "delay", note: "2-Hour Delay — announced by RCHS" };
  if (state.delayToday === k) return { mode: "delay", note: "2-Hour Delay — you turned this on" };
  return { mode: "regular" };
}

function nextSchoolDay(after) {
  let d = new Date(after.getFullYear(), after.getMonth(), after.getDate());
  for (let i = 0; i < 400; i++) {
    d = addDays(d, 1);
    if (dayStatus(d).open) return d;
  }
  return null;
}

const blocksFor = (mode) => Schedule.blocks(mode, state.lunch, state.group);

// MARK: - Live readout (ported from Bomber Bell)

function countdown(seconds) {
  const s = Math.max(0, seconds);
  if (s >= 3600) return `${Math.floor(s / 3600)}h${pad(Math.floor((s % 3600) / 60))}`;
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

function className(block) {
  const p = periodNumber(block.name);
  if (p) return state.classes[String(p)] || "";
  if (block.name.startsWith("FLEX")) return state.classes.FLEX || "";
  return "";
}

function readout(now) {
  const status = dayStatus(now);
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const mins = Math.floor(secs / 60);

  if (!status.open) {
    const nd = nextSchoolDay(now);
    return {
      state: "idle", label: status.makeup ? "Make-up day" : "No school",
      headline: status.reason,
      detail: nd ? `Classes resume ${longDate(nd)} at 8:05 AM` : "No more student days this year",
      upNext: status.makeup ? "Make-up day — school only if weather forced it" : "",
      live: -1
    };
  }

  const { mode, note, out } = modeFor(now);
  const list = blocksFor(mode);

  if (mode === "early") {
    const [oh, om] = out.split(":").map(Number);
    const outMin = oh * 60 + om;
    if (mins < Schedule.firstBell) {
      return { state: "idle", label: countdown(Schedule.firstBell * 60 - secs), headline: "Before school",
        detail: "First bell at 8:05 AM", upNext: note, live: -1 };
    }
    if (mins < outMin) {
      return { state: "good", label: countdown(outMin * 60 - secs), headline: "Early dismissal day",
        detail: `Dismissal at ${clockString(outMin)}`,
        upNext: "Period times aren't published — listen for announcements", live: -1 };
    }
    return dayDone(now, outMin);
  }

  let current = -1, next = -1;
  for (let i = 0; i < list.length; i++) {
    if (mins >= list[i].start && mins < list[i].end) { current = i; break; }
    if (mins < list[i].start) { next = i; break; }
  }

  if (current >= 0) {
    const b = list[current];
    const left = b.end * 60 - secs;
    const after = list[current + 1];
    return {
      state: left <= 600 ? "warn" : "good", label: countdown(left),
      headline: b.name, cls: className(b),
      detail: `${clockString(b.start)} – ${clockString(b.end)}`,
      upNext: after ? `Up next: ${after.name}${className(after) ? " · " + className(after) : ""} at ${clockString(after.start)}`
                    : `Last period — dismissal at ${clockString(b.end)}`,
      live: current, note
    };
  }
  if (next > 0) {
    const prev = list[next - 1], nxt = list[next];
    return {
      state: "passing", label: countdown(nxt.start * 60 - secs), headline: "Passing period",
      detail: `${clockString(prev.end)} – ${clockString(nxt.start)}`,
      upNext: `${nxt.name}${className(nxt) ? " · " + className(nxt) : ""} begins at ${clockString(nxt.start)}`,
      live: -1, note
    };
  }
  if (next === 0) {
    const first = list[0];
    return {
      state: "idle", label: countdown(first.start * 60 - secs), headline: "Before school",
      detail: `First bell at ${clockString(first.start)}`,
      upNext: `${first.name}${className(first) ? " · " + className(first) : ""} begins the day`,
      live: -1, note
    };
  }
  return dayDone(now, list[list.length - 1].end);
}

function dayDone(now, endMin) {
  const nd = nextSchoolDay(now);
  return {
    state: "idle", label: "Out", headline: "Day complete",
    detail: `Dismissed at ${clockString(endMin)}`,
    upNext: nd ? `Next student day ${longDate(nd)}` : "No more student days this year",
    live: -1
  };
}

// MARK: - Homework

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function periodLabel(p) {
  if (!p) return "Other";
  const name = state.classes[p];
  const tag = p === "FLEX" ? "FLEX" : `P${p}`;
  return name ? `${tag} · ${name}` : (p === "FLEX" ? "FLEX" : `Period ${p}`);
}

function dueLabel(due, todayIso) {
  const n = daysBetween(todayIso, due);
  if (n < -1) return { text: `${-n} days late`, tone: "late" };
  if (n === -1) return { text: "Yesterday", tone: "late" };
  if (n === 0) return { text: "Today", tone: "soon" };
  if (n === 1) return { text: "Tomorrow", tone: "soon" };
  if (n < 7) return { text: fmt(fromIso(due), { weekday: "long" }), tone: "" };
  return { text: shortDate(fromIso(due)), tone: "" };
}

function sortedHomework(list) {
  return [...list].sort((a, b) => a.due.localeCompare(b.due) || a.created - b.created);
}

function groupHomework(list, todayIso) {
  const groups = [["Overdue", []], ["Today", []], ["Tomorrow", []], ["This week", []], ["Later", []]];
  for (const h of sortedHomework(list)) {
    const n = daysBetween(todayIso, h.due);
    const i = n < 0 ? 0 : n === 0 ? 1 : n === 1 ? 2 : n < 7 ? 3 : 4;
    groups[i][1].push(h);
  }
  return groups.filter(([, items]) => items.length);
}

// MARK: - DOM helpers

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 2600);
}

const view = document.getElementById("view");

// MARK: - Views

function statusCard(r) {
  return h("section", { class: `status ${r.state}`, "aria-live": "off" },
    h("div", { class: "status-top" },
      h("div", {},
        h("div", { class: "status-head" }, r.headline),
        r.cls && h("div", { class: "status-cls" }, r.cls)),
      h("div", { class: "status-count" }, r.label)),
    h("div", { class: "status-detail" }, r.detail),
    r.upNext && h("div", { class: "status-next" }, r.upNext),
    r.note && h("div", { class: "status-note" }, r.note));
}

function hwItem(hw, todayIso) {
  const due = dueLabel(hw.due, todayIso);
  return h("li", { class: `hw ${hw.done ? "done" : ""}` },
    h("input", {
      type: "checkbox", checked: hw.done, "aria-label": `Mark "${hw.title}" ${hw.done ? "not done" : "done"}`,
      onchange: (e) => {
        hw.done = e.target.checked;
        save();
        if (hw.done) toast("Nice work ✓");
        render();
      }
    }),
    h("button", { class: "hw-body", onclick: () => openHomework(hw) },
      h("span", { class: "hw-title" }, hw.title),
      h("span", { class: "hw-meta" },
        h("span", { class: "chip" }, periodLabel(hw.period)),
        !hw.done && h("span", { class: `due ${due.tone}` }, due.text)),
      hw.notes && h("span", { class: "hw-notes" }, hw.notes)));
}

function viewToday() {
  const now = new Date();
  const todayIso = isoOf(now);
  const open = state.homework.filter((x) => !x.done);
  const urgent = open.filter((x) => daysBetween(todayIso, x.due) <= 1);
  const unread = news.items.filter((n) => !state.readNews.includes(n.id));
  const upcoming = SchoolCalendar.events.filter((e) => e.date >= todayIso).slice(0, 3);

  return [
    h("p", { class: "date-line" }, longDate(now)),
    h("div", { id: "live" }, statusCard(readout(now))),

    h("section", { class: "card" },
      h("div", { class: "card-head" },
        h("h2", {}, "Due soon"),
        h("button", { class: "link", onclick: () => openHomework() }, "+ Add")),
      urgent.length
        ? h("ul", { class: "hw-list" }, sortedHomework(urgent).map((x) => hwItem(x, todayIso)))
        : h("p", { class: "empty" }, open.length
            ? `Nothing due today or tomorrow. ${open.length} item${open.length === 1 ? "" : "s"} later.`
            : "No homework yet. Tap + Add when you get an assignment."),
      open.length > urgent.length && h("button", { class: "link", onclick: () => go("homework") }, "See all homework →")),

    unread.length > 0 && h("section", { class: "card" },
      h("div", { class: "card-head" },
        h("h2", {}, "New announcements"),
        h("button", { class: "link", onclick: () => go("news") }, "All →")),
      unread.slice(0, 2).map(newsItem)),

    h("section", { class: "card" },
      h("div", { class: "card-head" },
        h("h2", {}, "Coming up"),
        h("button", { class: "link", onclick: () => go("calendar") }, "Calendar →")),
      h("ul", { class: "event-list" }, upcomingDays(now, 21).slice(0, 4).map(eventRow)),
      !upcoming.length && null)
  ];
}

function viewHomework() {
  const todayIso = isoOf(new Date());
  const filter = state.hwFilter;
  const list = state.homework.filter((x) => (filter === "done" ? x.done : !x.done));

  const body = filter === "done"
    ? (list.length
        ? h("ul", { class: "hw-list" }, sortedHomework(list).reverse().map((x) => hwItem(x, todayIso)))
        : h("p", { class: "empty" }, "Finished homework shows up here."))
    : (list.length
        ? groupHomework(list, todayIso).map(([name, items]) =>
            h("section", { class: "hw-group" },
              h("h3", { class: name === "Overdue" ? "late" : "" }, name, h("span", { class: "count" }, items.length)),
              h("ul", { class: "hw-list" }, items.map((x) => hwItem(x, todayIso)))))
        : h("p", { class: "empty" }, "All caught up. 🎉"));

  return [
    h("div", { class: "toolbar" },
      h("div", { class: "seg", role: "tablist" },
        ["todo", "done"].map((f) => h("button", {
          role: "tab", "aria-selected": String(filter === f), class: filter === f ? "on" : "",
          onclick: () => { state.hwFilter = f; save(); render(); }
        }, f === "todo" ? `To do (${state.homework.filter((x) => !x.done).length})` : "Done"))),
      h("button", { class: "btn primary", onclick: () => openHomework() }, "+ Add homework")),
    body
  ];
}

function viewBells() {
  const now = new Date();
  const status = dayStatus(now);
  const { mode, note } = modeFor(now);
  const shown = viewBells.mode || (status.open ? mode : "regular");
  const titles = { regular: "Full Day", delay: "2-Hour Delay", early: "Early Dismissal", homecoming: "Homecoming" };

  const wrap = h("div", {},
    h("div", { id: "live" }, statusCard(readout(now))),
    h("div", { class: "toolbar" },
      h("div", { class: "seg", role: "tablist", "aria-label": "Schedule" },
        ["regular", "delay", "early"].map((m) => h("button", {
          role: "tab", "aria-selected": String(shown === m), class: shown === m ? "on" : "",
          onclick: () => { viewBells.mode = m; render(); }
        }, titles[m])))),
    h("section", { class: "card" },
      h("div", { class: "card-head" },
        h("h2", {}, titles[shown]),
        h("span", { class: "dim small" }, shown === "delay" ? `Group ${state.group}` : shown === "early" ? "" : `${state.lunch} Lunch`)),
      h("div", { id: "bell-table" }, bellTable(shown, now, status.open && shown === mode))),
    status.open && mode !== "delay" && !news.delayDays.includes(isoOf(now)) && h("label", { class: "toggle" },
      h("input", {
        type: "checkbox", checked: state.delayToday === isoOf(now),
        onchange: (e) => { state.delayToday = e.target.checked ? isoOf(now) : null; viewBells.mode = null; save(); render(); }
      }),
      h("span", {}, "Today is a 2-hour delay", h("span", { class: "dim small block" }, "Turns off by itself tomorrow."))),
    state.delayToday === isoOf(now) && h("label", { class: "toggle" },
      h("input", {
        type: "checkbox", checked: true,
        onchange: () => { state.delayToday = null; viewBells.mode = null; save(); render(); }
      }),
      h("span", {}, "Today is a 2-hour delay", h("span", { class: "dim small block" }, "Uncheck to go back to the full day."))),
    h("p", { class: "dim small" }, "Lunch wave and delay group are in Settings. Bell times from the 2026–2027 RCHS Student Handbook."));
  return wrap;
}

function bellTable(mode, now, isToday) {
  if (mode === "early") {
    return h("div", {},
      h("p", {}, "Early dismissal days: ", h("strong", {}, "Tue, Nov 10 and Thu, Nov 12, 2026"), " — students dismissed at ", h("strong", {}, "1:00 PM"), "."),
      h("p", { class: "dim" }, "First bell is still 8:05 AM. Period-by-period times haven't been published — listen for announcements or ask the main office at (219) 866-5175."));
  }
  const list = blocksFor(mode);
  const r = isToday ? readout(now) : { live: -1 };
  const mins = now.getHours() * 60 + now.getMinutes();
  return h("ol", { class: "bells" }, list.map((b, i) =>
    h("li", { class: [i === r.live && "live", isToday && mins >= b.end && "past", b.lunch && "lunch"].filter(Boolean).join(" ") },
      h("span", { class: "b-name" }, b.name, className(b) && h("span", { class: "b-cls" }, className(b))),
      h("span", { class: "b-time" }, `${clockString(b.start)} – ${clockString(b.end)}`))));
}

function newsItem(n) {
  const unread = !state.readNews.includes(n.id);
  return h("article", { class: `news ${unread ? "unread" : ""}` },
    h("div", { class: "news-meta" },
      n.pinned && h("span", { class: "chip red" }, "Pinned"),
      h("span", { class: "dim small" }, shortDate(fromIso(n.date)))),
    h("h3", {}, n.title),
    h("p", {}, n.body));
}

function viewNews() {
  const out = news.items.length
    ? news.items.map(newsItem)
    : h("p", { class: "empty" }, navigator.onLine ? "No announcements right now." : "You're offline — announcements will load when you reconnect.");
  // Opening the tab marks everything read; the dots stay for this visit.
  const ids = news.items.map((n) => n.id);
  if (ids.some((id) => !state.readNews.includes(id))) {
    state.readNews = ids;
    save();
    setTimeout(updateBadge, 0);
  }
  return [h("h2", { class: "page-title" }, "Announcements"), out];
}

// Calendar entries for one day: closures, special schedules, events, homework.
function dayEntries(d) {
  const k = isoOf(d);
  const out = [];
  const st = dayStatus(d);
  if (!st.open && st.reason !== "Weekend" && st.reason !== "Summer break") {
    out.push({ kind: st.makeup ? "makeup" : "off", title: st.makeup ? `${st.reason} (make-up day — off unless used)` : `No school — ${st.reason}` });
  }
  for (const e of SchoolCalendar.events) if (e.date === k) out.push({ kind: e.kind, title: e.title });
  if (news.delayDays.includes(k)) out.push({ kind: "special", title: "2-Hour Delay" });
  for (const hw of state.homework) if (hw.due === k && !hw.done) out.push({ kind: "hw", title: `${hw.title} (${periodLabel(hw.period)})`, hw });
  return out;
}

function upcomingDays(from, span) {
  const rows = [];
  let lastOff = null;
  for (let i = 0; i < span; i++) {
    const d = addDays(from, i);
    for (const e of dayEntries(d)) {
      if (e.kind === "hw") continue;
      // Collapse a run of the same break into its first day.
      if (e.kind === "off" && lastOff === e.title) continue;
      lastOff = e.kind === "off" ? e.title : lastOff;
      rows.push({ d, ...e });
    }
  }
  return rows;
}

function eventRow(e) {
  return h("li", { class: `ev ${e.kind}` },
    h("span", { class: "ev-date" }, shortDate(e.d)),
    h("span", {}, e.title));
}

function viewCalendar() {
  const today = new Date();
  if (!calCursor) calCursor = new Date(today.getFullYear(), today.getMonth(), 1);
  if (!calSelected) calSelected = isoOf(today);

  const first = calCursor;
  const startPad = first.getDay();
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(h("span", { class: "cell blank" }));
  for (let day = 1; day <= daysIn; day++) {
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    const k = isoOf(d);
    const st = dayStatus(d);
    const entries = dayEntries(d);
    const cls = ["cell",
      k === isoOf(today) && "today",
      k === calSelected && "sel",
      !st.open && (st.makeup ? "makeup" : "off"),
      (SchoolCalendar.special[k] || news.delayDays.includes(k)) && "special"
    ].filter(Boolean).join(" ");
    cells.push(h("button", {
      class: cls, "aria-label": `${longDate(d)}${entries.length ? ", " + entries.map((e) => e.title).join("; ") : ""}`,
      onclick: () => { calSelected = k; render(); }
    },
      h("span", { class: "num" }, day),
      h("span", { class: "dots" },
        entries.some((e) => e.kind === "grades" || e.kind === "school") && h("i", { class: "dot red" }),
        entries.some((e) => e.kind === "hw") && h("i", { class: "dot blue" }))));
  }

  const sel = fromIso(calSelected);
  const selEntries = dayEntries(sel);
  const selStatus = dayStatus(sel);
  const selMode = selStatus.open ? modeFor(sel) : null;

  return [
    h("div", { class: "cal-head" },
      h("button", { class: "icon-btn", "aria-label": "Previous month", onclick: () => { calCursor = new Date(first.getFullYear(), first.getMonth() - 1, 1); render(); } }, "‹"),
      h("h2", {}, fmt(first, { month: "long", year: "numeric" })),
      h("button", { class: "icon-btn", "aria-label": "Next month", onclick: () => { calCursor = new Date(first.getFullYear(), first.getMonth() + 1, 1); render(); } }, "›")),
    h("div", { class: "cal" },
      ["S", "M", "T", "W", "T", "F", "S"].map((d) => h("span", { class: "dow" }, d)),
      cells),
    h("div", { class: "legend small" },
      h("span", {}, h("i", { class: "sw off" }), "No school"),
      h("span", {}, h("i", { class: "sw makeup" }), "Make-up day"),
      h("span", {}, h("i", { class: "sw special" }), "Special schedule"),
      h("span", {}, h("i", { class: "dot red" }), "School date"),
      h("span", {}, h("i", { class: "dot blue" }), "Homework due")),
    h("section", { class: "card" },
      h("div", { class: "card-head" },
        h("h2", {}, longDate(sel)),
        h("button", { class: "link", onclick: () => openHomework(null, calSelected) }, "+ Homework")),
      h("p", { class: "dim small" },
        selStatus.open
          ? (selMode.mode === "regular" ? "Full day · 8:05 AM – 3:14 PM" : selMode.note || "Special schedule")
          : selStatus.reason),
      selEntries.length
        ? h("ul", { class: "event-list" }, selEntries.map((e) =>
            h("li", { class: `ev ${e.kind}` },
              e.hw ? h("button", { class: "link plain", onclick: () => openHomework(e.hw) }, e.title) : e.title)))
        : h("p", { class: "empty" }, "Nothing scheduled.")),
    h("p", { class: "dim small" }, "From the approved 2026–2027 RCSC school calendar. Weather make-up days are off unless a cancellation gets made up.")
  ];
}

// MARK: - Render / routing

const views = { today: viewToday, homework: viewHomework, bells: viewBells, news: viewNews, calendar: viewCalendar };

function render() {
  const tab = views[state.tab] ? state.tab : "today";
  view.replaceChildren(...[views[tab]()].flat(3).filter(Boolean));
  document.querySelectorAll(".tabs button").forEach((b) =>
    b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
  updateBadge();
}

function go(tab) {
  state.tab = tab;
  if (tab !== "bells") viewBells.mode = null;
  save();
  render();
  view.scrollTop = 0;
  window.scrollTo(0, 0);
}

// Once a second, refresh only the live bits so inputs keep focus.
function tick() {
  const live = document.getElementById("live");
  if (live) live.replaceChildren(statusCard(readout(new Date())));
  const table = document.getElementById("bell-table");
  if (table && state.tab === "bells") {
    const now = new Date();
    const shown = viewBells.mode || (dayStatus(now).open ? modeFor(now).mode : "regular");
    table.replaceChildren(bellTable(shown, now, dayStatus(now).open && shown === modeFor(now).mode));
  }
  // Past midnight: re-render so "today" moves.
  if (tick.day !== isoOf(new Date())) {
    if (tick.day) render();
    tick.day = isoOf(new Date());
  }
}

function updateBadge() {
  const n = news.items.filter((x) => !state.readNews.includes(x.id)).length;
  const badge = document.getElementById("news-badge");
  badge.hidden = n === 0 || state.tab === "news";
  badge.textContent = n;
}

// MARK: - Homework dialog

const hwDialog = document.getElementById("hw-dialog");
const hwForm = document.getElementById("hw-form");
let editing = null;

function openHomework(hw = null, dueIso = null) {
  editing = hw;
  const sel = hwForm.elements.period;
  sel.replaceChildren(
    ...PERIODS.map((p) => h("option", { value: p }, periodLabel(p))),
    h("option", { value: "" }, "Other"));
  const tomorrow = nextSchoolDay(new Date()) || addDays(new Date(), 1);
  hwForm.elements.title.value = hw ? hw.title : "";
  sel.value = hw ? hw.period : (openHomework.lastPeriod ?? "1");
  hwForm.elements.due.value = hw ? hw.due : (dueIso || isoOf(tomorrow));
  hwForm.elements.notes.value = hw ? hw.notes : "";
  document.getElementById("hw-dialog-title").textContent = hw ? "Edit homework" : "Add homework";
  document.getElementById("hw-delete").hidden = !hw;
  hwDialog.showModal();
  hwForm.elements.title.focus();
}

hwForm.addEventListener("submit", (e) => {
  const f = hwForm.elements;
  const title = f.title.value.trim();
  if (!title || !f.due.value) { e.preventDefault(); return; }
  if (editing) {
    Object.assign(editing, { title, period: f.period.value, due: f.due.value, notes: f.notes.value.trim() });
  } else {
    state.homework.push({ id: uid(), title, period: f.period.value, due: f.due.value, notes: f.notes.value.trim(), done: false, created: Date.now() });
    toast("Homework added");
  }
  openHomework.lastPeriod = f.period.value;
  save();
  render();
});

document.getElementById("hw-cancel").addEventListener("click", () => hwDialog.close());
document.getElementById("hw-delete").addEventListener("click", () => {
  if (!editing || !confirm(`Delete "${editing.title}"?`)) return;
  state.homework = state.homework.filter((x) => x !== editing);
  save();
  hwDialog.close();
  render();
  toast("Deleted");
});

// MARK: - Settings dialog

const setDialog = document.getElementById("settings-dialog");

function seg(container, options, current, onPick) {
  container.replaceChildren(...options.map(([value, label]) => h("button", {
    type: "button", class: value === current ? "on" : "", "aria-pressed": String(value === current),
    onclick: () => { onPick(value); }
  }, label)));
}

function fillSettings() {
  document.getElementById("class-fields").replaceChildren(...PERIODS.map((p) =>
    h("label", {}, p === "FLEX" ? "FLEX" : `Period ${p}`,
      h("input", {
        value: state.classes[p] || "", maxlength: 40, placeholder: p === "FLEX" ? "FLEX teacher" : "Class name",
        oninput: (e) => { state.classes[p] = e.target.value.trim(); save(); }
      }))));
  seg(document.getElementById("lunch-seg"), [["A", "A Lunch"], ["B", "B Lunch"], ["C", "C Lunch"]], state.lunch,
    (v) => { state.lunch = v; save(); fillSettings(); });
  seg(document.getElementById("group-seg"), [["A", "Group A"], ["B", "Group B"]], state.group,
    (v) => { state.group = v; save(); fillSettings(); });
  document.getElementById("group-a").textContent = Schedule.delayGroups.A;
  document.getElementById("group-b").textContent = Schedule.delayGroups.B;
}

document.getElementById("open-settings").addEventListener("click", () => { fillSettings(); setDialog.showModal(); });
setDialog.addEventListener("close", render);

document.getElementById("backup").addEventListener("click", () => {
  const { tab, hwFilter, ...keep } = state;
  const blob = new Blob([JSON.stringify({ app: "student-agenda", version: 1, saved: new Date().toISOString(), ...keep }, null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `student-agenda-backup-${isoOf(new Date())}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

document.getElementById("restore").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "student-agenda" || !Array.isArray(data.homework)) throw new Error("not a backup");
    if (!confirm(`Replace what's on this device with the backup from ${new Date(data.saved).toLocaleDateString()}? (${data.homework.length} homework items)`)) return;
    const { app, version, saved, ...rest } = data;
    state = { ...defaults(), ...rest, tab: state.tab };
    save();
    fillSettings();
    toast("Backup restored");
  } catch {
    toast("That file isn't a Student Agenda backup");
  }
});

document.getElementById("clear-done").addEventListener("click", () => {
  const n = state.homework.filter((x) => x.done).length;
  if (!n) { toast("No finished homework to clear"); return; }
  if (!confirm(`Remove ${n} finished item${n === 1 ? "" : "s"}?`)) return;
  state.homework = state.homework.filter((x) => !x.done);
  save();
  toast("Cleared");
});

// MARK: - Announcements

async function loadNews() {
  try {
    const res = await fetch("data/announcements.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const today = isoOf(new Date());
    const items = (data.items || [])
      .filter((n) => n.id && n.title && (!n.expires || n.expires >= today) && n.date <= today)
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date.localeCompare(a.date));
    news = { items, delayDays: data.delayDays || [] };
  } catch {
    // Offline with nothing cached — keep whatever we had.
  }
  render();
}

// MARK: - Boot

document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadNews(); });

render();
loadNews();
setInterval(tick, 1000);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
