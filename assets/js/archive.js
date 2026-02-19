const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4kS-5UBlIb7AhPnVaJiXqggkptvdw2A2oh3YbN4rFd0wzG-YpZCDpwpZfsYgPaTPLtp6q8li9SLFN/pub?gid=0&single=true&output=csv";

async function loadArchive() {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();

    // 1. Split into rows
    const allRows = text.split("\n").slice(1);

    // 2. The "Security Guard": Only keep rows that have a speaker name
    // This prevents those empty rows at the bottom of your Sheet from appearing
    const rows = allRows.filter(r => {
      const columns = r.split(',');
      // Check if the 2nd column (Speaker) exists and isn't just empty space
      return columns[1] && columns[1].trim() !== "";
    });

    // 3. Process the valid rows
    const archive = rows.map(r => {
      const cols = [];
      let startValue = 0;
      let inQuotes = false;
      for (let i = 0; i < r.length; i++) {
        if (r[i] === '"') inQuotes = !inQuotes;
        if (r[i] === ',' && !inQuotes) {
          cols.push(r.substring(startValue, i));
          startValue = i + 1;
        }
      }
      cols.push(r.substring(startValue));

      const clean = (str) => str ? str.replace(/^["\s]+|["\s]+$/g, '').trim() : "";

      return {
        date: clean(cols[0]),
        speaker: clean(cols[1]),
        pi: clean(cols[2]),
        title: clean(cols[3]),
        status: clean(cols[4])
      };
    });

    // 4. Flip the order so newest is on top
    archive.reverse();

    // ... rest of your code (window.GS_ARCHIVE = archive, etc.)

    window.GS_ARCHIVE = archive;
    window.dispatchEvent(new CustomEvent('archiveLoaded'));
    renderNextTalk(archive);
    
  } catch (error) {
    console.error("Could not load the sheet:", error);
  }
}

function convertToLocalTime(dateStr) {
  if (!dateStr) return "";

  // 1. Create a date object from the string in your sheet (e.g., "March 2, 2026")
  const eventDate = new Date(dateStr);
  if (isNaN(eventDate.getTime())) return "";

  // 2. Logic: If day is 1-14, use 17:00 UTC. If 15-31, use 04:00 UTC.
  const dayOfMonth = eventDate.getDate();
  const hourUTC = (dayOfMonth <= 14) ? 17 : 4;

  // 3. Set the hours in UTC
  eventDate.setUTCHours(hourUTC, 0, 0);

  // 4. Convert to the user's local string
  const localTimeStr = eventDate.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    timeZoneName: 'short' 
  });

  return `Your time: ${localTimeStr}`;
}

function renderNextTalk(data) {
  const next = data.find(d => d.status === "Next");
  if (!next) return;

  const nextDateEl = document.getElementById("nextDate");
  if (!nextDateEl) return;

  // 1. Fill in basic info
  document.getElementById("nextSpeaker").innerText = next.speaker;
  document.getElementById("nextPI").innerText = next.pi;
  document.getElementById("nextTitle").innerText = next.title;
  nextDateEl.innerText = next.date;

  // 2. Logic for Session Badges
  const eventDate = new Date(next.date);
  const day = eventDate.getDate();
  
  // Create the badge element
  const badge = document.createElement("span");
  badge.className = "session-badge";
  
  if (day <= 14) {
    badge.innerText = "Session A: Atlantic Corridor";
    badge.classList.add("badge-atlantic");
  } else {
    badge.innerText = "Session B: Pacific Corridor";
    badge.classList.add("badge-pacific");
  }

  // 3. Put the badge at the top of the card (above the speaker name)
  const card = document.querySelector(".card"); // Finds the next talk card
  // Remove old badge if it exists so they don't stack
  const oldBadge = card.querySelector(".session-badge");
  if (oldBadge) oldBadge.remove();
  
  card.prepend(badge);

  // 4. Update Local Time
  const localTimeEl = document.getElementById("localTime");
  if (localTimeEl) {
    localTimeEl.innerText = convertToLocalTime(next.date);
  }
}

loadArchive();




