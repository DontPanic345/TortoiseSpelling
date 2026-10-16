import type { ComponentChildren } from "preact";

interface EmptyStateProps {
  icon: ComponentChildren;
  title: string;
  body: string;
  children?: ComponentChildren;
}

/** The "there's nothing here yet" panel, so empty states look deliberate. */
export function EmptyState({ icon, title, body, children }: EmptyStateProps) {
  return (
    <div class="empty-state">
      {icon}
      <h2 class="empty-state-title">{title}</h2>
      <p class="empty-state-body">{body}</p>
      {children}
    </div>
  );
}
