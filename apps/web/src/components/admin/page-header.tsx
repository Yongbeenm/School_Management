import { PropsWithChildren, ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  action,
  eyebrow = 'School workspace',
}: {
  title: string;
  description: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0867c7]">
          {eyebrow}
        </p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-[#071a31] md:text-[2.1rem]">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 md:text-[15px]">
          {description}
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={`rounded-[22px] border border-[#dce7ed] bg-white p-5 shadow-[0_4px_18px_-16px_rgba(7,26,49,0.3)] md:p-6 ${className}`}
    >
      {children}
    </section>
  );
}
