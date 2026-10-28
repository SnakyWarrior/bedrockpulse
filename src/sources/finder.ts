import type { Addon } from '../lib/types';
import type { MarketplaceMatch } from './marketplace';

/**
 * Optional plugin that can find an installed addon on the Marketplace by name.
 * Nothing is registered by default; a local file in `src/sources/private/` may call `registerFinder`.
 */
export interface SourceFinder {
  find(addon: Addon): Promise<MarketplaceMatch | null>;
  /** Page to open for a Marketplace item id */
  pageUrl?(uuid: string): string;
}

let finder: SourceFinder | null = null;

export const registerFinder = (next: SourceFinder) => {
  finder = next;
};

export const getFinder = () => finder;
