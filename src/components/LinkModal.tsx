import { useEffect, useState } from 'react';
import { Button, Textfield } from '@oreui-web/react';
import { AppModal } from './AppModal';
import type { Addon, Link } from '../lib/types';

interface Props {
  addon: Addon | null;
  link?: Link;
  onClose: () => void;
  onSave: (addon: Addon, input: string) => Promise<string | null>;
  onRemove: (addon: Addon) => Promise<void>;
}

export function LinkModal({ addon, link, onClose, onSave, onRemove }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(link?.ref.startsWith('http') ? link.ref : link?.pageUrl ?? '');
    setError(null);
  }, [addon, link]);

  const save = async () => {
    if (!addon) return;
    setSaving(true);
    const result = await onSave(addon, value);
    setSaving(false);
    if (result) setError(result);
    else onClose();
  };

  return (
    <AppModal open={Boolean(addon)} title={addon?.name ?? ''} onClose={onClose}>
      <>
        <p>
          Paste the addon&apos;s page from CurseForge, MCPEDL or the Minecraft Marketplace (a page link or its
          id). For CurseForge you can also paste the numeric Project ID.
        </p>
        <Textfield
          label="Link"
          placeholder="https://..."
          value={value}
          onInput={(e: Event) => setValue((e.target as HTMLInputElement).value)}
        />
        {error && <div className="field-error">{error}</div>}
        <div className="modal-actions">
          {link && (
            <Button
              color="destructive"
              onClick={async () => {
                if (addon) await onRemove(addon);
                onClose();
              }}
            >
              Remove link
            </Button>
          )}
          <Button color="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button color="primary" loading={saving} disabled={!value.trim()} onClick={save}>
            Save
          </Button>
        </div>
      </>
    </AppModal>
  );
}
