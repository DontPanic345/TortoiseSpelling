import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef } from "preact/hooks";

interface DialogProps {
  title: string;
  onDismiss: () => void;
  children: ComponentChildren;
  /** The buttons along the bottom. */
  actions?: ComponentChildren;
}

/** A modal `<dialog>`, open while mounted. Escape and a click on the backdrop dismiss it, as on Android. */
export function Dialog({ title, onDismiss, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    // The browser fires `cancel` for Escape. Closing is left to the owner, who unmounts the dialog.
    const onCancel = (event: Event) => {
      event.preventDefault();
      dismiss.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, []);

  return (
    <dialog
      ref={ref}
      class="dialog"
      aria-labelledby={titleId}
      // The content sits in a padded child, so only the backdrop is the dialog itself.
      onClick={(event) => {
        if (event.target === ref.current) dismiss.current();
      }}
    >
      <div class="dialog-content">
        <h2 id={titleId} class="dialog-title">
          {title}
        </h2>
        {children}
        {actions && <div class="dialog-actions">{actions}</div>}
      </div>
    </dialog>
  );
}
