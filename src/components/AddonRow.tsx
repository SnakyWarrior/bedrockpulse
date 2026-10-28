import { Button, Container, Tag } from '@oreui-web/react';
import { SOURCE_LABEL, statusOf } from '../lib/addons';
import type { Addon, Link } from '../lib/types';

interface Props {
  addon: Addon;
  link?: Link;
  busy: boolean;
  onLink: () => void;
  onUpdate: () => void;
  onInstallFile: () => void;
}

export function AddonRow({ addon, link, busy, onLink, onUpdate, onInstallFile }: Props) {
  const status = statusOf(addon, link);

  const meta =
    status === 'error'
      ? link?.error
      : [`v${addon.version}`, addon.authors.length ? `by ${addon.authors.join(', ')}` : null]
          .filter(Boolean)
          .join('  ·  ');

  return (
    <Container variant="light" className="row">
      <div className="icon">{addon.icon ? <img src={addon.icon} alt="" /> : addon.name.charAt(0).toUpperCase()}</div>

      <div className="info">
        <div className="title">
          <strong title={addon.name}>{addon.name}</strong>
          {link && <Tag variant="secondary">{SOURCE_LABEL[link.kind]}</Tag>}
          {status === 'update' && (
            <Tag variant="primary">
              {link?.kind === 'mcpedl' ? 'New update' : `Update ${link?.latest}`}
            </Tag>
          )}
          {status === 'current' && <Tag variant="informative">Up to date</Tag>}
          {status === 'unlinked' && <Tag variant="neutral">No source</Tag>}
          {status === 'error' && <Tag variant="warning">Check failed</Tag>}
        </div>
        <div className={status === 'error' ? 'meta error' : 'meta'}>{meta}</div>
      </div>

      <div className="row-actions">
        {status === 'update' && (
          <>
            <Button color="secondary" disabled={busy} onClick={onInstallFile}>
              Install file
            </Button>
            <Button color="primary" loading={busy} onClick={onUpdate}>
              {link?.downloadUrl ? 'Update' : 'Get update'}
            </Button>
          </>
        )}
        {status !== 'update' && (
          <Button color="secondary" disabled={busy} onClick={onLink}>
            {status === 'unlinked' ? 'Add link' : 'Edit link'}
          </Button>
        )}
      </div>
    </Container>
  );
}
