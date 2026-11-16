// RCSC 2026–2027 calendar (approved 08/19/2025; early dismissals added 09/29/2026)
// and RCHS bell times from the 2026–2027 Student Handbook.
// Dates are yyyy-MM-dd keys. Edit here, then bump CACHE in sw.js.

const SchoolCalendar = {
  yearStart: "2026-08-12",   // first student day
  yearEnd:   "2027-05-27",   // last student day

  noSchool: {
    "2026-08-07": "Teacher work day", "2026-08-10": "Teacher work day",
    "2026-08-11": "Teacher work day",
    "2026-09-07": "Labor Day",
    "2026-10-23": "Fall Break", "2026-10-26": "Fall Break",
    "2026-11-25": "Thanksgiving Break", "2026-11-26": "Thanksgiving Break",
    "2026-11-27": "Thanksgiving Break",
    "2026-12-18": "Christmas Break", "2026-12-21": "Christmas Break",
    "2026-12-22": "Christmas Break", "2026-12-23": "Christmas Break",
    "2026-12-24": "Christmas Break", "2026-12-25": "Christmas Break",
    "2026-12-28": "Christmas Break", "2026-12-29": "Christmas Break",
    "2026-12-30": "Christmas Break", "2026-12-31": "Christmas Break",
    "2027-01-01": "New Year's Day", "2027-01-04": "No school",
    "2027-03-19": "Spring Break", "2027-03-22": "Spring Break",
    "2027-03-23": "Spring Break", "2027-03-24": "Spring Break",
    "2027-03-25": "Spring Break", "2027-03-26": "Spring Break · Good Friday",
    "2027-05-31": "Memorial Day"
  },

  // Built in as make-up days: off unless weather forced a cancellation.
  // If one gets used, move it out of here.
  makeup: {
    "2027-01-18": "Martin Luther King Jr. Day",
    "2027-02-15": "Presidents' Day",
    "2027-04-23": "Weather make-up day",
    "2027-05-28": "Weather make-up day",
    "2027-06-01": "Weather make-up day",
    "2027-06-02": "Weather make-up day",
    "2027-06-03": "Weather make-up day",
    "2027-06-04": "Weather make-up day"
  },

  // Student days that run a non-standard bell schedule.
  special: {
    "2026-09-18": { mode: "homecoming", note: "Homecoming — PA dismissal at 1:15 PM" },
    "2026-11-10": { mode: "early", out: "13:00", note: "Early dismissal 1:00 PM — Professional Development" },
    "2026-11-12": { mode: "early", out: "13:00", note: "Early dismissal 1:00 PM — Professional Development" }
  },

  // Student-facing dates for the calendar tab.
  events: [
    { date: "2026-08-12", title: "First student day", kind: "school" },
    { date: "2026-09-10", title: "Midterm reports — 1st 9 weeks", kind: "grades" },
    { date: "2026-09-18", title: "Homecoming schedule", kind: "special" },
    { date: "2026-10-09", title: "End of 1st quarter", kind: "grades" },
    { date: "2026-11-10", title: "Early dismissal 1:00 PM", kind: "special" },
    { date: "2026-11-12", title: "Early dismissal 1:00 PM", kind: "special" },
    { date: "2026-11-12", title: "Midterm reports — 2nd 9 weeks", kind: "grades" },
    { date: "2026-12-17", title: "End of 2nd quarter & 1st semester", kind: "grades" },
    { date: "2027-01-05", title: "First day of 2nd semester", kind: "school" },
    { date: "2027-02-05", title: "Midterm reports — 3rd 9 weeks", kind: "grades" },
    { date: "2027-03-12", title: "End of 3rd quarter", kind: "grades" },
    { date: "2027-04-22", title: "Midterm reports — 4th 9 weeks", kind: "grades" },
    { date: "2027-05-27", title: "Last student day · End of 4th quarter", kind: "grades" },
    { date: "2027-06-06", title: "Graduation", kind: "school" }
  ]
};

// MARK: - Bell schedule

// Clock time -> minutes after midnight. t(1, 30, true) is 1:30 PM.
function t(h, m, pm = false) {
  let hh = h;
  if (pm && h !== 12) hh = h + 12;
  if (!pm && h === 12) hh = 0;
  return hh * 60 + m;
}

const B = (name, start, end, lunch = false) => ({ name, start, end, lunch });

const Schedule = {
  firstBell: t(8, 5),
  lastBell: t(3, 14, true),

  regularCore: [
    B("Period 1", t(8, 5), t(8, 52)),
    B("Period 2", t(8, 57), t(9, 44)),
    B("FLEX", t(9, 49), t(10, 14)),
    B("Period 3", t(10, 19), t(11, 6))
  ],
  regularTail: [
    B("Period 5", t(12, 43, true), t(1, 30, true)),
    B("Period 6", t(1, 35, true), t(2, 22, true)),
    B("Period 7", t(2, 27, true), t(3, 14, true))
  ],
  regularLunch(wave) {
    if (wave === "B") return [
      B("Period 4B · Part 1", t(11, 11), t(11, 38)),
      B("B Lunch", t(11, 38), t(12, 8, true), true),
      B("Period 4B · Part 2", t(12, 11, true), t(12, 38, true))
    ];
    if (wave === "C") return [
      B("Period 4C", t(11, 11), t(12, 8, true)),
      B("C Lunch", t(12, 8, true), t(12, 38, true), true)
    ];
    return [
      B("A Lunch", t(11, 6), t(11, 36), true),
      B("Period 4A", t(11, 41), t(12, 38, true))
    ];
  },

  delayCore: [
    B("Period 1", t(10, 5), t(10, 36)),
    B("Period 2", t(10, 41), t(11, 12)),
    B("Period 3", t(11, 17), t(11, 48))
  ],
  delayTail: [
    B("Period 4", t(1, 4, true), t(1, 35, true)),
    B("Period 5", t(1, 40, true), t(2, 10, true)),
    B("Period 6", t(2, 15, true), t(2, 46, true)),
    B("Period 7", t(2, 51, true), t(3, 14, true))
  ],
  delayMid(group) {
    if (group === "B") return [
      B("FLEX · Group B", t(11, 53), t(12, 23, true)),
      B("Lunch · Group B", t(12, 28, true), t(12, 59, true), true)
    ];
    return [
      B("Lunch · Group A", t(11, 53), t(12, 23, true), true),
      B("FLEX · Group A", t(12, 28, true), t(12, 59, true))
    ];
  },

  // Homecoming runs 1, 2, 3, 5, 6, then Period 4 with lunch, then 7. PA dismissal at 1:15.
  hcCore: [
    B("Period 1", t(8, 5), t(8, 35)),
    B("Period 2", t(8, 40), t(9, 10)),
    B("Period 3", t(9, 15), t(9, 45)),
    B("Period 5", t(9, 50), t(10, 20)),
    B("Period 6", t(10, 25), t(10, 55))
  ],
  hcTail: [B("Period 7", t(12, 45, true), t(1, 15, true))],
  hcLunch(wave) {
    if (wave === "B") return [
      B("Period 4B · Part 1", t(11, 0), t(11, 30)),
      B("B Lunch", t(11, 35), t(12, 5, true), true),
      B("Period 4B · Part 2", t(12, 10, true), t(12, 40, true))
    ];
    if (wave === "C") return [
      B("Period 4C", t(11, 0), t(12, 5, true)),
      B("C Lunch", t(12, 10, true), t(12, 40, true), true)
    ];
    return [
      B("A Lunch", t(11, 0), t(11, 30), true),
      B("Period 4A", t(11, 35), t(12, 40, true))
    ];
  },

  // Early dismissal has no published period bells (see RCHS Bell Schedule),
  // so it returns no blocks — the app shows only the dismissal time.
  blocks(mode, lunch, group) {
    if (mode === "delay") return [...this.delayCore, ...this.delayMid(group), ...this.delayTail];
    if (mode === "homecoming") return [...this.hcCore, ...this.hcLunch(lunch), ...this.hcTail];
    if (mode === "early") return [];
    return [...this.regularCore, ...this.regularLunch(lunch), ...this.regularTail];
  },

  // 2-hour delay groups follow the FLEX teacher.
  delayGroups: {
    A: "Meeks, Boszor, H. Hickman, Standish, Pablo, Geleott, Steph Dobson, Cook, Gillenwater, Wamsley, M. Hickman, Kimiecik, Sid Dobson, Henady",
    B: "Stevens, Wilson, Yeager, Sterk, Hawthorne, Eck, Tanner, Marlow, Sell, Spurgeon, Schmid, Redlin, Benner, Hege, Miller, Aviation, Criminal Justice"
  }
};

// "Period 4B · Part 1" -> "P4B", "A Lunch" -> "Lunch"
function shortName(name) {
  let s = name.split(" · ")[0];
  if (s.endsWith(" Lunch") || s.startsWith("Lunch")) return "Lunch";
  return s.replace("Period ", "P");
}

// "Period 4B · Part 1" -> 4, "FLEX" -> null
function periodNumber(name) {
  const m = name.match(/^Period (\d)/);
  return m ? Number(m[1]) : null;
}

function clockString(mins) {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  let h = h24 % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${h24 >= 12 ? "PM" : "AM"}`;
}
