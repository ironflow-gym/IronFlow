import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const dialogButton = 'min-h-11 rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400';
export const dialogPrimaryButton = 'min-h-11 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300';
export const dialogField = 'aria-[invalid=true]:border-rose-400 mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-slate-600 bg-slate-800 p-3 text-base text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400';

let openDialogs = 0;
let previousOverflow = '';

/** Native modal dialogs provide top-layer isolation, focus trapping and Escape. */
export default function Modal({ label, title, closeLabel, onClose, children, footer, suspended = false, wide = false, closeDisabled = false }: {
  label: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  suspended?: boolean;
  wide?: boolean;
  closeDisabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openDialogs++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    element.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      if (--openDialogs === 0) document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(<dialog ref={dialog} aria-label={label} aria-modal={suspended ? undefined : true} aria-labelledby={label === title ? titleId : undefined}
    onKeyDown={event => {
      if (suspended || event.key !== 'Tab') return;
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')]
        .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); heading.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!suspended && !closeDisabled) onClose(); }}
    className={`m-auto w-[calc(100%_-_1.5rem)] ${wide ? 'max-w-3xl' : 'max-w-2xl'} max-h-[calc(100dvh_-_2rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/85 open:flex flex-col`}>
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 p-4 sm:px-6">
      <h2 ref={heading} id={titleId} tabIndex={-1} className="min-w-0 break-words text-xl font-bold outline-none">{title}</h2>
      <button type="button" aria-label={closeLabel} disabled={closeDisabled} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-40 text-slate-300 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-400"><X size={22} /></button>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
    {footer && <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-700 bg-slate-900 p-4 sm:px-6">{footer}</footer>}
  </dialog>, document.body);
}
