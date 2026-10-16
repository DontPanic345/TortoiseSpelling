import { BackIcon } from "./icons";

/** The up affordance every screen below Home carries in its top bar. */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" class="icon-button" aria-label="Back" onClick={onClick}>
      <BackIcon />
    </button>
  );
}
