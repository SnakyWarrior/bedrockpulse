import type { Addon, Link, Pack } from './types';

/** Compare dotted versions ("1.2.10" > "1.2.9"). Returns >0 when a is newer than b. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => (v.match(/\d+/g) || ['0']).map(Number);
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Join packs that depend on each other (behavior + resource pack) into one addon. */
export function groupPacks(packs: Pack[]): Addon[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const known = new Set(packs.map(p => p.uuid));
  for (const p of packs) parent.set(p.uuid, p.uuid);
  for (const p of packs) {
    for (const dep of p.dependencies) {
      if (known.has(dep)) parent.set(find(dep), find(p.uuid));
    }
  }

  const groups = new Map<string, Pack[]>();
  for (const p of packs) {
    const root = find(p.uuid);
    groups.set(root, [...(groups.get(root) ?? []), p]);
  }

  return [...groups.values()]
    .map(group => {
      const main = group.find(p => p.kind === 'behavior') ?? group[0];
      return {
        id: main.uuid,
        name: main.name,
        version: main.version,
        icon: group.find(p => p.icon)?.icon ?? null,
        authors: [...new Set(group.flatMap(p => p.authors))],
        packs: group
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type AddonStatus = 'unlinked' | 'current' | 'update' | 'error';

export function statusOf(addon: Addon, link: Link | undefined): AddonStatus {
  if (!link) return 'unlinked';
  if (link.error) return 'error';
  if (!link.latest) return 'current';
  if (link.kind === 'mcpedl') {
    return link.baseline && link.latest !== link.baseline ? 'update' : 'current';
  }
  return compareVersions(link.latest, addon.version) > 0 ? 'update' : 'current';
}

export const SOURCE_LABEL: Record<Link['kind'], string> = {
  marketplace: 'Marketplace',
  curseforge: 'CurseForge',
  mcpedl: 'MCPEDL'
};
