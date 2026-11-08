'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CircleDollarSign,
  CreditCard,
  ReceiptText,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useRef, useState } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { apiFetch, apiJson } from '@/lib/api';
import {
  FeeCharge,
  FeePayment,
  FinanceSummary,
  FinanceTotals,
  formatMoney,
  localDate,
  StudentLedger,
} from '@/lib/finance';
import { useAuth } from '@/providers/auth-provider';
import { FinanceNavigation } from './accountant-workspace';

type Student = { id: string; firstName: string; lastName: string; studentCode: string };
type Page<T> = { items: T[]; meta: { page: number; total: number; totalPages: number } };
const inputClass =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const mutedButton =
  'rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

function FinanceTotalsCards({ totals }: { totals: FinanceTotals[] }) {
  if (!totals.length)
    return (
      <Card>
        <p className="text-sm text-slate-600">
          No fees have been added yet. Choose a student to create the first fee.
        </p>
      </Card>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {totals.map((row) => (
        <Card key={row.currency}>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#102641]">
            <CircleDollarSign size={18} />
            {row.currency} fees
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-slate-500">Billed</p>
              <strong className="mt-1 block text-lg text-[#102641]">
                {formatMoney(row.billed, row.currency)}
              </strong>
            </div>
            <div>
              <p className="text-slate-500">Collected</p>
              <strong className="mt-1 block text-lg text-emerald-700">
                {formatMoney(row.collected, row.currency)}
              </strong>
            </div>
            <div>
              <p className="text-slate-500">Outstanding</p>
              <strong className="mt-1 block text-lg text-amber-700">
                {formatMoney(row.outstanding, row.currency)}
              </strong>
            </div>
            <div>
              <p className="text-slate-500">Overdue</p>
              <strong className="mt-1 block text-lg text-red-700">
                {formatMoney(row.overdue, row.currency)}
              </strong>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {row.chargeCount} active fee{row.chargeCount === 1 ? '' : 's'}
          </p>
        </Card>
      ))}
    </div>
  );
}

export function FinanceOverview() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const summary = useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => apiFetch<FinanceSummary>('/finance/summary'),
  });
  const students = useQuery({
    queryKey: ['finance', 'students', search, page],
    queryFn: () =>
      apiFetch<Page<Student>>(
        `/students?page=${page}&pageSize=15&search=${encodeURIComponent(search.trim())}`,
      ),
  });
  return (
    <>
      <PageHeader
        title="Fees & payments"
        description="See student balances and record payments received by the school. Amounts are kept separately by currency."
      />
      <FinanceNavigation current="/admin/finance" />
      {(summary.isError || students.isError) && (
        <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          Finance records could not be loaded. Refresh the page to try again.
        </p>
      )}
      {summary.isLoading && <p className="mb-5 text-sm text-slate-500">Loading fee balances…</p>}
      {summary.isSuccess && <FinanceTotalsCards totals={summary.data.totals} />}
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <div className="flex items-center gap-2">
            <Search size={18} className="text-blue-700" />
            <h2 className="font-semibold text-[#102641]">Choose a student</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Open a student to add fees, record payments, and review their history.
          </p>
          <label
            className="mt-4 block text-xs font-semibold text-slate-600"
            htmlFor="finance-student-search"
          >
            Search name or student code
          </label>
          <input
            className={`${inputClass} mt-1`}
            id="finance-student-search"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            type="search"
            value={search}
          />
          <div className="mt-3 divide-y divide-[#e8eff3]">
            {students.data?.items.map((student) => (
              <Link
                className="flex items-center justify-between gap-3 py-3 text-sm hover:text-blue-700"
                href={`/admin/finance/students/${student.id}`}
                key={student.id}
              >
                <span>
                  <strong className="block">
                    {student.firstName} {student.lastName}
                  </strong>
                  <small className="text-slate-500">{student.studentCode}</small>
                </span>
                <ArrowRight size={17} />
              </Link>
            ))}
            {!students.isLoading && !students.data?.items.length && (
              <p className="py-4 text-sm text-slate-500">No matching students.</p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {students.data?.meta.page ?? page} of{' '}
              {Math.max(1, students.data?.meta.totalPages ?? 1)}
            </span>
            <div className="flex gap-2">
              <button
                className={mutedButton}
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                type="button"
              >
                Previous
              </button>
              <button
                className={mutedButton}
                disabled={page >= (students.data?.meta.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-blue-700" />
            <h2 className="font-semibold text-[#102641]">Recent payments</h2>
          </div>
          <div className="mt-3 divide-y divide-[#e8eff3]">
            {summary.data?.recentPayments.map((payment) => (
              <Link
                className="block py-3 text-sm hover:text-blue-700"
                href={`/admin/finance/students/${payment.student.id}`}
                key={payment.id}
              >
                <span className="flex justify-between gap-3">
                  <strong>
                    {payment.student.firstName} {payment.student.lastName}
                  </strong>
                  <strong>{formatMoney(payment.amount, payment.currency)}</strong>
                </span>
                <small className="mt-1 block text-slate-500">
                  {payment.title} · {payment.method.replaceAll('_', ' ').toLowerCase()} ·{' '}
                  {payment.receivedOn.slice(0, 10)}
                </small>
              </Link>
            ))}
            {!summary.isLoading && !summary.data?.recentPayments.length && (
              <p className="py-4 text-sm text-slate-500">No payments recorded yet.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function VoidAction({ label, path, onDone }: { label: string; path: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const action = useMutation({
    mutationFn: () => apiJson(path, 'POST', { reason }),
    onSuccess: () => {
      setOpen(false);
      setReason('');
      onDone();
    },
  });
  if (!open)
    return (
      <button
        className="text-xs font-semibold text-red-700 hover:underline"
        onClick={() => setOpen(true)}
        type="button"
      >
        {label}
      </button>
    );
  return (
    <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <label className="block text-xs font-semibold text-red-800">
        Reason for {label.toLowerCase()}
        <input
          className={`${inputClass} mt-1`}
          maxLength={500}
          minLength={3}
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </label>
      <div className="mt-2 flex gap-2">
        <button
          className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          disabled={reason.trim().length < 3 || action.isPending}
          onClick={() => action.mutate()}
          type="button"
        >
          {action.isPending ? 'Saving…' : `Confirm ${label.toLowerCase()}`}
        </button>
        <button className={mutedButton} onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
      </div>
      {action.isError && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {action.error.message}
        </p>
      )}
    </div>
  );
}

function CreateFeeForm({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (body: unknown) => apiJson('/finance/charges', 'POST', body),
    onSuccess: onDone,
    onError: (reason: Error) => setError(reason.message),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    create.mutate(
      {
        studentId,
        title: data.get('title'),
        description: data.get('description'),
        amount: data.get('amount'),
        currency: data.get('currency'),
        dueOn: data.get('dueOn'),
      },
      {
        onSuccess: () => {
          form.reset();
          setError(null);
        },
      },
    );
  }
  return (
    <Card>
      <div className="flex items-center gap-2">
        <ReceiptText size={18} className="text-blue-700" />
        <h2 className="font-semibold text-[#102641]">Add a fee</h2>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Create a charge for this student. This does not process a payment.
      </p>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
          Fee name
          <input
            className={`${inputClass} mt-1`}
            maxLength={120}
            minLength={2}
            name="title"
            placeholder="Tuition, registration, or materials"
            required
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Amount
          <input
            className={`${inputClass} mt-1`}
            min="0.01"
            name="amount"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Currency
          <select className={`${inputClass} mt-1`} defaultValue="USD" name="currency">
            <option value="USD">USD</option>
            <option value="KHR">KHR</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Due date
          <input className={`${inputClass} mt-1`} name="dueOn" required type="date" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Description (optional)
          <input className={`${inputClass} mt-1`} maxLength={500} name="description" />
        </label>
        <Button className="sm:col-span-2" disabled={create.isPending} type="submit">
          {create.isPending ? 'Adding fee…' : 'Add fee'}
        </Button>
      </form>
      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

function RecordPaymentForm({ charge, onDone }: { charge: FeeCharge; onDone: () => void }) {
  const requestKey = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (body: unknown) => apiJson(`/finance/charges/${charge.id}/payments`, 'POST', body),
    onSuccess: () => {
      requestKey.current = null;
      setError(null);
      onDone();
    },
    onError: (reason: Error) => setError(reason.message),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    requestKey.current ??= crypto.randomUUID();
    create.mutate(
      {
        amount: data.get('amount'),
        method: data.get('method'),
        receivedOn: data.get('receivedOn'),
        reference: data.get('reference'),
        note: data.get('note'),
        idempotencyKey: requestKey.current,
      },
      { onSuccess: () => form.reset() },
    );
  }
  return (
    <form
      className="mt-4 grid gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:grid-cols-2"
      onSubmit={submit}
    >
      <h4 className="font-semibold text-[#102641] sm:col-span-2">Record a received payment</h4>
      <label className="text-xs font-semibold text-slate-600">
        Amount
        <input
          className={`${inputClass} mt-1`}
          defaultValue={charge.balance}
          max={charge.balance}
          min="0.01"
          name="amount"
          required
          step="0.01"
          type="number"
        />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Method
        <select className={`${inputClass} mt-1`} defaultValue="CASH" name="method">
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="CARD">Card</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Date received
        <input
          className={`${inputClass} mt-1`}
          defaultValue={localDate()}
          name="receivedOn"
          required
          type="date"
        />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Reference (optional)
        <input
          className={`${inputClass} mt-1`}
          maxLength={100}
          name="reference"
          placeholder="Transfer or receipt reference"
        />
      </label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
        Note (optional)
        <input className={`${inputClass} mt-1`} maxLength={500} name="note" />
      </label>
      <Button className="sm:col-span-2" disabled={create.isPending} type="submit">
        {create.isPending ? 'Recording…' : `Record ${charge.currency} payment`}
      </Button>
      {error && (
        <p className="text-sm text-red-700 sm:col-span-2" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function EditChargeForm({ charge, onDone }: { charge: FeeCharge; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const update = useMutation({
    mutationFn: (body: unknown) => apiJson(`/finance/charges/${charge.id}`, 'PATCH', body),
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
  });
  if (!open)
    return (
      <button
        className="text-xs font-semibold text-blue-700 hover:underline"
        onClick={() => setOpen(true)}
        type="button"
      >
        Edit fee
      </button>
    );
  return (
    <form
      className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        update.mutate({
          title: data.get('title'),
          amount: data.get('amount'),
          dueOn: data.get('dueOn'),
          description: data.get('description'),
        });
      }}
    >
      <h4 className="font-semibold sm:col-span-2">Edit fee</h4>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
        Name
        <input
          className={`${inputClass} mt-1`}
          defaultValue={charge.title}
          minLength={2}
          name="title"
          required
        />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Amount ({charge.currency})
        <input
          className={`${inputClass} mt-1`}
          defaultValue={charge.amount}
          min={Number(charge.paid) > 0 ? charge.paid : '0.01'}
          name="amount"
          required
          step="0.01"
          type="number"
        />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Due date
        <input
          className={`${inputClass} mt-1`}
          defaultValue={charge.dueOn.slice(0, 10)}
          name="dueOn"
          required
          type="date"
        />
      </label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
        Description
        <input
          className={`${inputClass} mt-1`}
          defaultValue={charge.description ?? ''}
          name="description"
        />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button disabled={update.isPending} type="submit">
          {update.isPending ? 'Saving…' : 'Save fee'}
        </Button>
        <button className={mutedButton} onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
      </div>
      {update.isError && (
        <p className="text-sm text-red-700 sm:col-span-2" role="alert">
          {update.error.message}
        </p>
      )}
    </form>
  );
}

function PaymentRow({
  payment,
  charge,
  onDone,
  canVoid,
}: {
  payment: FeePayment;
  charge: FeeCharge;
  onDone: () => void;
  canVoid: boolean;
}) {
  return (
    <div className="border-t border-[#e8eff3] py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <strong className={payment.voidedAt ? 'text-slate-400 line-through' : 'text-[#102641]'}>
            {formatMoney(payment.amount, charge.currency)}
          </strong>
          <p className="mt-0.5 text-xs text-slate-500">
            {payment.method.replaceAll('_', ' ').toLowerCase()} · {payment.receivedOn.slice(0, 10)}
            {payment.reference ? ` · ${payment.reference}` : ''}
          </p>
          {payment.note && <p className="mt-1 text-xs text-slate-500">{payment.note}</p>}
          <Link className="mt-1 inline-block text-xs font-semibold text-blue-700 hover:underline" href={`/admin/finance/receipts/${payment.id}`}>View receipt</Link>
        </div>
        <span className="text-xs text-slate-500">{payment.voidedAt ? 'Voided' : 'Received'}</span>
      </div>
      {payment.voidedAt && payment.voidReason && (
        <p className="mt-1 text-xs text-red-700">Reason: {payment.voidReason}</p>
      )}
      {canVoid && !payment.voidedAt && (
        <VoidAction
          label="Void payment"
          onDone={onDone}
          path={`/finance/payments/${payment.id}/void`}
        />
      )}
    </div>
  );
}

function ChargeCard({ charge, onDone }: { charge: FeeCharge; onDone: () => void }) {
  const { hasPermission } = useAuth();
  const active = !charge.voidedAt;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[#102641]">{charge.title}</h3>
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-bold ${charge.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : charge.status === 'OVERDUE' ? 'bg-red-50 text-red-700' : charge.status === 'VOIDED' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}
            >
              {charge.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Due {charge.dueOn.slice(0, 10)}
            {charge.description ? ` · ${charge.description}` : ''}
          </p>
        </div>
        <strong className="text-lg text-[#102641]">
          {formatMoney(charge.amount, charge.currency)}
        </strong>
      </div>
      <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <p>
          Paid{' '}
          <strong className="block text-emerald-700">
            {formatMoney(charge.paid, charge.currency)}
          </strong>
        </p>
        <p>
          Balance{' '}
          <strong className="block text-[#102641]">
            {formatMoney(charge.balance, charge.currency)}
          </strong>
        </p>
      </div>
      {charge.voidedAt && <p className="mt-3 text-xs text-red-700">Voided: {charge.voidReason}</p>}
      {active && hasPermission('fee.update') && (
        <div className="mt-3 grid gap-3">
          <EditChargeForm charge={charge} onDone={onDone} />
          {charge.payments.every((payment) => payment.voidedAt) && (
            <VoidAction
              label="Void fee"
              onDone={onDone}
              path={`/finance/charges/${charge.id}/void`}
            />
          )}
        </div>
      )}
      {active && Number(charge.balance) > 0 && hasPermission('payment.create') && (
        <RecordPaymentForm charge={charge} key={charge.balance} onDone={onDone} />
      )}
      <div className="mt-4">
        <h4 className="text-sm font-semibold text-[#102641]">Payment history</h4>
        {charge.payments.length ? (
          charge.payments.map((payment) => (
            <PaymentRow
              canVoid={hasPermission('payment.void')}
              charge={charge}
              key={payment.id}
              onDone={onDone}
              payment={payment}
            />
          ))
        ) : (
          <p className="mt-2 text-sm text-slate-500">No payments recorded.</p>
        )}
      </div>
    </Card>
  );
}

export function StudentFinance({ studentId }: { studentId: string }) {
  const client = useQueryClient();
  const { hasPermission } = useAuth();
  const ledger = useQuery({
    queryKey: ['finance', 'student', studentId],
    queryFn: () => apiFetch<StudentLedger>(`/finance/students/${studentId}`),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['finance', 'student', studentId] });
    void client.invalidateQueries({ queryKey: ['finance', 'summary'] });
  };
  return (
    <>
      <Link
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
        href="/admin/finance"
      >
        <ArrowLeft size={16} />
        All fees & payments
      </Link>
      <PageHeader
        title={
          ledger.data
            ? `${ledger.data.student.firstName} ${ledger.data.student.lastName}`
            : 'Student finance'
        }
        description={
          ledger.data
            ? `Fee and payment history · ${ledger.data.student.studentCode}`
            : 'Loading student finance records…'
        }
      />
      {ledger.isError && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          Could not load this student’s finance records.
        </p>
      )}
      {ledger.data && (
        <>
          {ledger.data.totals.length > 0 && <FinanceTotalsCards totals={ledger.data.totals} />}
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#102641]">Fees and payments</h2>
              {ledger.data.charges.map((charge) => (
                <ChargeCard charge={charge} key={charge.id} onDone={refresh} />
              ))}
              {!ledger.data.charges.length && (
                <p className="text-sm text-slate-500">This student has no fee history yet.</p>
              )}
            </div>
            {hasPermission('fee.create') && (
              <div>
                <CreateFeeForm onDone={refresh} studentId={studentId} />
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
