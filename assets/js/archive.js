const CALENDAR_FEED_URL = "https://script.google.com/macros/s/AKfycbyHFZ4-tIDm5D15CAot7qbL_KVuMNoOUy5p9NFcYfqiTZZuPoYCu_mp4hg6NCKJezPfWQ/exec";
const CALENDAR_CACHE_KEY = "gs-calendar-events-v1";

// Convert Calendar's formatted descriptions into readable text.
// Preserve link destinations even when the visible text says "Join here".
function descriptionText(html) {
  const doc = new DOMParser().parseFromString(
    String(html || ""),
    "text/html"
  );

  doc.querySelectorAll("script, style").forEach(el => el.remove());

  doc.querySelectorAll("a").forEach(link => {
    const href = link.getAttribute("href") || "";
    const label = link.textContent || "";

    link.replaceWith(
      doc.createTextNode(`${label} ${href}`)
    );
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
  const pattern = new RegExp(
    "^\\s*" + label + "\\s*:\\s*(.+)$",
    "im"
  );

  return text.match(pattern)?.[1]?.trim() || "";
}

function findMeetingLink(text) {
  const links = text.match(/https?:\/\/[^\s<>"']+/gi) || [];

  for (const candidate of links) {
    const cleaned = candidate.replace(/[),.;]+$/, "");

    try {
      const url = new URL(cleaned);
      const host = url.hostname.toLowerCase();

      if (
        host === "zoom.us" ||
        host.endsWith(".zoom.us") ||
        host === "zoom.com" ||
        host.endsWith(".zoom.com") ||
        host === "voovmeeting.com" ||
        host.endsWith(".voovmeeting.com")
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

  // Your current titles place the talk title after the first colon.
  const colon = summary.indexOf(":");
  const heading = colon >= 0 ? summary.slice(0, colon) : summary;

  const sentence = text.match(
    /(?:^|\n)\s*([^,\n]+),\s*working with\s+(.+?)\s+will be our speaker\b/i
  );

  const supervisorInHeading = heading.match(
    /\b((?:Professor|Prof\.?|Dr\.?)\s+.+?)(?:['’]s)?\s+Group\s*$/i
  );

  const speaker =
    readLabel(text, "Speaker") ||
    sentence?.[1]?.trim() ||
    "Speaker to be announced";

  const supervisor =
    readLabel(text, "Supervisor") ||
    sentence?.[2]?.trim() ||
    supervisorInHeading?.[1]?.trim() ||
    "";

  const institution = readLabel(text, "Institution");

  const title =
    readLabel(text, "Talk title") ||
    (colon >= 0 ? summary.slice(colon + 1).trim() : summary);

  const joinUrl = findMeetingLink(
    `${text}\n${event.location || ""}`
  );

  return {
    start: event.start,
    end: event.end,

    // Keep the archive date consistent in the seminar's Pacific time zone.
    date: new Date(event.start).toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "short",
      day: "numeric"
    }),

    speaker,
    pi: [supervisor, institution].filter(Boolean).join(" · "),
    title,
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

function renderNextTalk(next) {
  const dateElement = document.getElementById("nextDate");
  if (!dateElement) return;

  const card = dateElement.closest(".card");
  card?.querySelector(".session-badge")?.remove();
  card?.querySelector("[data-meeting-details]")?.remove();

  const joinButton = document.getElementById("nextJoinLink");

  if (!next) {
    setText("nextSpeaker", "Next talk to be announced");
    setText("nextPI", "");
    setText("nextTitle", "Check back soon for our next seminar.");
    setText("nextDate", "");
    setText("localTime", "");

    if (joinButton) joinButton.hidden = true;
    return;
  }

  setText("nextSpeaker", next.speaker);
  setText("nextPI", next.pi);
  setText("nextTitle", next.title);

  // Display both the date and time in the visitor's local time zone.
  // This avoids pairing a Pacific date with a different local date.
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

function applyCalendarEvents(events) {
  const now = Date.now();

  const talks = events
    .filter(event =>
      Number.isFinite(Date.parse(event.start)) &&
      Number.isFinite(Date.parse(event.end))
    )
    .map(parseCalendarEvent)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  // Keep an ongoing talk available until its scheduled end.
  const next = talks.find(talk => Date.parse(talk.end) > now);

  window.GS_ARCHIVE = talks
    .filter(talk => Date.parse(talk.end) <= now)
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));

  renderNextTalk(next);
  window.dispatchEvent(new CustomEvent("archiveLoaded"));
}

async function loadArchive() {
  let events;

  try {
    const response = await fetch(CALENDAR_FEED_URL);

    if (!response.ok) {
      throw new Error(`Calendar request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.error || !Array.isArray(data.events)) {
      throw new Error(data.error || "Invalid calendar response.");
    }

    events = data.events;

    try {
      localStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        events
      }));
    } catch {
      // The calendar can still load if browser storage is unavailable.
    }

  } catch (error) {
    console.error("Could not load the calendar:", error);

    let cached;

    try {
      cached = JSON.parse(
        localStorage.getItem(CALENDAR_CACHE_KEY) || "null"
      );
    } catch {
      cached = null;
    }

    if (cached && Array.isArray(cached.events)) {
      events = cached.events;

      const notice = document.createElement("p");
      notice.className = "small";
      notice.textContent =
        "Calendar temporarily unavailable. Showing saved information from " +
        new Date(cached.savedAt).toLocaleString() + ".";

      document.querySelector(".tablewrap")?.before(notice);

    } else {
      setText("nextSpeaker", "Schedule temporarily unavailable");
      setText("nextPI", "");
      setText("nextTitle", "Please check the embedded calendar.");
      setText("nextDate", "");
      setText("localTime", "");

      const button = document.getElementById("nextJoinLink");
      if (button) button.hidden = true;

      const body = document.querySelector("[data-archive-body]");

      if (body) {
        const row = body.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.textContent =
          "The archive could not be loaded. Please try again later.";
      }

      return;
    }
  }

  applyCalendarEvents(events);

  // Move completed talks into the archive even if the page stays open.
  window.setInterval(() => applyCalendarEvents(events), 60000);
}

loadArchive();
