import type { ReactNode } from 'react';
import { Container, Modal } from '@oreui-web/react';
import { OreIcon } from './OreIcon';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Ore UI modal: header with title + close button, dark content panel. */
export function AppModal({ open, title, onClose, children }: Props) {
  return (
    <Modal open={open} onModalClose={onClose}>
      <dialog className="ore-modal-dialog">
        <div className="ore-modal-header">
          <span />
          <h2 className="ore-modal-title">{title}</h2>
          <button type="button" className="ore-modal-header-button ore-modal-close" aria-label="Close">
            <OreIcon name="cross" />
          </button>
        </div>
        <div className="ore-modal-content">
          <Container variant="dark" className="modal-body">
            {children}
          </Container>
        </div>
      </dialog>
    </Modal>
  );
}
