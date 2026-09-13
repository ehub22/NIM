import type { ReactNode } from 'react';

export interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** Consistent heading + spacing for settings groups. */
export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="border-line border-t py-5 first:border-t-0 first:pt-0">
      <h3 className="text-ink text-sm font-semibold">{title}</h3>
      {description ? <p className="text-ink-faint mt-1 text-xs leading-relaxed">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
