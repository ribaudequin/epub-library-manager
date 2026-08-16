const STATUS_LABEL = {
  lido: 'Lido',
  nao_lido: 'Não Lido',
  pendente: 'Pendente',
};

const SERIE_STATE_LABEL = {
  ongoing: 'Ongoing',
  completed: 'Acabada',
  cancelled: 'Cancelada',
  hiatus: 'Hiatus',
};

const SERIE_STATE_COLOR = {
  ongoing: '#28a745',
  completed: '#0d6efd',
  cancelled: '#dc3545',
  hiatus: '#fd7e14',
};

function formatRelativeDate(mtime) {
  if (!mtime) return null;
  const now = Date.now();
  const diffMs = now - mtime;
  const diffDays = Math.floor(diffMs / 86400000);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const date = new Date(mtime);
  const dateStr = date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  let ago = '';
  if (diffDays < 1) {
    ago = 'hoje';
  } else if (diffDays < 7) {
    ago = `há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    ago = `há ${weeks} semana${weeks !== 1 ? 's' : ''}`;
  } else if (diffDays < 365) {
    ago = `há ${diffMonths} mês${diffMonths !== 1 ? 'es' : ''}`;
  } else {
    ago = `há ${diffYears} ano${diffYears !== 1 ? 's' : ''}`;
  }

  return `${dateStr} (${ago})`;
}

function serieStateBadge(state) {
  const label = SERIE_STATE_LABEL[state] || SERIE_STATE_LABEL.ongoing;
  return `<span class="series-state-badge" data-state="${state}">• ${label}</span>`;
}

function serieStateBadgeDetail(state) {
  const label = SERIE_STATE_LABEL[state] || SERIE_STATE_LABEL.ongoing;
  const color = SERIE_STATE_COLOR[state] || SERIE_STATE_COLOR.ongoing;
  return `<span class="state-badge" style="background:${color}">${label}</span>`;
}

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
      img.addEventListener('load', () => applyCoverTint(img));
    }
    coverObserver.unobserve(img);
  }
}, { rootMargin: '200px' });

async function applyCoverTint(img, extraEl) {
  try {
    const dataUrl = await window.api.readCover(decodeURIComponent(img.src.replace(/^file:\/\//, '')));
    if (!dataUrl) return;
    const tintImg = new Image();
    tintImg.onload = () => {
      const w = 8;
      const h = 12;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(tintImg, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
      r = Math.round(r / n);
      g = Math.round(g / n);
      b = Math.round(b / n);

      const boost = 2;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const avg = (r + g + b) / 3;
      // Escala HSV para preservar tons em imagens acinzentadas
      const satBoost = (max - min) / 255 < 0.15 ? 2 : 1.4;
      r = Math.round(avg + (r - avg) * boost * satBoost * (1 - (max - min) / 255));
      g = Math.round(avg + (g - avg) * boost * satBoost * (1 - (max - min) / 255));
      b = Math.round(avg + (b - avg) * boost * satBoost * (1 - (max - min) / 255));

      const card = img.closest('.series-card');
      if (card) {
        card.style.setProperty('--card-tint', `${r}, ${g}, ${b}`);
      }
      if (extraEl) {
        extraEl.style.setProperty('--serie-tint', `${r}, ${g}, ${b}`);
      }
    };
    tintImg.src = dataUrl;
  } catch {
    // fallback: sem tint (mantém o fundo base)
  }
}

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
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    const relDate = formatRelativeDate(s.lastModified);
    const badge = s.seriesState ? serieStateBadge(s.seriesState) : '';
    const authorText = s.author ? escapeHtml(s.author) : '';
    const dateText = relDate ? `<small class="series-meta">${relDate}</small>` : '';
    card.innerHTML = `
      ${coverHtml(s.cover)}
      <div class="series-info">
        <h3>${escapeHtml(s.name)}</h3>
        <p class="series-author">${authorText}</p>
        <p>${s.volumeCount} volume${s.volumeCount !== 1 ? 's' : ''} · ${s.readCount} lido${s.readCount !== 1 ? 's' : ''}</p>
        ${dateText}
        ${readProgressHtml(s.readCount, s.volumeCount)}
        ${badge}
      </div>
    `;
    card.addEventListener('click', () => openSeries(s.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSeries(s.id);
      }
    });
    grid.appendChild(card);
  }
  observeLazyImages(grid);
}

function openSeries(id) {
  const s = currentSeries.find((x) => x.id === id);
  if (!s) return;
  detailSeriesId = id;

  const detailCover = $('#detail-cover');
  const detailSection = $('#series-detail');
  if (s.cover) {
    detailCover.outerHTML = `<img id="detail-cover" class="lazy" data-src="file://${formatCoverPath(s.cover)}" alt="" src="file://${formatCoverPath(s.cover)}" />`;
    const img = $('#detail-cover');
    img.onload = () => applyCoverTint(img, detailSection);
  } else {
    detailCover.outerHTML = `<div id="detail-cover" class="placeholder">📕</div>`;
  }
  detailSection.style.removeProperty('--serie-tint');
  $('#detail-title').textContent = s.name;
  $('#detail-author').textContent = s.author || '';
  $('#detail-last-updated').textContent = formatRelativeDate(s.lastModified) || '';
  $('#detail-count').textContent =
    `${s.volumeCount} volume${s.volumeCount !== 1 ? 's' : ''}`;
  $('#detail-read-count').textContent =
    `${s.readCount} lido${s.readCount !== 1 ? 's' : ''}`;

  const pct = s.volumeCount ? Math.round((s.readCount / s.volumeCount) * 100) : 0;
  $('#progress-fill').style.width = pct + '%';
  $('#detail-progress-label').textContent = `${pct}%`;

  renderSeriesStateSelector(s.seriesState || 'ongoing');

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
      <div class="volume-name">${escapeHtml(v.name)}</div>
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

function renderSeriesStateSelector(currentState) {
  const container = $('#series-state-selector');
  const buttons = ['ongoing', 'completed', 'cancelled', 'hiatus'];
  container.innerHTML = buttons
    .map(
      (st) =>
        `<button class="state-btn${st === currentState ? ' active' : ''}" data-state="${st}">${
          SERIE_STATE_LABEL[st]
        }</button>`
    )
    .join('');
  container.querySelectorAll('.state-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const newState = btn.dataset.state;
      await window.api.setSeriesState(detailSeriesId, newState);
      updateSeriesState(newState);
    });
  });
}

function updateSeriesState(newState) {
  const s = currentSeries.find((x) => x.id === detailSeriesId);
  if (!s) return;
  s.seriesState = newState;
  document.querySelectorAll('.state-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.state === newState);
  });
  renderSeriesGrid();
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
