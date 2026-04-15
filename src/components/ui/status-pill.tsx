import type { ReactNode } from 'react';

const TONE_CLASSES = {
  neutral: 'border-white/10 bg-white/8 text-white/80',
  success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  danger: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  accent: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  lavender: 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200',
} as const;

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
