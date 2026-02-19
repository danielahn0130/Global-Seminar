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

function renderNextTalk(data) {
  // We look for "Next" anywhere in the data now
  const next = data.find(d => d.status === "Next");
  if (!next) return;

  if(document.getElementById("nextSpeaker")) {
    document.getElementById("nextSpeaker").innerText = next.speaker;
    document.getElementById("nextPI").innerText = next.pi;
    document.getElementById("nextTitle").innerText = next.title;
    document.getElementById("nextDate").innerText = next.date;
  }
}

loadArchive();


