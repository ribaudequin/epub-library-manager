const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fsp = require('fs/promises');
const fs = require('fs');
const crypto = require('crypto');
const { scanLibrary, getMimeType } = require('./library');

let mainWindow = null;
let stateFile = null;
let fileWatcher = null;

if (process.env.TEST_USERDATA) {
  app.setPath('userData', process.env.TEST_USERDATA);
}

const STATUS_DEFAULT = 'nao_lido';
const VALID_STATUSES = ['lido', 'nao_lido', 'pendente'];
const VALID_SERIE_STATES = ['ongoing', 'completed', 'cancelled', 'hiatus'];
const SERIE_STATE_LABEL = {
  ongoing: 'Em andamento',
  completed: 'Completa',
  cancelled: 'Cancelada',
  hiatus: 'Hiatus',
};

function getStatePath() {
  if (!stateFile) {
    stateFile = path.join(app.getPath('userData'), 'biblioteca.json');
  }
  return stateFile;
}

async function loadState() {
  try {
    const raw = await fsp.readFile(getStatePath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { rootPath: null, series: {} };
  }
}

async function saveState(state) {
  await fsp.mkdir(path.dirname(getStatePath()), { recursive: true });
  await fsp.writeFile(getStatePath(), JSON.stringify(state, null, 2), 'utf8');
}

async function getCoverCacheDir() {
  const dir = path.join(app.getPath('userData'), 'covers');
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function getRecursiveMtime(dirPath) {
  let max = 0;
  const now = Date.now();
  for (const e of await fsp.readdir(dirPath, { withFileTypes: true })) {
    try {
      const s = await fsp.stat(path.join(dirPath, e.name));
      // Ignorar timestamps inválidos ou futuros (ex: Year 2107 de arquivos corrompidos)
      if (s.mtimeMs > 0 && s.mtimeMs <= now && s.mtimeMs > max) max = s.mtimeMs;
      if (e.isDirectory()) {
        const sub = await getRecursiveMtime(path.join(dirPath, e.name));
        if (sub > max) max = sub;
      }
    } catch {}
  }
  return max;
}

function buildLibraryView(series, state) {
  return series.map((s) => {
    const sState = state.series[s.id] || {};
    const volumes = s.volumes.map((v) => ({
      id: v.id,
      name: v.name,
      title: v.title,
      coverSrc: v.coverSrc,
      status: sState[v.id] || STATUS_DEFAULT,
    }));
    const readCount = volumes.filter((v) => v.status === 'lido').length;
    return {
      id: s.id,
      name: s.name,
      path: s.path,
      volumeCount: volumes.length,
      readCount,
      cover: s.cover,
      author: s.author || null,
      lastModified: s.lastModified || null,
      seriesState: sState.seriesState || 'ongoing',
      volumes,
    };
  });
}

ipcMain.handle('dialog:select-library', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecionar pasta raiz da biblioteca',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const rootPath = result.filePaths[0];
  const state = await loadState();
  state.rootPath = rootPath;
  await saveState(state);
  return rootPath;
});

ipcMain.handle('library:scan', async (_event, rootPath) => {
  if (!rootPath) return { series: [], rootPath: null };
  const state = await loadState();
  const coverCacheDir = await getCoverCacheDir();
  const win = BrowserWindow.fromWebContents(_event.sender);
  const sendProgress = (p) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('library:progress', p);
    }
  };
  const series = await scanLibrary(rootPath, coverCacheDir, sendProgress);
  return {
    series: buildLibraryView(series, state),
    rootPath,
  };
});

ipcMain.handle('library:mtime', async (_event, rootPath) => {
  if (!rootPath) return { rootMtime: 0, cacheKey: '' };
  try {
    const rootMtime = await getRecursiveMtime(rootPath);
    const cacheKey = 'biblioteca-cache-' + crypto.createHash('sha1').update(rootPath).digest('hex');
    return { rootMtime, cacheKey };
  } catch {
    return { rootMtime: 0, cacheKey: '' };
  }
});

ipcMain.handle('library:set-status', async (_event, { seriesId, volumeId, status }) => {
  if (!VALID_STATUSES.includes(status)) throw new Error('Status inválido');
  const state = await loadState();
  if (!state.series[seriesId]) state.series[seriesId] = {};
  state.series[seriesId][volumeId] = status;
  await saveState(state);
  return true;
});

ipcMain.handle('library:bulk-status', async (_event, { seriesId, updates }) => {
  const state = await loadState();
  if (!state.series[seriesId]) state.series[seriesId] = {};
  for (const { id, status } of updates) {
    if (VALID_STATUSES.includes(status)) {
      state.series[seriesId][id] = status;
    }
  }
  await saveState(state);
  return true;
});

ipcMain.handle('library:set-series-state', async (_event, { seriesId, seriesState }) => {
  if (!VALID_SERIE_STATES.includes(seriesState)) throw new Error('Estado de série inválido');
  const state = await loadState();
  if (!state.series[seriesId]) state.series[seriesId] = {};
  state.series[seriesId].seriesState = seriesState;
  await saveState(state);
  return true;
});

ipcMain.handle('library:get-root', async () => {
  const state = await loadState();
  return state.rootPath || null;
});

ipcMain.handle('cover:read', async (_event, coverPath) => {
  try {
    const buf = await fsp.readFile(coverPath);
    const mime = getMimeType(buf) || 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
});

ipcMain.handle('library:watch', async (_event, rootPath) => {
  if (fileWatcher) { fileWatcher.close(); fileWatcher = null; }
  if (!rootPath) return false;
  let debounceTimer = null;
  try {
    console.log('[WATCH] Starting watcher for:', rootPath);
    fileWatcher = fs.watch(rootPath, { recursive: true }, (event, filename) => {
      console.log('[WATCH] Event:', event, filename);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const win = BrowserWindow.fromWebContents(_event.sender);
        if (win && !win.isDestroyed()) {
          try {
            const rootMtime = await getRecursiveMtime(rootPath);
            console.log('[WATCH] Sending library:changed, rootMtime:', rootMtime);
            win.webContents.send('library:changed', { rootMtime });
          } catch (err) { console.error('[WATCH] Error:', err); }
        }
      }, 2000);
    });
    fileWatcher.on('error', (err) => console.error('[WATCH] Watcher error:', err));
    console.log('[WATCH] Watcher started successfully');
    return true;
  } catch (err) {
    console.error('[WATCH] Failed to start watcher:', err);
    return false;
  }
});

ipcMain.handle('library:unwatch', () => {
  if (fileWatcher) { fileWatcher.close(); fileWatcher = null; }
  return true;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Biblioteca de Epubs',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
    query: process.env.TEST_ROOT
      ? { root: process.env.TEST_ROOT }
      : undefined,
  });
}

app.whenReady().then(() => {
  createWindow();
  if (process.env.TEST_SCREENSHOT) {
    const fs = require('fs');
    const out = process.env.TEST_SCREENSHOT;
    mainWindow.webContents.on('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 2500));
      const img = await mainWindow.webContents.capturePage();
      fs.writeFileSync(out, img.toPNG());
      const dom = await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const series = await window.api.scan('${process.env.TEST_ROOT.replace(/'/g, "\\'")}');
          const s = series.series[0];
          const firstVol = s.volumes[0];
          await window.api.setStatus(s.id, firstVol.id, 'lido');
          await window.api.setStatus(s.id, s.volumes[1].id, 'pendente');
          const after = await window.api.scan('${process.env.TEST_ROOT.replace(/'/g, "\\'")}');
          const res = after.series[0];
          return JSON.stringify({
            seriesCount: after.series.length,
            vols: res.volumes.map(v => v.status),
            readCount: res.readCount,
            secondSeriesReadCount: after.series[1].readCount,
          });
        })()
      `);
      console.log('DOM:', dom);
      console.log('screenshot salvo em', out);
      app.quit();
    });
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
