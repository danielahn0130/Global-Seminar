window.addEventListener('archiveLoaded', () => {
  const body = document.querySelector("[data-archive-body]");
  const search = document.querySelector("[data-archive-search]");
  const rows = window.GS_ARCHIVE || [];

  function render(list) {
    body.innerHTML = list.map(r => `
      <tr>
        <td>${r.date}</td>
        <td><strong>${r.speaker}</strong></td>
        <td>${r.pi}</td>
        <td>${r.title}</td>
      </tr>
    `).join('');
  }

  search.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = rows.filter(r => 
      r.speaker.toLowerCase().includes(q) || 
      r.pi.toLowerCase().includes(q) || 
      r.title.toLowerCase().includes(q)
    );
    render(filtered);
  });

  render(rows); // Initial render
});
