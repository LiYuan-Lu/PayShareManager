import React, { type MouseEvent } from 'react';
import { Form } from "react-router";
import './modal.css';

interface ModalProps extends React.PropsWithChildren{
  onSubmit: (msg: string) => void;
  onCancel: (msg: string) => void;
  closeModal: (msg: string) => void;
  postTarget: string;
}

const Modal: React.FC<ModalProps> = ({ onSubmit, onCancel, closeModal, postTarget, children }) => {
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
        <Form method="post" action={postTarget}>
        <div className="modal-content">{children}</div>
        <div className="modal-footer">
          <button
            type="submit"
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
        </Form>
      </div>
    </div>
  );
};

export default Modal;
