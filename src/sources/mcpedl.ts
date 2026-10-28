import { api } from '../lib/api';
import type { ResolvedSource } from '../lib/types';

/**
 * MCPEDL shows no addon version, only when the page was last updated.
 * That date is used as the version marker.
 */
export async function resolveMcpedl(url: string): Promise<ResolvedSource> {
  const res = await api.httpGet({ url });
  if (!res.ok) throw new Error(`MCPEDL page could not be opened (HTTP ${res.status})`);

  const updated = res.text.match(/Updated\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/)?.[1];
  if (!updated) throw new Error('Could not find the update date on this MCPEDL page');

  const name = res.text.match(/<title>([^<|]+)/i)?.[1]?.trim();
  return { latest: updated, pageUrl: url, name };
}
