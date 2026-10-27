// Paste the Calendar Apps Script URL you are already using here.
const CALENDAR_FEED_URL = "https://script.google.com/macros/s/AKfycbyHFZ4-tIDm5D15CAot7qbL_KVuMNoOUy5p9NFcYfqiTZZuPoYCu_mp4hg6NCKJezPfWQ/exec";

// Existing Google Sheet for the older talks.
const LEGACY_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4kS-5UBlIb7AhPnVaJiXqggkptvdw2A2oh3YbN4rFd0wzG-YpZCDpwpZfsYgPaTPLtp6q8li9SLFN/pub?gid=0&single=true&output=csv";

const ARCHIVE_CUTOFF = "2026-05-01";
const SEMINAR_TIME_ZONE = "America/Los_Angeles";

// Read CSV correctly, including commas, quotation marks,
// and line breaks inside a presentation title.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  text = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const character = text[i];

    if (character === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if (
      (character === "\n" || character === "\r") &&
      !quoted
    ) {
      if (character === "\r" && text[i + 1] === "\n") i++;

      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("Incomplete CSV response.");

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// Convert Sheet dates to YYYY-MM-DD for filtering and sorting.
function sheetDateKey(value) {
  const text = String(value || "").trim();

  const iso = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/
  );

  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

// Apply the Calendar cutoff using the seminar's Pacific date.
function calendarDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEMINAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

// Read one source, with a saved browser copy as a fallback.
async function loadSource(url, cacheKey, convert, label) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${label}: HTTP ${response.status}`);
    }

    const rows = await convert(response);

    if (!Array.isArray(rows)) {
      throw new Error(`${label}: invalid response.`);
    }

    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        savedAt: new Date().toISOString(),
        rows
      }));
    } catch {
      // Loading still works when browser storage is unavailable.
    }

    return { rows, warning: "" };
  } catch (error) {
    console.error(error);

    try {
      const cached = JSON.parse(
        localStorage.getItem(cacheKey) || "null"
      );

      if (cached && Array.isArray(cached.rows)) {
        return {
          rows: cached.rows,
          warning:
            `${label} is temporarily unavailable. ` +
            "Showing saved information from " +
            new Date(cached.savedAt).toLocaleString() + "."
        };
      }
    } catch {
      // No usable saved copy.
    }

    return {
      rows: null,
      warning: `${label} could not be loaded.`
    };
  }
}

// Convert formatted Calendar descriptions into plain text,
// preserving meeting-link destinations.
function descriptionText(html) {
  const doc = new DOMParser().parseFromString(
    String(html || ""),
    "text/html"
  );

  doc.querySelectorAll("script, style").forEach(el => el.remove());

  doc.querySelectorAll("a").forEach(link => {
    link.replaceWith(doc.createTextNode(
      `${link.textContent || ""} ${link.getAttribute("href") || ""}`
    ));
  });

  doc.querySelectorAll("br").forEach(el => {
    el.replaceWith(doc.createTextNode("\n"));
  });

  doc.querySelectorAll("p, div, li").forEach(el => {
    el.appendChild(doc.createTextNode("\n"));
  });

  return (doc.body.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "");
}

function readLabel(text, label) {
  return text.match(
    new RegExp("^\\s*" + label + "\\s*:\\s*(.+)$", "im")
  )?.[1]?.trim() || "";
}

function findMeetingLink(text) {
  const links = text.match(/https?:\/\/[^\s<>"']+/gi) || [];

  for (const candidate of links) {
    try {
      const url = new URL(candidate.replace(/[),.;]+$/, ""));
      const host = url.hostname.toLowerCase();

      if (
        ["zoom.us", "zoom.com", "voovmeeting.com"].some(
          domain => host === domain || host.endsWith("." + domain)
        )
      ) {
        return url.href;
      }
    } catch {
      // Ignore malformed URLs.
    }
  }

  return "";
}

function parseCalendarEvent(event) {
  const text = descriptionText(event.description);
  const summary = String(event.title || "").trim();
  const colon = summary.indexOf(":");
  const heading = colon >= 0 ? summary.slice(0, colon) : summary;

  const sentence = text.match(
    /(?:^|\n)\s*([^,\n]+),\s*working with\s+(.+?)\s+will be our speaker\b/i
  );

  const supervisorInHeading = heading.match(
    /\b((?:Professor|Prof\.?|Dr\.?)\s+.+?)(?:['’]s)?\s+Group\s*$/i
  );

  const supervisor =
    readLabel(text, "Supervisor") ||
    sentence?.[2]?.trim() ||
    supervisorInHeading?.[1]?.trim() ||
    "";

  const institution = readLabel(text, "Institution");
  const joinUrl = findMeetingLink(
    `${text}\n${event.location || ""}`
  );

  return {
    start: event.start,
    end: event.end,
    sortDate: calendarDateKey(event.start),

    date: new Date(event.start).toLocaleDateString("en-US", {
      timeZone: SEMINAR_TIME_ZONE,
      year: "numeric",
      month: "short",
      day: "numeric"
    }),

    speaker:
      readLabel(text, "Speaker") ||
      sentence?.[1]?.trim() ||
      "Speaker to be announced",

    pi: [supervisor, institution].filter(Boolean).join(" · "),

    title:
      readLabel(text, "Talk title") ||
      (colon >= 0 ? summary.slice(colon + 1).trim() : summary),

    joinUrl,
    platform: joinUrl.includes("voovmeeting.com") ? "VooV" : "Zoom",
    meetingId: readLabel(text, "Meeting ID"),
    password:
      readLabel(text, "Password") ||
      readLabel(text, "Passcode")
  };
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function renderNextTalk(next, calendarAvailable) {
  const dateElement = document.getElementById("nextDate");
  if (!dateElement) return;

  const card = dateElement.closest(".card");
  const joinButton = document.getElementById("nextJoinLink");

  card?.querySelector(".session-badge")?.remove();
  card?.querySelector("[data-meeting-details]")?.remove();

  if (!next) {
    setText(
      "nextSpeaker",
      calendarAvailable
        ? "Next talk to be announced"
        : "Schedule temporarily unavailable"
    );

    setText("nextPI", "");
    setText(
      "nextTitle",
      calendarAvailable
        ? "Check back soon for our next seminar."
        : "Please check the embedded calendar."
    );
    setText("nextDate", "");
    setText("localTime", "");

    if (joinButton) joinButton.hidden = true;
    return;
  }

  setText("nextSpeaker", next.speaker);
  setText("nextPI", next.pi);
  setText("nextTitle", next.title);

  const start = new Date(next.start);

  setText("nextDate", start.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  }));

  setText("localTime", start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }));

  if (joinButton) {
    joinButton.hidden = !next.joinUrl;

    if (next.joinUrl) {
      joinButton.href = next.joinUrl;
      joinButton.textContent = `Join ${next.platform}`;
    }
  }

  if (card && (next.meetingId || next.password)) {
    const details = document.createElement("p");
    details.className = "small";
    details.dataset.meetingDetails = "";

    details.textContent = [
      next.meetingId ? `Meeting ID: ${next.meetingId}` : "",
      next.password ? `Password: ${next.password}` : ""
    ].filter(Boolean).join(" · ");

    card.appendChild(details);
  }
}

function applyCombinedArchive(events, legacyRows, calendarAvailable) {
  const now = Date.now();

  // Calendar contributes only talks on or after May 1, 2026.
  const calendarTalks = events
    .filter(event =>
      Number.isFinite(Date.parse(event.start)) &&
      Number.isFinite(Date.parse(event.end)) &&
      calendarDateKey(event.start) >= ARCHIVE_CUTOFF
    )
    .map(parseCalendarEvent)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  // Google Sheets contributes only talks before May 1, 2026.
  const olderTalks = legacyRows.filter(row =>
    row.sortDate && row.sortDate < ARCHIVE_CUTOFF
  );

  const completedCalendarTalks = calendarTalks.filter(
    talk => Date.parse(talk.end) <= now
  );

  window.GS_ARCHIVE = [
    ...olderTalks,
    ...completedCalendarTalks
  ].sort((a, b) =>
    b.sortDate.localeCompare(a.sortDate) ||
    Date.parse(b.start || 0) - Date.parse(a.start || 0)
  );

  const next = calendarTalks.find(
    talk => Date.parse(talk.end) > now
  );

  renderNextTalk(next, calendarAvailable);
  window.dispatchEvent(new CustomEvent("archiveLoaded"));
}

async function loadArchive() {
  const [calendar, legacy] = await Promise.all([
    loadSource(
      CALENDAR_FEED_URL,
      "gs-calendar-source-v2",
      async response => {
        const data = await response.json();

        if (data.error || !Array.isArray(data.events)) {
          throw new Error(data.error || "Invalid Calendar data.");
        }

        return data.events;
      },
      "Google Calendar"
    ),

    loadSource(
      LEGACY_SHEET_URL,
      "gs-legacy-source-v2",
      async response => {
        const text = await response.text();

        if (/^\s*</.test(text)) {
          throw new Error("The Sheet returned a web page instead of CSV.");
        }

        return parseCSV(text)
          .slice(1)
          .filter(columns => String(columns[1] || "").trim())
          .map(columns => {
            const date = String(columns[0] || "").trim();

            return {
              date,
              sortDate: sheetDateKey(date),
              speaker: String(columns[1] || "").trim(),
              pi: String(columns[2] || "").trim(),
              title: String(columns[3] || "").trim()
            };
          });
      },
      "The older-talk archive"
    )
  ]);

  document.querySelector("[data-archive-notice]")?.remove();

  const warnings = [calendar.warning, legacy.warning].filter(Boolean);

  if (warnings.length) {
    const notice = document.createElement("p");
    notice.className = "small";
    notice.dataset.archiveNotice = "";
    notice.setAttribute("role", "status");
    notice.textContent = warnings.join(" ");

    const target =
      document.querySelector(".tablewrap") ||
      document.getElementById("nextDate")?.closest(".card");

    target?.before(notice);
  }

  const update = () => applyCombinedArchive(
    calendar.rows || [],
    legacy.rows || [],
    calendar.rows !== null
  );

  update();

  // Update which talk is next while the page remains open.
  window.setInterval(update, 60000);
}

loadArchive();
