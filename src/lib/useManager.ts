import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { groupPacks, statusOf } from './addons';
import type { Addon, Link, Settings } from './types';
import { buildLink, getFinder, parseInput } from '../sources';
import type { MarketplaceMatch } from '../sources';
import { marketplacePage } from '../sources/marketplace';

export interface Notice {
  id: number;
  text: string;
  variant: 'primary' | 'warning' | 'informative';
}

const DEFAULT_SETTINGS: Settings = { mojangPath: '', curseForgeKey: '', autoCheck: true };

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function useManager() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [links, setLinks] = useState<Record<string, Link>>({});
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<MarketplaceMatch[] | null>(null);
  const [matching, setMatching] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const settingsRef = useRef(settings);
  const linksRef = useRef(links);
  settingsRef.current = settings;
  linksRef.current = links;

  const say = useCallback((text: string, variant: Notice['variant'] = 'primary') => {
    setNotice({ id: Date.now(), text, variant });
  }, []);

  const saveLinks = useCallback(async (next: Record<string, Link>) => {
    linksRef.current = next;
    setLinks(next);
    await api.setState({ links: next });
  }, []);

  const scan = useCallback(async (mojangPath: string) => {
    const packs = await api.scan(mojangPath);
    setAddons(groupPacks(packs));
  }, []);

  const withBusy = useCallback(async <T,>(id: string, work: () => Promise<T>): Promise<T> => {
    setBusy(prev => new Set(prev).add(id));
    try {
      return await work();
    } finally {
      setBusy(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  /** Re-read every linked source. Failures are kept on the link so the card can show them. */
  const checkAll = useCallback(
    async (silent = false) => {
      const entries = Object.entries(linksRef.current);
      if (entries.length === 0) {
        if (!silent) say('Nothing to check yet. Link your addons first.', 'informative');
        return;
      }
      setChecking(true);
      const next = { ...linksRef.current };
      await Promise.all(
        entries.map(async ([id, link]) => {
          try {
            next[id] = await buildLink(link.kind, link.ref, settingsRef.current, link);
          } catch (err) {
            next[id] = { ...link, error: message(err), checkedAt: Date.now() };
          }
        })
      );
      await saveLinks(next);
      setChecking(false);
      if (!silent) say('Update check finished');
    },
    [saveLinks, say]
  );

  // first load
  useEffect(() => {
    (async () => {
      const state = await api.getState();
      const loaded: Settings = { ...DEFAULT_SETTINGS, ...state.settings };
      if (!loaded.mojangPath) loaded.mojangPath = await api.defaultPath();
      setSettings(loaded);
      settingsRef.current = loaded;
      const storedLinks = state.links ?? {};
      setLinks(storedLinks);
      linksRef.current = storedLinks;
      await scan(loaded.mojangPath);
      setLoading(false);
      if (loaded.autoCheck) checkAll(true);
    })();
  }, [scan, checkAll]);

  const saveSettings = useCallback(
    async (next: Settings) => {
      setSettings(next);
      settingsRef.current = next;
      await api.setState({ settings: next });
      await scan(next.mojangPath);
      say('Settings saved');
    },
    [scan, say]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    await scan(settingsRef.current.mojangPath);
    setLoading(false);
  }, [scan]);

  /** Link an addon to a pasted URL / id. Returns an error text, or null on success. */
  const link = useCallback(
    async (addon: Addon, input: string): Promise<string | null> => {
      const parsed = parseInput(input);
      if (!parsed) return 'This is not a CurseForge, MCPEDL or Marketplace link';
      try {
        const built = await withBusy(addon.id, () =>
          buildLink(parsed.kind, parsed.ref, settingsRef.current)
        );
        await saveLinks({ ...linksRef.current, [addon.id]: built });
        return null;
      } catch (err) {
        return message(err);
      }
    },
    [saveLinks, withBusy]
  );

  const unlink = useCallback(
    async (addon: Addon) => {
      const next = { ...linksRef.current };
      delete next[addon.id];
      await saveLinks(next);
    },
    [saveLinks]
  );

  /** Look for exact Marketplace matches among addons that have no link yet. */
  const findSources = useCallback(async () => {
    const finder = getFinder();
    if (!finder) return;
    const todo = addons.filter(a => !linksRef.current[a.id]);
    if (todo.length === 0) {
      say('Every addon already has a source', 'informative');
      return;
    }
    const found: MarketplaceMatch[] = [];
    setMatching({ done: 0, total: todo.length });
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < todo.length) {
        const addon = todo[next++];
        try {
          const match = await finder.find(addon);
          if (match) found.push(match);
        } catch {
          // one failed search should not stop the rest
        }
        setMatching({ done: ++done, total: todo.length });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setMatching(null);
    setMatches(found);
  }, [addons, say]);

  const applyMatches = useCallback(
    async (chosen: MarketplaceMatch[]) => {
      setMatches(null);
      let linked = 0;
      for (const match of chosen) {
        const error = await link(match.addon, marketplacePage(match.uuid));
        if (!error) linked++;
      }
      say(`Linked ${linked} addon${linked === 1 ? '' : 's'}`);
    },
    [link, say]
  );

  /** Install the newest version: straight from CurseForge when allowed, otherwise via the website. */
  const update = useCallback(
    async (addon: Addon) => {
      const current = linksRef.current[addon.id];
      if (!current) return;

      if (current.downloadUrl) {
        const result = await withBusy(addon.id, () =>
          api.installFromUrl({ mojangPath: settingsRef.current.mojangPath, url: current.downloadUrl! })
        );
        if (!result.ok) {
          say(result.error ?? 'Update failed', 'warning');
          return;
        }
        say(`${addon.name} updated`);
        await scan(settingsRef.current.mojangPath);
        await checkAll(true);
        return;
      }

      await api.openExternal(current.pageUrl);
      say('Download the file from the page, then press "Install file"', 'informative');
    },
    [checkAll, say, scan, withBusy]
  );

  /** Install a pack file the user downloaded (.mcaddon / .mcpack) over this addon. */
  const installFile = useCallback(
    async (addon: Addon) => {
      const result = await withBusy(addon.id, () => api.installFromFile({ mojangPath: settingsRef.current.mojangPath }));
      if (result.canceled) return;
      if (!result.ok) {
        say(result.error ?? 'Install failed', 'warning');
        return;
      }
      const current = linksRef.current[addon.id];
      if (current?.kind === 'mcpedl' && current.latest) {
        await saveLinks({ ...linksRef.current, [addon.id]: { ...current, baseline: current.latest } });
      }
      say(`${addon.name} installed`);
      await scan(settingsRef.current.mojangPath);
      await checkAll(true);
    },
    [checkAll, say, saveLinks, scan, withBusy]
  );

  const updatesCount = addons.filter(a => statusOf(a, links[a.id]) === 'update').length;

  return {
    settings,
    links,
    addons,
    loading,
    checking,
    busy,
    matches,
    matching,
    notice,
    updatesCount,
    saveSettings,
    refresh,
    checkAll,
    link,
    unlink,
    findSources,
    applyMatches,
    dismissMatches: () => setMatches(null),
    update,
    installFile
  };
}
