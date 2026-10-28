import { useEffect, useState } from 'react';
import { Button, Checkbox, Container, Tag } from '@oreui-web/react';
import { AppModal } from './AppModal';
import type { MarketplaceMatch } from '../sources';

interface Props {
  matches: MarketplaceMatch[] | null;
  onClose: () => void;
  onApply: (chosen: MarketplaceMatch[]) => void;
}

export function MatchModal({ matches, onClose, onApply }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    setChecked(new Set((matches ?? []).filter(m => m.creatorMatches).map(m => m.addon.id)));
  }, [matches]);

  const toggle = (id: string) =>
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <AppModal open={matches !== null} title="Marketplace matches" onClose={onClose}>
      <>
        {matches && matches.length === 0 ? (
          <p>No addon matched a Marketplace item by exact name. Use "Add link" on an addon to paste its page.</p>
        ) : (
          <>
            <p>These installed addons have the same name as a Marketplace item. Pick the ones to link.</p>
            {matches?.map(m => (
              <Container key={m.addon.id} variant="light" className="match" onClick={() => toggle(m.addon.id)}>
                <Checkbox checked={checked.has(m.addon.id)} />
                <div className="icon">
                  {m.thumbnail ? <img src={m.thumbnail} alt="" /> : m.name.charAt(0)}
                </div>
                <div className="info">
                  <div className="title">
                    <strong>{m.addon.name}</strong>
                    {!m.creatorMatches && <Tag variant="warning">Creator not verified</Tag>}
                  </div>
                  <div className="meta">
                    {m.name} by {m.creator}
                  </div>
                </div>
              </Container>
            ))}
          </>
        )}
        <div className="modal-actions">
          <Button color="secondary" onClick={onClose}>
            Close
          </Button>
          {matches && matches.length > 0 && (
            <Button
              color="primary"
              disabled={checked.size === 0}
              onClick={() => onApply(matches.filter(m => checked.has(m.addon.id)))}
            >
              Link {checked.size} selected
            </Button>
          )}
        </div>
      </>
    </AppModal>
  );
}
