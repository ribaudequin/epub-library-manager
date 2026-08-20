const STATUS_LABEL = {};

const SERIE_STATE_LABEL = {};

const SERIE_STATE_COLOR = {
  ongoing: '#28a745',
  completed: '#0d6efd',
  cancelled: '#dc3545',
  hiatus: '#fd7e10',
};

const SERIE_STATE_TOOLTIP = {};

const DEBOUNCE_MS = 300;
let searchDebounceId = null;

function formatRelativeDate(mtime) {
  if (!mtime) return null;
  const now = Date.now();
  const diffMs = now - mtime;
  const diffDays = Math.floor(diffMs / 86400000);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const currentLang = window.i18n ? window.i18n.getLocale() : 'pt';
  const localeTag = currentLang === 'pt' ? 'pt-PT' : 'en-GB';

  const date = new Date(mtime);
  const dateStr = date.toLocaleDateString(localeTag, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const t = (key, vars) => window.i18n ? window.i18n.t(key, vars) : key;

  let ago = '';
  if (diffDays < 1) {
    ago = t('date_today');
  } else if (diffDays < 7) {
    ago = t('date_ago', { count: diffDays, unit: t(diffDays !== 1 ? 'unit_days' : 'unit_day') });
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    ago = t('date_ago', { count: weeks, unit: t(weeks !== 1 ? 'unit_weeks' : 'unit_week') });
  } else if (diffMonths <= 23) {
    ago = t('date_ago', { count: diffMonths, unit: t(diffMonths === 1 ? 'unit_month' : 'unit_months') });
  } else {
    const years = Math.floor(diffMonths / 12);
    ago = t('date_ago', { count: years, unit: t(years !== 1 ? 'unit_years' : 'unit_year') });
  }

  return `${dateStr} (${ago})`;
}

function serieStateBadge(state) {
  const label = SERIE_STATE_LABEL[state] || SERIE_STATE_LABEL.ongoing;
  const tooltip = SERIE_STATE_TOOLTIP[state] || '';
  return `<span class="series-state-badge" data-state="${state}" title="${tooltip}">• ${label}</span>`;
}

function serieStateBadgeDetail(state) {
  const label = SERIE_STATE_LABEL[state] || SERIE_STATE_LABEL.ongoing;
  const color = SERIE_STATE_COLOR[state] || SERIE_STATE_COLOR.ongoing;
  return `<span class="state-badge" style="background:${color}">${label}</span>`;
}

let currentSeries = [];
let filteredSeries = [];
let currentRoot = null;
let isWatching = false;
let detailSeriesId = null;
let currentSort = localStorage.getItem('sortKey') || 'name-asc';
let filterText = '';

const $ = (sel) => document.querySelector(sel);

async function initI18n() {
  try {
    const { locale, isPt } = await window.api.getLocale();
    window.i18n.setLocale(isPt ? 'pt' : 'en');
  } catch {
    window.i18n.setLocale('pt');
  }
  updateUI();
  updateI18nLabels();
}

function updateUI() {
  const t = (key, vars = {}) => window.i18n ? window.i18n.t(key, vars) : key;
  document.title = t('app_title');
  const btnSelect = $('#btn-select');
  const btnScan = $('#btn-scan');
  const btnBack = $('#btn-back');
  if (btnSelect) btnSelect.textContent = t('btn_select_folder');
  if (btnScan) btnScan.textContent = t('btn_refresh');
  if (btnBack) btnBack.textContent = t('btn_back');
  const searchInput = $('#search-input');
  const searchClear = $('#search-clear');
  if (searchInput) searchInput.placeholder = t('search_placeholder');
  if (searchInput) searchInput.setAttribute('aria-label', t('search_aria'));
  if (searchClear) searchClear.setAttribute('aria-label', t('search_clear_aria'));
  const sortSelect = $('#sort-select');
  if (sortSelect) {
    if (sortSelect.options[0]) sortSelect.options[0].textContent = t('sort_name_asc');
    if (sortSelect.options[1]) sortSelect.options[1].textContent = t('sort_name_desc');
    if (sortSelect.options[2]) sortSelect.options[2].textContent = t('sort_progress');
    if (sortSelect.options[3]) sortSelect.options[3].textContent = t('sort_mtime');
  }
  if ($('label[for="search-input"]')) $('label[for="search-input"]').textContent = t('search_label');
  if ($('label[for="sort-select"]')) $('label[for="sort-select"]').textContent = t('sort_label');
}

function updateI18nLabels() {
  const t = window.i18n.t.bind(window.i18n);
  STATUS_LABEL.lido = t('status_lido');
  STATUS_LABEL.nao_lido = t('status_nao_lido');
  STATUS_LABEL.pendente = t('status_pendente');
  SERIE_STATE_LABEL.ongoing = t('serie_ongoing');
  SERIE_STATE_LABEL.completed = t('serie_completed');
  SERIE_STATE_LABEL.cancelled = t('serie_cancelled');
  SERIE_STATE_LABEL.hiatus = t('serie_hiatus');
  SERIE_STATE_TOOLTIP.ongoing = t('serie_state_ongoing');
  SERIE_STATE_TOOLTIP.completed = t('serie_state_completed');
  SERIE_STATE_TOOLTIP.cancelled = t('serie_state_cancelled');
  SERIE_STATE_TOOLTIP.hiatus = t('serie_state_hiatus');
}

function t(key, vars = {}) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    return window.i18n.t(key, vars);
  }
  return key;
}

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
  const normalized = src.replace(/\\/g, '/').replace(/^(file:\/\/?)/, '');
  return encodeURI(normalized);
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

const SORT_FNS = {
  'name-asc': (a, b) => a.name.localeCompare(b.name),
  'name-desc': (a, b) => b.name.localeCompare(a.name),
  'progress-desc': (a, b) => {
    const pa = a.volumeCount ? (a.readCount / a.volumeCount) : 0;
    const pb = b.volumeCount ? (b.readCount / b.volumeCount) : 0;
    return pb - pa;
  },
  'mtime-desc': (a, b) => (b.lastModified || 0) - (a.lastModified || 0),
};

function applySort() {
  const fn = SORT_FNS[currentSort];
  if (fn) currentSeries.sort(fn);
  $('#sort-select').value = currentSort;
  localStorage.setItem('sortKey', currentSort);
}

function applyFilter() {
  const q = filterText.toLowerCase().trim();
  if (!q) {
    filteredSeries = [...currentSeries];
  } else {
    filteredSeries = currentSeries.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.author && s.author.toLowerCase().includes(q))
    );
  }
}

function renderSeriesGrid() {
  const grid = $('#series-grid');
  grid.innerHTML = '';
  for (const s of filteredSeries) {
    const card = document.createElement('div');
    card.className = 'series-card';
    card.dataset.id = s.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    const relDate = formatRelativeDate(s.lastModified);
    const badge = s.seriesState ? serieStateBadge(s.seriesState) : '';
    const authorText = s.author ? escapeHtml(s.author) : '';
    const dateText = relDate ? `<small class="series-meta">${relDate}</small>` : '';
    
  const volText = t('series_volume_count', { count: s.volumeCount });
  const readText = t('series_read_count', { count: s.readCount });

  card.innerHTML = `
    ${coverHtml(s.cover)}
    <div class="series-info">
      <h3>${escapeHtml(s.name)}</h3>
      <p class="series-author">${authorText}</p>
      <p>${volText} · ${readText}</p>
      ${dateText}
      ${readProgressHtml(s.readCount, s.volumeCount)}
      ${badge}
    </div>
  `;
    card.innerHTML = `
      ${coverHtml(s.cover)}
      <div class="series-info">
        <h3>${escapeHtml(s.name)}</h3>
        <p class="series-author">${authorText}</p>
        <p>${volText} · ${readText}</p>
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
  $('#detail-count').textContent = t('detail_count', { count: s.volumeCount });
  $('#detail-read-count').textContent = t('detail_read_count', { count: s.readCount });

  const pct = s.volumeCount ? Math.round((s.readCount / s.volumeCount) * 100) : 0;
  $('#progress-fill').style.width = pct + '%';
  $('#detail-progress-label').textContent = t('detail_progress_label', { pct });

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
    ? t('btn_toggle_all_unread')
    : t('btn_toggle_all_read');
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
  $('#empty-title').textContent = t('empty_state_title');
  $('#empty-desc').textContent = t('empty_state_desc');
}

function updateEmptyStateStrings() {
  if (!currentRoot) {
    $('#empty-title').textContent = t('empty_state_title');
    $('#empty-desc').textContent = t('empty_state_desc');
  } else if (currentSeries.length === 0) {
    $('#empty-title').textContent = t('empty_state_no_epubs');
    $('#empty-desc').textContent = '';
  }
}

function showCacheStatus(fromCache, count) {
  let el = $('#cache-status');
  if (!el) {
    el = document.createElement('span');
    el.id = 'cache-status';
    el.style.cssText = 'font-size:12px;margin-left:12px;opacity:.85;transition:opacity .4s';
    $('.actions').appendChild(el);
  }
  el.textContent = fromCache ? t('cache_status_cached', { count }) : t('cache_status_scanned');
  el.style.color = fromCache ? 'var(--green)' : 'var(--accent)';
  el.style.opacity = '1';
  clearTimeout(el._ht);
  el._ht = setTimeout(() => { el.style.opacity = '0'; }, 3500);
}

async function scanAndRender(root) {
  // Try cache
  try {
    const { cacheKey, rootMtime } = await window.api.getMtime(root);
    if (cacheKey && rootMtime) {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const c = JSON.parse(raw);
        if (c.version === 1 && c.rootPath === root && c.rootMtime === rootMtime) {
          currentSeries = c.series;
          currentRoot = root;
          applySort(); applyFilter(); renderSeriesGrid();
          $('#empty-state').classList.add('hidden');
          $('#series-detail').classList.add('hidden');
          $('#series-view').classList.remove('hidden');
          $('#btn-scan').classList.remove('hidden');
          showCacheStatus(true, currentSeries.length);
          startWatching(root);
          return;
        }
      }
    }
  } catch {}

  // Full scan
  $('#loading-state').classList.remove('hidden');
  $('#empty-state').classList.add('hidden');
  $('#series-view').classList.add('hidden');
  $('#btn-scan').classList.add('hidden');
  try {
    const result = await window.api.scan(root);
    currentSeries = result.series;
    currentRoot = result.rootPath;
    try {
      const { cacheKey, rootMtime } = await window.api.getMtime(root);
      if (cacheKey && rootMtime) localStorage.setItem(cacheKey, JSON.stringify({
        version: 1, rootPath: root, rootMtime, lastScan: Date.now(), series: currentSeries,
      }));
    } catch {}
    applySort(); applyFilter(); renderSeriesGrid();
    $('#empty-state').classList.add('hidden');
    $('#series-detail').classList.add('hidden');
    $('#series-view').classList.remove('hidden');
    $('#btn-scan').classList.remove('hidden');
     showCacheStatus(false, currentSeries.length);
    if (currentSeries.length === 0) {
      $('#series-view').classList.add('hidden');
      $('#empty-state').classList.remove('hidden');
      $('#empty-title').textContent = t('empty_state_no_epubs');
      $('#empty-desc').textContent = '';
    } else {
      startWatching(root);
    }
  } finally {
    $('#loading-state').classList.add('hidden');
  }
}

window.api.onProgress(({ done, total }) => {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const t = window.i18n ? window.i18n.t.bind(window.i18n) : (k) => k;
  $('#loading-text').textContent = t('loading_progress', { pct, done, total });
  const bar = $('#loading-progress');
  if (bar) bar.style.width = pct + '%';
});

async function startWatching(root) {
  if (isWatching) return;
  try {
    isWatching = await window.api.watchLibrary(root);
  } catch {
    isWatching = false;
  }
}

function stopWatching() {
  if (!isWatching) return;
  window.api.unwatchLibrary();
  isWatching = false;
}

window.api.onLibraryChanged((data) => {
  if (!currentRoot) return;
  stopWatching();
  scanAndRender(currentRoot);
});

$('#btn-select').addEventListener('click', async () => {
  const root = await window.api.selectLibrary();
  if (root) {
    await scanAndRender(root);
  }
});

$('#btn-scan').addEventListener('click', async () => {
  if (!currentRoot) return;
  // Forçar rescan: limpar cache para detetar mudanças
  try {
    const { cacheKey } = await window.api.getMtime(currentRoot);
    if (cacheKey) localStorage.removeItem(cacheKey);
  } catch {}
  await scanAndRender(currentRoot);
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

$('#sort-select').addEventListener('change', () => {
  currentSort = $('#sort-select').value;
  applySort();
  applyFilter();
  renderSeriesGrid();
});

function onSearchInput() {
  const val = $('#search-input').value;
  filterText = val;
  const info = $('#search-info');
  if (val.trim() === '') {
    info.textContent = '';
    $('#search-clear').setAttribute('aria-hidden', 'true');
  } else {
    $('#search-clear').setAttribute('aria-hidden', 'false');
  }
  clearTimeout(searchDebounceId);
  searchDebounceId = setTimeout(() => {
    applyFilter();
    renderSeriesGrid();
    if (val.trim()) {
      info.textContent = t('search_info', { filtered: filteredSeries.length, total: currentSeries.length });
    }
  }, DEBOUNCE_MS);
}

function clearSearch() {
  $('#search-input').value = '';
  filterText = '';
  applyFilter();
  renderSeriesGrid();
  $('#search-info').textContent = '';
  $('#search-clear').setAttribute('aria-hidden', 'true');
  $('#search-input').focus();
}

$('#search-input').addEventListener('input', onSearchInput);
$('#search-clear').addEventListener('click', clearSearch);
$('#search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') clearSearch();
});
$('#search-clear').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    clearSearch();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    $('#search-input').focus();
  }
});

$('#sort-select').value = currentSort;

(async () => {
  const testRoot = new URLSearchParams(location.search).get('root');
  await initI18n();
  const root = testRoot || await window.api.getRoot();
  if (root) {
    await scanAndRender(root);
  } else {
    showEmptyState();
  }
})();
