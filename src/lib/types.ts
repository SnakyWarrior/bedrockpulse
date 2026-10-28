export interface Pack {
  folder: string;
  dir: 'behavior_packs' | 'resource_packs';
  uuid: string;
  name: string;
  version: string;
  kind: 'behavior' | 'resource' | 'skin' | 'world_template';
  authors: string[];
  dependencies: string[];
  icon: string | null;
}

/** A behavior pack and its resource pack, shown as one addon. */
export interface Addon {
  id: string;
  name: string;
  version: string;
  icon: string | null;
  authors: string[];
  packs: Pack[];
}

export type LinkKind = 'marketplace' | 'curseforge' | 'mcpedl';

export interface Link {
  kind: LinkKind;
  /** Marketplace UUID, CurseForge project id, or MCPEDL page URL */
  ref: string;
  pageUrl: string;
  /** Latest version, or the "Updated" date for MCPEDL */
  latest?: string;
  downloadUrl?: string;
  /** MCPEDL only: the "Updated" marker when the user last had the addon up to date */
  baseline?: string;
  checkedAt?: number;
  error?: string;
}

export interface Settings {
  mojangPath: string;
  curseForgeKey: string;
  autoCheck: boolean;
}

export interface InstallResult {
  ok: boolean;
  canceled?: boolean;
  error?: string;
  installed?: Array<{ name: string; version: string; replaced: boolean }>;
}

export interface ResolvedSource {
  latest: string;
  pageUrl: string;
  downloadUrl?: string;
  name?: string;
}
