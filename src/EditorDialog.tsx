import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function EditorDialog({ title, error, close, children }: {
  title: string; error?: string; close: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null), alert = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    element.querySelector<HTMLElement>('input:not([type=hidden]):not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled])')?.focus({ preventScroll: true });
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => { if (error) alert.current?.scrollIntoView({ block: 'nearest' }); }, [error]);
  return createPortal(<dialog ref={dialog} className="editor-dialog" aria-label={title} onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    event.stopPropagation();
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, summary, a[href], [tabindex]')]
      .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <button className="dialog-close" type="button" aria-label="Close editor" onClick={close}>×</button>
    <div className="dialog-content">
      {error && <div className="dialog-error"><div ref={alert} className="notice error" role="alert">{error}</div></div>}
      {children}
    </div>
  </dialog>, document.body);
}
