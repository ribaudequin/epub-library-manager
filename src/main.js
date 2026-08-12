const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fsp = require('fs/promises');
const { scanLibrary } = require('./library');

let mainWindow = null;
let stateFile = null;

if (process.env.TEST_USERDATA) {
  app.setPath('userData', process.env.TEST_USERDATA);
}

const STATUS_DEFAULT = 'nao_lido';
const VALID_STATUSES = ['lido', 'nao_lido', 'pendente'];

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
  const series = await scanLibrary(rootPath, coverCacheDir);
  return {
    series: buildLibraryView(series, state),
    rootPath,
  };
});

ipcMain.handle('library:set-status', async (_event, { seriesId, volumeId, status }) => {
  if (!VALID_STATUSES.includes(status)) throw new Error('Status inválido');
  const state = await loadState();
  if (!state.series[seriesId]) state.series[seriesId] = {};
  state.series[seriesId][volumeId] = status;
  await saveState(state);
  return true;
});

ipcMain.handle('library:get-root', async () => {
  const state = await loadState();
  return state.rootPath || null;
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
