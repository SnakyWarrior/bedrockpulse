import { useEffect, useState } from 'react';
import { Button, Switch, Textfield } from '@oreui-web/react';
import { AppModal } from './AppModal';
import { api } from '../lib/api';
import type { Settings } from '../lib/types';

interface Props {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (settings: Settings) => Promise<void>;
}

export function SettingsModal({ open, settings, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const browse = async () => {
    const dir = await api.selectDirectory();
    if (dir) setDraft(d => ({ ...d, mojangPath: dir }));
  };

  return (
    <AppModal open={open} title="Settings" onClose={onClose}>
      <>
        <div className="path-row">
          <Textfield
            label="Minecraft folder (com.mojang)"
            value={draft.mojangPath}
            onInput={(e: Event) => setDraft({ ...draft, mojangPath: (e.target as HTMLInputElement).value })}
          />
          <Button color="secondary" onClick={browse}>
            Browse
          </Button>
        </div>

        <Textfield
          label="CurseForge API key"
          description="Needed to check CurseForge addons. Get one at console.curseforge.com."
          type="password"
          value={draft.curseForgeKey}
          onInput={(e: Event) => setDraft({ ...draft, curseForgeKey: (e.target as HTMLInputElement).value.trim() })}
        />

        <div className="switch-row">
          <span>Check for updates when the app starts</span>
          <Switch
            checked={draft.autoCheck}
            onChange={(e: Event) => setDraft({ ...draft, autoCheck: (e.target as HTMLInputElement).checked })}
          />
        </div>

        <div className="modal-actions">
          <Button color="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            onClick={async () => {
              await onSave(draft);
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </>
    </AppModal>
  );
}
