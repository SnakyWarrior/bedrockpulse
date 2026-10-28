const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const JSZip = require('jszip');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
const MAX_ICON_BYTES = 400 * 1024;

let mainWindow;

// ---------- state (links + settings) ----------

const statePath = () => path.join(app.getPath('userData'), 'state.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(next) {
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(next, null, 2));
}

// ---------- minecraft folder ----------

function defaultMojangPath() {
  const candidates = [
    path.join(process.env.APPDATA || '', 'Minecraft Bedrock', 'Users', 'Shared', 'games', 'com.mojang'),
    path.join(
      process.env.LOCALAPPDATA || '',
      'Packages',
      'Microsoft.MinecraftUWP_8wekyb3d8bbwe',
      'LocalState',
      'games',
      'com.mojang'
    )
  ];
  return candidates.find(p => p && fs.existsSync(p)) || candidates[0];
}

// ---------- manifest helpers ----------

// manifest.json may contain comments and a BOM
function parseJsonLoose(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inString) {
      out += c;
      if (c === '\\') out += text[++i];
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/^﻿/, '').replace(/,(\s*[}\]])/g, '$1'));
}

function versionString(v) {
  if (Array.isArray(v)) return v.join('.');
  return typeof v === 'string' ? v : '0.0.0';
}

function packKind(manifest) {
  const types = (manifest.modules || []).map(m => String(m.type || '').toLowerCase());
  if (types.includes('resources')) return 'resource';
  if (types.includes('skin_pack')) return 'skin';
  if (types.includes('world_template')) return 'world_template';
  return 'behavior';
}

function lookupLang(folder, key) {
  for (const file of ['en_US.lang', 'en_GB.lang']) {
    try {
      const text = fs.readFileSync(path.join(folder, 'texts', file), 'utf8');
      const line = text.split(/\r?\n/).find(l => l.startsWith(key + '='));
      if (line) return line.slice(key.length + 1).split('\t#')[0].trim();
    } catch {
      // try next file
    }
  }
  return null;
}

function readPackFolder(root, dirName, folderName) {
  const folder = path.join(root, dirName, folderName);
  try {
    const manifest = parseJsonLoose(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
    const header = manifest.header || {};
    let name = String(header.name || folderName).replace(/§./g, '').trim() || folderName;
    if (/^[\w.]+$/.test(name) && name.includes('.')) name = lookupLang(folder, name) || folderName;

    let icon = null;
    try {
      const iconPath = path.join(folder, 'pack_icon.png');
      if (fs.statSync(iconPath).size <= MAX_ICON_BYTES) {
        icon = 'data:image/png;base64,' + fs.readFileSync(iconPath).toString('base64');
      }
    } catch {
      // no icon
    }

    return {
      folder: folderName,
      dir: dirName,
      uuid: header.uuid,
      name,
      version: versionString(header.version),
      kind: packKind(manifest),
      authors: (manifest.metadata && manifest.metadata.authors) || [],
      dependencies: (manifest.dependencies || []).map(d => d.uuid).filter(Boolean),
      icon
    };
  } catch (err) {
    console.warn('skip pack', folderName, err.message);
    return null;
  }
}

function scanPacks(root) {
  const packs = [];
  for (const dirName of ['behavior_packs', 'resource_packs']) {
    let entries = [];
    try {
      entries = fs.readdirSync(path.join(root, dirName), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pack = readPackFolder(root, dirName, entry.name);
      if (pack && pack.uuid) packs.push(pack);
    }
  }
  return packs;
}

// ---------- install ----------

function safeName(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 80) || 'pack';
}

async function collectPacks(zip, prefix = '') {
  const found = [];
  const names = Object.keys(zip.files).filter(n => !n.startsWith('__MACOSX') && !zip.files[n].dir);

  for (const name of names) {
    if (/\.(mcpack|mcaddon|zip)$/i.test(name)) {
      const inner = await JSZip.loadAsync(await zip.files[name].async('nodebuffer'));
      found.push(...(await collectPacks(inner, prefix + name + '/')));
    }
  }

  for (const name of names) {
    if (path.posix.basename(name).toLowerCase() !== 'manifest.json') continue;
    const root = path.posix.dirname(name) === '.' ? '' : path.posix.dirname(name) + '/';
    try {
      const manifest = parseJsonLoose(await zip.files[name].async('string'));
      found.push({ zip, root, manifest });
    } catch (err) {
      console.warn('bad manifest in archive', prefix + name, err.message);
    }
  }

  // drop manifests nested inside another pack's folder (e.g. subpacks)
  return found.filter(a => !found.some(b => b !== a && b.zip === a.zip && b.root !== a.root && a.root.startsWith(b.root) && b.root !== ''));
}

async function extractPack({ zip, root }, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (!name.startsWith(root) || name.startsWith('__MACOSX')) continue;
    const relative = name.slice(root.length);
    if (!relative) continue;
    const target = path.resolve(destination, relative);
    if (!target.startsWith(path.resolve(destination) + path.sep)) continue; // zip-slip guard
    if (entry.dir) {
      fs.mkdirSync(target, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await entry.async('nodebuffer'));
    }
  }
}

// Extract to a temp folder first so the installed pack stays untouched if anything fails.
async function installBuffer(mojangPath, buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const packs = await collectPacks(zip);
  if (packs.length === 0) throw new Error('No pack (manifest.json) found in this file');

  const existing = scanPacks(mojangPath);
  const installed = [];
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bedrockpulse-'));

  try {
    for (let i = 0; i < packs.length; i++) {
      const pack = packs[i];
      const header = pack.manifest.header || {};
      const kind = packKind(pack.manifest);
      if (kind === 'world_template') continue;

      const dirName = kind === 'resource' ? 'resource_packs' : kind === 'skin' ? 'skin_packs' : 'behavior_packs';
      const current = existing.find(e => e.uuid === header.uuid);
      const folderName = current ? current.folder : safeName(header.name);
      const targetDir = path.join(mojangPath, current ? current.dir : dirName, folderName);

      const staging = path.join(tmpRoot, String(i));
      await extractPack(pack, staging);

      fs.rmSync(targetDir, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(targetDir), { recursive: true });
      fs.cpSync(staging, targetDir, { recursive: true });

      installed.push({ name: header.name, version: versionString(header.version), replaced: Boolean(current) });
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  if (installed.length === 0) throw new Error('Nothing installable in this file');
  return installed;
}

// ---------- IPC ----------

function registerIpc() {
  ipcMain.handle('state:get', () => readState());
  ipcMain.handle('state:set', (_e, patch) => {
    const next = { ...readState(), ...patch };
    writeState(next);
    return next;
  });

  ipcMain.handle('mc:default-path', () => defaultMojangPath());
  ipcMain.handle('mc:select-dir', async () => {
    const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return res.canceled ? null : res.filePaths[0];
  });
  ipcMain.handle('mc:scan', (_e, root) => scanPacks(root));

  ipcMain.handle('http:get', async (_e, { url, headers }) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...(headers || {}) },
        redirect: 'follow'
      });
      return { ok: res.ok, status: res.status, text: await res.text() };
    } catch (err) {
      return { ok: false, status: 0, text: '', error: err.message };
    }
  });

  ipcMain.handle('pack:install-url', async (_e, { mojangPath, url }) => {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
      if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
      const type = res.headers.get('content-type') || '';
      if (type.includes('text/html')) throw new Error('The link is a web page, not a pack file');
      const installed = await installBuffer(mojangPath, Buffer.from(await res.arrayBuffer()));
      return { ok: true, installed };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('pack:install-file', async (_e, { mojangPath }) => {
    try {
      const res = await dialog.showOpenDialog(mainWindow, {
        defaultPath: app.getPath('downloads'),
        properties: ['openFile'],
        filters: [{ name: 'Minecraft packs', extensions: ['mcaddon', 'mcpack', 'zip'] }]
      });
      if (res.canceled) return { ok: false, canceled: true };
      const installed = await installBuffer(mojangPath, fs.readFileSync(res.filePaths[0]));
      return { ok: true, installed };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('shell:open', (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
  });
  ipcMain.handle('shell:show-folder', (_e, folder) => shell.openPath(folder));
}

// ---------- window ----------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#313233',
    title: 'BedrockPulse',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
