'use client';

import { FormEvent } from 'react';

export type EditField = {
  name: string;
  label: string;
  value?: string | number | null;
  type?: 'date' | 'email' | 'number' | 'select' | 'text' | 'textarea' | 'time';
  options?: Array<string | { value: string; label: string }>;
  required?: boolean;
};

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-teal-600';

export function EditRecordDialog({
  title,
  fields,
  isOpen,
  pending,
  onClose,
  onSubmit,
}: {
  title: string;
  fields: EditField[];
  isOpen: boolean;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
}) {
  if (!isOpen) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit(Object.fromEntries(data.entries()) as Record<string, string>);
  };

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog">
      <form className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onSubmit={submit}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold tracking-[0.16em] text-teal-700">UPDATE RECORD</p><h2 className="mt-1 text-xl font-semibold text-slate-900">{title}</h2></div>
          <button aria-label="Close" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">×</button>
        </div>
        <div className="grid gap-4">
          {fields.map((field) => <label className="grid gap-1.5 text-sm font-medium text-slate-700" key={field.name}>
            {field.label}
            {field.type === 'textarea' ? <textarea className="min-h-24 rounded-md border border-slate-300 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-teal-600" defaultValue={String(field.value ?? '')} name={field.name} required={field.required} />
              : field.type === 'select' ? <select className={inputClass} defaultValue={String(field.value ?? '')} name={field.name} required={field.required}>{field.options?.map((option) => { const value = typeof option === 'string' ? option : option.value; const label = typeof option === 'string' ? option.replaceAll('_', ' ') : option.label; return <option key={value} value={value}>{label}</option>; })}</select>
                : <input className={inputClass} defaultValue={String(field.value ?? '')} name={field.name} required={field.required} type={field.type ?? 'text'} />}
          </label>)}
        </div>
        <div className="mt-6 flex justify-end gap-3"><button className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose} type="button">Cancel</button><button className="h-10 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50" disabled={pending} type="submit">{pending ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </div>
  );
}

export function RecordActions({ onEdit, onArchive, archiveLabel = 'Archive', disabled = false }: { onEdit?: () => void; onArchive?: () => void; archiveLabel?: string; disabled?: boolean }) {
  const archive = () => {
    if (onArchive && window.confirm(`Are you sure you want to ${archiveLabel.toLowerCase()} this record? This cannot be undone from Version 1.`)) onArchive();
  };
  return <div className="flex justify-end gap-2 whitespace-nowrap">{onEdit && <button className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={disabled} onClick={onEdit} type="button">Edit</button>}{onArchive && <button className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50" disabled={disabled} onClick={archive} type="button">{archiveLabel}</button>}</div>;
}
