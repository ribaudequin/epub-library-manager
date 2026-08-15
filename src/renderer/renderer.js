const STATUS_LABEL = {
  lido: 'Lido',
  nao_lido: 'Não lido',
  pendente: 'Pendente',
};

let currentSeries = [];
let currentRoot = null;
let detailSeriesId = null;

const $ = (sel) => document.querySelector(sel);

function isBulkDone() {
  const s = currentSeries.find((x) => x.id === detailSeriesId);
  if (!s) return false;
  return s.volumes.every((v) => v.status === 'lido');
}

const coverObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const img = entry.target;
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
    }
    coverObserver.unobserve(img);
  }
}, { rootMargin: '200px' });

function coverHtml(src) {
  if (src) {
    return `<img class="series-cover lazy" data-src="file://${formatCoverPath(src)}" alt="" />`;
  }
  return `<div class="series-cover placeholder">📕</div>`;
}

function observeLazyImages(container) {
  const imgs = container.querySelectorAll('img.lazy[data-src]');
  imgs.forEach((img) => coverObserver.observe(img));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCoverPath(src) {
  if (!src) return null;
  return encodeURI(src);
}

function readProgressHtml(readCount, total) {
  const pct = total ? Math.round((readCount / total) * 100) : 0;
  const color = pct === 100 ? '#28a745' : pct > 0 ? '#ffc107' : '#dc3545';
  return `
    <div class="series-progress">
      <div class="series-progress-bar" style="width:${pct}%;background:${color}"></div>
      <span class="series-progress-label">${pct}%</span>
    </div>`;
}

function renderSeriesGrid() {
  const grid = $('#series-grid');
  grid.innerHTML = '';
  for (const s of currentSeries) {
    const card = document.createElement('div');
    card.className = 'series-card';
    card.dataset.id = s.id;
    card.innerHTML = `
      ${coverHtml(s.cover)}
      <div class="series-info">
        <h3>${escapeHtml(s.name)}</h3>
        <p>${s.volumeCount} volume${s.volumeCount !== 1 ? 's' : ''}</p>
        <p>${s.readCount} lido${s.readCount !== 1 ? 's' : ''}</p>
        ${readProgressHtml(s.readCount, s.volumeCount)}
      </div>
    `;
    card.addEventListener('click', () => openSeries(s.id));
    grid.appendChild(card);
  }
  observeLazyImages(grid);
}

function openSeries(id) {
  const s = currentSeries.find((x) => x.id === id);
  if (!s) return;
  detailSeriesId = id;

  const detailCover = $('#detail-cover');
  if (s.cover) {
    detailCover.outerHTML = `<img id="detail-cover" src="file://${formatCoverPath(s.cover)}" alt="" />`;
  } else {
    detailCover.outerHTML = `<div id="detail-cover" class="placeholder">📕</div>`;
  }
  $('#detail-title').textContent = s.name;
  $('#detail-count').textContent =
    `${s.volumeCount} volume${s.volumeCount !== 1 ? 's' : ''}`;
  $('#detail-read-count').textContent =
    `${s.readCount} lido${s.readCount !== 1 ? 's' : ''}`;

  const pct = s.volumeCount ? Math.round((s.readCount / s.volumeCount) * 100) : 0;
  $('#progress-fill').style.width = pct + '%';
  $('#detail-progress-label').textContent = `${pct}%`;

  const list = $('#volume-list');
  list.innerHTML = '';
  for (const v of s.volumes) {
    const row = document.createElement('div');
    row.className = 'volume-row';
    const vCover = v.coverSrc
      ? `<img class="volume-cover lazy" data-src="file://${formatCoverPath(v.coverSrc)}" alt="" />`
      : `<div class="volume-cover placeholder">📕</div>`;
    row.innerHTML = `
      ${vCover}
      <div class="volume-name">${escapeHtml(v.title)}</div>
      <div class="volume-status">
        ${['lido', 'nao_lido', 'pendente']
          .map(
            (st) =>
              `<button class="status-btn${v.status === st ? ' active' : ''}" data-status="${st}">${STATUS_LABEL[st]}</button>`
          )
          .join('')}
      </div>
    `;
    row.querySelectorAll('.status-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.api.setStatus(id, v.id, btn.dataset.status);
        const series = currentSeries.find((x) => x.id === id);
        const vol = series.volumes.find((x) => x.id === v.id);
        vol.status = btn.dataset.status;
        series.readCount = series.volumes.filter((x) => x.status === 'lido').length;
        openSeries(id);
        renderSeriesGrid();
      });
    });
    list.appendChild(row);
  }
   observeLazyImages(list);

   updateToggleAllBtn();

   $('#series-view').classList.add('hidden');
   $('#series-detail').classList.remove('hidden');
}

function updateToggleAllBtn() {
  const s = currentSeries.find((x) => x.id === detailSeriesId);
  if (!s) return;
  const allRead = s.readCount >= s.volumeCount;
   $('#toggle-all-status').textContent = allRead
    ? 'Marcar tudo como não lido'
    : 'Marcar tudo como lido';
}

function backToSeries() {
  detailSeriesId = null;
  $('#series-detail').classList.add('hidden');
  $('#series-view').classList.remove('hidden');
}

function showEmptyState() {
  $('#empty-state').classList.remove('hidden');
  $('#series-view').classList.add('hidden');
  $('#series-detail').classList.add('hidden');
  $('#btn-scan').classList.add('hidden');
}

async function scanAndRender(root) {
  $('#loading-state').classList.remove('hidden');
  $('#empty-state').classList.add('hidden');
  $('#series-view').classList.add('hidden');
  $('#btn-scan').classList.add('hidden');
  try {
    const result = await window.api.scan(root);
    currentSeries = result.series;
    currentRoot = result.rootPath;
    renderSeriesGrid();
    $('#empty-state').classList.add('hidden');
    $('#series-detail').classList.add('hidden');
    $('#series-view').classList.remove('hidden');
    $('#btn-scan').classList.remove('hidden');
    if (currentSeries.length === 0) {
      $('#series-view').classList.add('hidden');
      $('#empty-state').classList.remove('hidden');
      $('#empty-state').innerHTML =
        '<p>A pasta selecionada não contém séries com ficheiros .epub.</p>';
    }
  } finally {
    $('#loading-state').classList.add('hidden');
  }
}

window.api.onProgress(({ done, total }) => {
  const pct = total ? Math.round((done / total) * 100) : 0;
  $('#loading-text').textContent = `A digitalizar… ${pct}% (${done}/${total})`;
  const bar = $('#loading-progress');
  if (bar) bar.style.width = pct + '%';
});

$('#btn-select').addEventListener('click', async () => {
  const root = await window.api.selectLibrary();
  if (root) {
    await scanAndRender(root);
  }
});

$('#btn-scan').addEventListener('click', async () => {
  if (currentRoot) await scanAndRender(currentRoot);
});

$('#btn-back').addEventListener('click', backToSeries);

$('#toggle-all-status').addEventListener('click', async () => {
  const s = currentSeries.find((x) => x.id === detailSeriesId);
  if (!s) return;
  const allRead = s.readCount >= s.volumeCount;
  const targetStatus = allRead ? 'nao_lido' : 'lido';
  const updates = s.volumes.map((v) => ({ id: v.id, status: targetStatus }));
  await window.api.bulkSetStatus(detailSeriesId, updates);
  for (const vol of s.volumes) {
    vol.status = targetStatus;
  }
  s.readCount = targetStatus === 'lido' ? s.volumeCount : 0;
  updateToggleAllBtn();
  openSeries(detailSeriesId);
});

(async () => {
  const testRoot = new URLSearchParams(location.search).get('root');
  if (testRoot) {
    await scanAndRender(testRoot);
    return;
  }
  const root = await window.api.getRoot();
  if (root) {
    await scanAndRender(root);
  } else {
    showEmptyState();
  }
})();
