import { api } from '../lib/api';
import type { ResolvedSource } from '../lib/types';

const BASE = 'https://api.curseforge.com/v1';
const BEDROCK_GAME_ID = 78022;
const ADDONS_CLASS_ID = 4984;

async function get(path: string, key: string): Promise<any> {
  if (!key) throw new Error('Add your CurseForge API key in Settings');
  const res = await api.httpGet({ url: BASE + path, headers: { 'x-api-key': key, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CurseForge refused the request (HTTP ${res.status})`);
  return JSON.parse(res.text);
}

function fromMod(mod: any): ResolvedSource {
  const files: any[] = [...(mod.latestFiles ?? [])].sort(
    (a, b) => new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime()
  );
  const file = files[0];
  const label: string = file?.displayName || file?.fileName || '';
  return {
    latest: label.match(/\d+(?:\.\d+)+/)?.[0] ?? label,
    pageUrl: mod.links?.websiteUrl ?? '',
    downloadUrl: file?.downloadUrl ?? undefined,
    name: mod.name
  };
}

/** `ref` is a numeric project id, or a project URL / slug. Search by slug may not be allowed for every API key. */
export async function resolveCurseForge(ref: string, key: string): Promise<ResolvedSource> {
  if (/^\d+$/.test(ref)) {
    return fromMod((await get(`/mods/${ref}`, key)).data);
  }

  const slug = ref.replace(/[?#].*$/, '').split('/').filter(Boolean).filter(p => !/^(files|download|\d+)$/i.test(p)).pop();
  if (!slug) throw new Error('Could not read the CurseForge link');

  try {
    const found = (await get(`/mods/search?gameId=${BEDROCK_GAME_ID}&classId=${ADDONS_CLASS_ID}&slug=${encodeURIComponent(slug)}`, key)).data;
    const mod = found.find((m: any) => m.slug === slug) ?? found[0];
    if (mod) return fromMod(mod);
  } catch {
    throw new Error('CurseForge search is not allowed for this key. Paste the numeric Project ID instead.');
  }
  throw new Error(`"${slug}" was not found on CurseForge`);
}
