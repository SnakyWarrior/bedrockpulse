import type { Link, LinkKind, ResolvedSource, Settings } from '../lib/types';
import { resolveCurseForge } from './curseforge';
import { UUID_RE, marketplacePage, resolveMarketplace } from './marketplace';
import { resolveMcpedl } from './mcpedl';

export { getFinder } from './finder';
export type { MarketplaceMatch } from './marketplace';

// Optional local plugins (git-ignored folder); loads nothing when the folder is empty
import.meta.glob('./private/*.ts', { eager: true });

/** Work out which site a pasted link (or id) belongs to. */
export function parseInput(input: string): { kind: LinkKind; ref: string } | null {
  const text = input.trim();
  if (!text) return null;

  const uuid = text.match(UUID_RE)?.[0];
  if (uuid && /^(https?:\/\/|[0-9a-f-]{36}$)/i.test(text)) {
    return { kind: 'marketplace', ref: uuid.toLowerCase() };
  }
  if (/curseforge\.com/i.test(text)) return { kind: 'curseforge', ref: text };
  if (/^\d+$/.test(text)) return { kind: 'curseforge', ref: text };
  if (/mcpedl\.com/i.test(text)) return { kind: 'mcpedl', ref: text.split(/[?#]/)[0] };
  return null;
}

export async function resolveSource(kind: LinkKind, ref: string, settings: Settings): Promise<ResolvedSource> {
  switch (kind) {
    case 'marketplace':
      return resolveMarketplace(ref);
    case 'curseforge':
      return resolveCurseForge(ref, settings.curseForgeKey);
    case 'mcpedl':
      return resolveMcpedl(ref);
  }
}

/** Build a fresh link; `keepBaseline` stops MCPEDL from forgetting that an update is pending. */
export async function buildLink(
  kind: LinkKind,
  ref: string,
  settings: Settings,
  previous?: Link
): Promise<Link> {
  const source = await resolveSource(kind, ref, settings);
  return {
    kind,
    ref,
    pageUrl: kind === 'marketplace' ? marketplacePage(ref) : source.pageUrl,
    latest: source.latest,
    downloadUrl: source.downloadUrl,
    baseline: kind === 'mcpedl' ? previous?.baseline ?? source.latest : undefined,
    checkedAt: Date.now()
  };
}
