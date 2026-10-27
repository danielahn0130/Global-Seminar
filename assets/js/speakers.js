// This waits for that "archiveLoaded" signal we created in archive.js
window.addEventListener('archiveLoaded', function() {
  const body = document.querySelector("[data-archive-body]");
  const search = document.querySelector("[data-archive-search]");
  
  // Get the data we saved to the window
  const rows = window.GS_ARCHIVE || [];

  // This function draws the table on the screen
  function renderTable(list) {
    if (!body) return;
    
    body.innerHTML = ""; // Clear the table first
    
    list.forEach(r => {
      const tr = document.createElement("tr");
[r.date, r.speaker, r.pi, r.title].forEach((value, index) => {
  const td = document.createElement("td");

  if (index === 1) {
    const strong = document.createElement("strong");
    strong.textContent = value || "";
    td.appendChild(strong);
  } else {
    td.textContent = value || "";
  }

  tr.appendChild(td);
});
      body.appendChild(tr);
    });
  }

  // This makes the search bar work
  if (search) {
    search.addEventListener('input', function(e) {
      const query = e.target.value.toLowerCase();
      
      const filteredResults = rows.filter(r => {
        return r.speaker.toLowerCase().includes(query) || 
               r.pi.toLowerCase().includes(query) || 
               r.title.toLowerCase().includes(query);
      });
      
      renderTable(filteredResults);
    });
  }

  // Draw the full table when the page first loads
  renderTable(rows);
});
