const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4kS-5UBlIb7AhPnVaJiXqggkptvdw2A2oh3YbN4rFd0wzG-YpZCDpwpZfsYgPaTPLtp6q8li9SLFN/pub?gid=0&single=true&output=csv";

async function loadArchive() {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();

    // 1. Split into rows and FILTER out empty ones
    // This splits the text into rows
    const rows = text.split("\n").slice(1);

    // This filter ensures the row actually has a Date and a Speaker 
    // before we even try to process it.
    const validRows = rows.filter(r => {
      const parts = r.split(',');
      return parts.length > 1 && parts[0].trim() !== "";
    });

    const archive = rows.map(r => {
      // This new logic splits the line correctly even with complex commas
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
      cols.push(r.substring(startValue)); // Push the last column

      // Helper to clean up quotes and extra spaces
      const clean = (str) => str ? str.replace(/^["\s]+|["\s]+$/g, '').trim() : "";

      return {
        date: clean(cols[0]),
        speaker: clean(cols[1]),
        pi: clean(cols[2]),
        title: clean(cols[3]),
        status: clean(cols[4])
      };
    });

    // 3. Reverse the order so the bottom of the sheet is the top of the site
    archive.reverse();

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

