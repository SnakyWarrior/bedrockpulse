import { api } from '../lib/api';
import type { Addon, ResolvedSource } from '../lib/types';
import { getFinder } from './finder';

export const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Page to open for a Marketplace item. A local finder plugin may point somewhere else. */
export const marketplacePage = (uuid: string) =>
  getFinder()?.pageUrl?.(uuid.toLowerCase()) ?? `https://www.mcmarketplace.net/?id=${uuid.toLowerCase()}`;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const PACK_SUFFIX_RE = /\b(bp|rp|behou?r pack|resource pack|behou?r|resources?)\b/gi;

/** Name without BP/RP suffixes and punctuation, for comparing an installed addon with a listing. */
export const normalizeName = (name: string) =>
  name.replace(PACK_SUFFIX_RE, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Latest version of a Marketplace item: name + creator from mcmarketplace.net, version from bedrockexplorer.com. */
export async function resolveMarketplace(uuid: string): Promise<ResolvedSource> {
  const page = await api.httpGet({ url: `https://www.mcmarketplace.net/?id=${uuid}` });
  const title = page.text.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '';
  const m = title.match(/^(.*?)\s+by\s+(.*?)\s+on the Minecraft Marketplace/i);
  if (!m) throw new Error('Item not found on the Minecraft Marketplace');
  const [, name, creator] = m.map(s => s.trim());

  const explorer = await api.httpGet({ url: `https://bedrockexplorer.com/@${slug(creator)}/${slug(name)}` });
  const version = explorer.text.match(/version is\s*([0-9][0-9.]*)/i)?.[1];
  if (!version) throw new Error(`Could not read the version of "${name}"`);

  return { latest: version, pageUrl: marketplacePage(uuid), name };
}

export interface MarketplaceMatch {
  addon: Addon;
  uuid: string;
  name: string;
  creator: string;
  thumbnail?: string;
  creatorMatches: boolean;
}
