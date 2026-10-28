import { useState } from 'react';
import { Button, Container, ProgressBar, Scrollbar, Spinner, TabBar, TabButton, Toast } from '@oreui-web/react';
import { statusOf } from './lib/addons';
import { isDesktop } from './lib/api';
import { useManager } from './lib/useManager';
import { getFinder } from './sources';
import type { Addon } from './lib/types';
import { AddonRow } from './components/AddonRow';
import { LinkModal } from './components/LinkModal';
import { MatchModal } from './components/MatchModal';
import { SettingsModal } from './components/SettingsModal';

type Filter = 'all' | 'updates' | 'unlinked';

export function App() {
  const m = useManager();
  const [filter, setFilter] = useState<Filter>('all');
  const [linking, setLinking] = useState<Addon | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const unlinkedCount = m.addons.filter(a => !m.links[a.id]).length;
  const visible = m.addons.filter(a => {
    const status = statusOf(a, m.links[a.id]);
    if (filter === 'updates') return status === 'update';
    if (filter === 'unlinked') return status === 'unlinked';
    return true;
  });

  return (
    <div className="app">
      <Container variant="dark" className="topbar">
        <div className="brand">
          <h1>BedrockPulse</h1>
          <span>{m.addons.length} addons</span>
        </div>
        <div className="actions">
          {getFinder() && (
            <Button color="secondary" disabled={m.matching !== null} onClick={m.findSources}>
              Find sources
            </Button>
          )}
          <Button color="secondary" onClick={m.refresh}>
            Rescan
          </Button>
          <Button color="secondary" onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
          <Button color="primary" loading={m.checking} onClick={() => m.checkAll()}>
            Check for updates
          </Button>
        </div>
      </Container>

      <div className="page">
        <div className="tabs">
          <TabBar>
            <TabButton selected={filter === 'all'} onClick={() => setFilter('all')}>
              All ({m.addons.length})
            </TabButton>
            <TabButton selected={filter === 'updates'} onClick={() => setFilter('updates')}>
              Updates ({m.updatesCount})
            </TabButton>
            <TabButton selected={filter === 'unlinked'} onClick={() => setFilter('unlinked')}>
              No source ({unlinkedCount})
            </TabButton>
          </TabBar>
          {!isDesktop && <span className="meta">Preview mode: sample data</span>}
        </div>

        {m.matching && (
          <div className="progress">
            <ProgressBar
              label={`Searching the Marketplace ${m.matching.done}/${m.matching.total}`}
              value={m.matching.done}
              max={m.matching.total}
              variant="labeled"
            />
          </div>
        )}

        <Scrollbar className="list">
          {m.loading ? (
            <div className="empty">
              <Spinner />
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <h2>{m.addons.length === 0 ? 'No addons found' : 'Nothing here'}</h2>
              {m.addons.length === 0
                ? `Looked in ${m.settings.mojangPath}. Change the folder in Settings if Minecraft is installed elsewhere.`
                : filter === 'updates'
                  ? 'Every linked addon is up to date.'
                  : 'All addons have a source.'}
            </div>
          ) : (
            visible.map(addon => (
              <AddonRow
                key={addon.id}
                addon={addon}
                link={m.links[addon.id]}
                busy={m.busy.has(addon.id)}
                onLink={() => setLinking(addon)}
                onUpdate={() => m.update(addon)}
                onInstallFile={() => m.installFile(addon)}
              />
            ))
          )}
        </Scrollbar>
      </div>

      <LinkModal
        addon={linking}
        link={linking ? m.links[linking.id] : undefined}
        onClose={() => setLinking(null)}
        onSave={m.link}
        onRemove={m.unlink}
      />
      <MatchModal matches={m.matches} onClose={m.dismissMatches} onApply={m.applyMatches} />
      <SettingsModal
        open={settingsOpen}
        settings={m.settings}
        onClose={() => setSettingsOpen(false)}
        onSave={m.saveSettings}
      />

      {m.notice && (
        <Toast key={m.notice.id} open duration={4000} position="bottom-center" variant={m.notice.variant}>
          {m.notice.text}
        </Toast>
      )}
    </div>
  );
}
