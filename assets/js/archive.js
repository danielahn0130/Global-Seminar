const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4kS-5UBlIb7AhPnVaJiXqggkptvdw2A2oh3YbN4rFd0wzG-YpZCDpwpZfsYgPaTPLtp6q8li9SLFN/pub?gid=0&single=true&output=csv";

async function loadArchive() {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();

    // This splits the Google Sheet into rows
    // This splits into rows AND removes any row that is completely empty
    const rows = text.split("\n").slice(1).filter(r => r.trim().length > 0);

    const archive = rows.map(r => {
      const cols = r.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      return {
        date: cols[0],
        speaker: cols[1],
        pi: cols[2],
        title: cols[3],
        status: cols[4]
      };
    });

    archive.reverse(); // This flips the list so the newest entry in the sheet is on top

    // BABY STEP: This line "saves" the data so the speakers page can see it
    window.GS_ARCHIVE = archive;

    // This tells the browser: "Hey, I've finished downloading the data!"
    window.dispatchEvent(new CustomEvent('archiveLoaded'));

    // This updates the "Next Talk" box on your homepage
    renderNextTalk(archive);
    
  } catch (error) {
    console.error("Could not load the sheet:", error);
  }
}

function renderNextTalk(data) {
  // Finds the row in your sheet where status is "Next"
  const next = data.find(d => d.status.trim() === "Next");

  if (!next) return;

  // We look for the IDs in your HTML to fill them with info
  // Note: We need to make sure your index.html has these IDs (see below)
  if(document.getElementById("nextSpeaker")) {
    document.getElementById("nextSpeaker").innerText = next.speaker;
    document.getElementById("nextPI").innerText = next.pi;
    document.getElementById("nextTitle").innerText = next.title;
    document.getElementById("nextDate").innerText = next.date;
  }
const zoomBtn = document.querySelector('.hero .btn.primary');
if (next.status === "Live" && zoomBtn) {
    zoomBtn.classList.add('live-now');
    zoomBtn.innerText = "🔴 Join Live Now";
}
}

// This actually starts the whole process
loadArchive();




