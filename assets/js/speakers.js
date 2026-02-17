(function () {
  const body = document.querySelector("[data-archive-body]");
  const search = document.querySelector("[data-archive-search]");
  if (!body || !window.GS_ARCHIVE) return;

  const rows = window.GS_ARCHIVE;

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function render(list){
    body.innerHTML = "";
    for (const r of list){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(r.date)}</td>
        <td><strong>${esc(r.speaker)}</strong></td>
        <td>${esc(r.pi)}</td>
        <td>${esc(r.title)}</td>
      `;
      body.appendChild(tr);
    }
  }

  function filter(q){
    const x = q.trim().toLowerCase();
    if (!x) return rows;
    return rows.filter(r =>
      (r.date || "").toLowerCase().includes(x) ||
      (r.series || "").toLowerCase().includes(x) ||
      (r.speaker || "").toLowerCase().includes(x) ||
      (r.pi || "").toLowerCase().includes(x) ||
      (r.title || "").toLowerCase().includes(x)
    );
  }

  if (search){
    search.addEventListener("input", e => render(filter(e.target.value)));
  }

  render(rows);
})();
