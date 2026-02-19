const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4kS-5UBlIb7AhPnVaJiXqggkptvdw2A2oh3YbN4rFd0wzG-YpZCDpwpZfsYgPaTPLtp6q8li9SLFN/pub?gid=0&single=true&output=csv";

async function loadArchive() {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();

    // 1. Split into rows and FILTER out empty ones
    const rows = text.split("\n").slice(1).filter(r => r.trim().length > 0);

    const archive = rows.map(r => {
      // 2. Smart CSV Parser (handles commas inside quotes)
      const cols = r.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      
      // Clean up quotes from the text if they exist
      const clean = (str) => str ? str.replace(/^"|"$/g, '').trim() : "";

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
