import React, { useState } from 'react';
import Modal, { dialogButton, dialogPrimaryButton } from './Modal';
/** Confirm only actual form loss; successful submit calls the owner's close directly. */
export default function FoodFormModal({ dirty, onClose, suspended, ...props }: React.ComponentProps<typeof Modal> & { dirty: boolean }) {
  const [asking, setAsking] = useState(false);
  return <><Modal {...props} onClose={() => dirty ? setAsking(true) : onClose()} suspended={suspended || asking} />
    {asking && <Modal label="Discard food changes" title="Discard changes?" closeLabel="Keep editing" onClose={() => setAsking(false)} footer={<><button className={dialogButton} onClick={() => setAsking(false)}>Keep editing</button><button className={`${dialogPrimaryButton} bg-rose-500 hover:bg-rose-400`} onClick={() => { setAsking(false); requestAnimationFrame(onClose); }}>Discard changes</button></>}><p>Your unsaved food changes will be discarded.</p></Modal>}
  </>;
}
