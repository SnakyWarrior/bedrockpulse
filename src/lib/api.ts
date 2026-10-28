import type { InstallResult, Pack, Settings, Link } from './types';

interface PersistedState {
  settings?: Settings;
  links?: Record<string, Link>;
}

interface Bridge {
  getState(): Promise<PersistedState>;
  setState(patch: PersistedState): Promise<PersistedState>;
  defaultPath(): Promise<string>;
  selectDirectory(): Promise<string | null>;
  scan(root: string): Promise<Pack[]>;
  httpGet(req: { url: string; headers?: Record<string, string> }): Promise<{ ok: boolean; status: number; text: string; error?: string }>;
  installFromUrl(req: { mojangPath: string; url: string }): Promise<InstallResult>;
  installFromFile(req: { mojangPath: string }): Promise<InstallResult>;
  openExternal(url: string): Promise<void>;
  showFolder(folder: string): Promise<void>;
}

declare global {
  interface Window {
    bedrockpulse?: Bridge;
  }
}

// Used when the page is opened in a plain browser (no Electron), so the UI can still be previewed.
const demoPacks: Pack[] = [
  { folder: 'bb_bp', dir: 'behavior_packs', uuid: 'a1', name: 'BUILDING BLOCKS Add-On', version: '1.0.3', kind: 'behavior', authors: ['Lothiredon'], dependencies: ['a2'], icon: null },
  { folder: 'bb_rp', dir: 'resource_packs', uuid: 'a2', name: 'BUILDING BLOCKS Add-On', version: '1.0.3', kind: 'resource', authors: ['Lothiredon'], dependencies: [], icon: null },
  { folder: 'dm_bp', dir: 'behavior_packs', uuid: 'b1', name: 'Dragon Mounts', version: '2.1.0', kind: 'behavior', authors: [], dependencies: [], icon: null },
  { folder: 'si_bp', dir: 'behavior_packs', uuid: 'c1', name: 'Sky Islands Add-On', version: '1.4.0', kind: 'behavior', authors: ['Verart'], dependencies: [], icon: null }
];

let demoState: PersistedState = {};

const demoBridge: Bridge = {
  getState: async () => demoState,
  setState: async patch => (demoState = { ...demoState, ...patch }),
  defaultPath: async () => 'C:\\Users\\you\\AppData\\Roaming\\Minecraft Bedrock\\Users\\Shared\\games\\com.mojang',
  selectDirectory: async () => null,
  scan: async () => demoPacks,
  httpGet: async ({ url, headers }) => {
    try {
      const res = await fetch(url, { headers });
      return { ok: res.ok, status: res.status, text: await res.text() };
    } catch (err) {
      return { ok: false, status: 0, text: '', error: String(err) };
    }
  },
  installFromUrl: async () => ({ ok: false, error: 'Preview mode' }),
  installFromFile: async () => ({ ok: false, error: 'Preview mode' }),
  openExternal: async url => void window.open(url, '_blank'),
  showFolder: async () => undefined
};

export const api: Bridge = window.bedrockpulse ?? demoBridge;
export const isDesktop = Boolean(window.bedrockpulse);
