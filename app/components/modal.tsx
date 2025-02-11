import React, { type MouseEvent } from 'react';
import './modal.css';

interface ModalProps extends React.PropsWithChildren{
  onSubmit: (msg: string) => void;
  onCancel: (msg: string) => void;
  closeModal: (msg: string) => void;
}

const Modal: React.FC<ModalProps> = ({ onSubmit, onCancel, closeModal, children }) => {
  const handleContainerClick = (e: MouseEvent<HTMLDivElement>) => {
    // Make sure you cast e.target to HTML element to check className
    if ((e.target as HTMLElement).className === 'modal-container') {
      closeModal('Modal was closed');
    }
  };

  return (
    <div className="modal-container" onClick={handleContainerClick}>
      <div className="modal">
        <div
          className="modal-header"
          onClick={() => closeModal('Modal was closed')}
        >
          <p className="close">&times;</p>
        </div>
        <div className="modal-content">{children}</div>
        <div className="modal-footer">
          <button
            type="submit"
            onClick={() => onSubmit('Submit button was clicked')}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => onCancel('Cancel button was clicked')}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
