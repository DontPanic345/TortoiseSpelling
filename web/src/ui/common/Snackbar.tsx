import { useCallback, useEffect, useRef, useState } from "preact/hooks";

export interface SnackbarMessage {
  text: string;
  action?: { label: string; onClick: () => void };
}

const SNACKBAR_MILLIS = 4000;

/** One message at a time, cleared after four seconds. */
export function useSnackbar() {
  const [current, setCurrent] = useState<SnackbarMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setCurrent(null);
  }, []);

  const show = useCallback((text: string, action?: SnackbarMessage["action"]) => {
    clearTimeout(timer.current);
    setCurrent({ text, action });
    timer.current = setTimeout(() => setCurrent(null), SNACKBAR_MILLIS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { current, show, dismiss };
}

export function Snackbar({ message }: { message: SnackbarMessage | null }) {
  return (
    <div class="snackbar-host" role="status">
      {message && (
        <div class="snackbar">
          <span>{message.text}</span>
          {message.action && (
            <button type="button" class="text-button" onClick={message.action.onClick}>
              {message.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
