const SHEET_URL = https://docs.google.com/spreadsheets/d/e/2PACX-1vQ4kS-5UBlIb7AhPnVaJiXqggkptvdw2A2oh3YbN4rFd0wzG-YpZCDpwpZfsYgPaTPLtp6q8li9SLFN/pub?output=csv;

async function loadArchive(){

  const res = await fetch(SHEET_URL);
  const text = await res.text();

  const rows = text.split("\n").slice(1);

  const archive = rows.map(r=>{
    const cols = r.split(",");
    return {
      date: cols[0],
      speaker: cols[1],
      pi: cols[2],
      title: cols[3],
      status: cols[4]
    };
  });

  renderArchive(archive);

  renderNextTalk(archive);

}

function renderNextTalk(data){

  const next = data.find(d=>d.status==="Next");

  if(!next) return;

  document.getElementById("nextSpeaker").innerText = next.speaker;
  document.getElementById("nextPI").innerText = next.pi;
  document.getElementById("nextTitle").innerText = next.title;
  document.getElementById("nextDate").innerText = next.date;

}

loadArchive();
