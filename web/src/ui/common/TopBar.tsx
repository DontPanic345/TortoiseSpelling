import type { ComponentChildren } from "preact";

interface TopBarProps {
  title: string;
  /** The navigation button, usually a BackButton. */
  navigation?: ComponentChildren;
  actions?: ComponentChildren;
}

export function TopBar({ title, navigation, actions }: TopBarProps) {
  return (
    <header class="top-bar">
      <div class="top-bar-navigation">{navigation}</div>
      <h1 class="top-bar-title">{title}</h1>
      <div class="top-bar-actions">{actions}</div>
    </header>
  );
}
