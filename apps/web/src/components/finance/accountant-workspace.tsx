'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Download, FileText, Printer, ReceiptText, Users } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useRef, useState } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { apiDownloadCsv, apiFetch, apiJson } from '@/lib/api';
import {
  CollectionPage,
  FeeBatch,
  FeeCurrency,
  FeePaymentMethod,
  FinanceClass,
  FinanceInsights,
  FinancePage,
  formatMoney,
  localDate,
  PaymentReceipt,
  Receivable,
} from '@/lib/finance';
import { useAuth } from '@/providers/auth-provider';
import { workspaceRoute } from '@/lib/workspace-route';

const inputClass =
  'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const actionClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#12304d] transition hover:border-blue-400 hover:bg-blue-50';
const feeLinks = [
  { href: '/admin/accountant', label: 'Overview' },
  { href: '/admin/finance', label: 'Student ledger' },
  { href: '/admin/finance/receivables', label: 'Receivables' },
  { href: '/admin/finance/collections', label: 'Collections' },
  { href: '/admin/finance/bulk', label: 'Charge a class', create: true },
];

export function FinanceNavigation({ current }: { current: string }) {
  const { can, user } = useAuth();
  const canRead = can('fee.read', 'SCHOOL') && can('payment.read', 'SCHOOL');
  return (
    <nav aria-label="Finance pages" className="mb-6 flex flex-wrap gap-2 pb-1">
      {feeLinks
        .filter(
          (item) =>
            item.href === '/admin/accountant' ||
            (canRead && (!item.create || can('fee.create', 'SCHOOL'))),
        )
        .map((item) => {
          const href = item.href === '/admin/accountant' && user ? workspaceRoute(user) : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              aria-current={current === href ? 'page' : undefined}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${current === href ? 'bg-[#102c4d] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'}`}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}

function ErrorMessage({ error }: { error: Error | null }) {
  return error ? (
    <p
      role="alert"
      className="my-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {error.message}
    </p>
  ) : null;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
      {children}
    </p>
  );
}

function money(amount: string, currency: FeeCurrency) {
  return formatMoney(amount, currency);
}
function name(student: { firstName: string; lastName: string }) {
  return `${student.firstName} ${student.lastName}`;
}
function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
}

function CurrencyCard({ row }: { row: FinanceInsights['currencies'][number] }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
            {row.currency} accounts
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#102641]">
            {money(row.outstanding, row.currency)}
          </h2>
          <p className="text-sm text-slate-500">Still to collect</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          {row.collectionRate}% collected
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <p className="text-slate-500">Overdue</p>
          <strong className="text-red-700">{money(row.overdue, row.currency)}</strong>
        </div>
        <div>
          <p className="text-slate-500">Due next 7 days</p>
          <strong className="text-amber-700">{money(row.dueSoon, row.currency)}</strong>
        </div>
        <div>
          <p className="text-slate-500">Billed</p>
          <strong>{money(row.billed, row.currency)}</strong>
        </div>
        <div>
          <p className="text-slate-500">Received</p>
          <strong className="text-emerald-700">{money(row.collected, row.currency)}</strong>
        </div>
      </div>
    </Card>
  );
}

export function AccountantHome() {
  const { can } = useAuth();
  const canRead = can('fee.read', 'SCHOOL') && can('payment.read', 'SCHOOL');
  const insights = useQuery({
    queryKey: ['finance', 'insights'],
    queryFn: () => apiFetch<FinanceInsights>('/finance/insights'),
    enabled: canRead,
  });
  const [currency, setCurrency] = useState<FeeCurrency>('USD');
  const row = insights.data?.currencies.find((item) => item.currency === currency);
  const maxTrend = Math.max(1, ...(row?.trend.map((item) => Number(item.amount)) ?? []));
  const maxAging = Math.max(1, ...(row ? Object.values(row.aging).map(Number) : []));
  const agingLabels = [
    { key: 'current', label: 'Not overdue' },
    { key: 'days1to30', label: '1–30 days' },
    { key: 'days31to60', label: '31–60 days' },
    { key: 'days61to90', label: '61–90 days' },
    { key: 'days91plus', label: '91+ days' },
  ] as const;
  return (
    <>
      <PageHeader
        title="Accountant workspace"
        description="Know what is due, record what arrived, and focus on the accounts that need attention."
      />
      <FinanceNavigation current="/admin/accountant" />
      {!canRead && (
        <Empty>
          Your role does not currently have access to student fees and payments. Ask a school
          administrator to review your finance permissions.
        </Empty>
      )}
      {canRead && (
        <>
          <section aria-label="Common finance tasks" className="mb-6 grid gap-3 sm:grid-cols-3">
            {can('fee.create', 'SCHOOL') && (
              <Link
                className="group rounded-2xl bg-[#102c4d] p-5 text-white transition hover:bg-[#173d68]"
                href="/admin/finance/bulk"
              >
                <Users size={22} />
                <strong className="mt-3 block">Charge a class</strong>
                <span className="mt-1 flex items-center justify-between text-sm text-blue-100">
                  Create fees for all active students <ArrowRight size={16} />
                </span>
              </Link>
            )}
            <Link
              className="group rounded-2xl bg-[#e8f3ff] p-5 text-[#102c4d] transition hover:bg-[#dbeaff]"
              href="/admin/finance/receivables"
            >
              <ReceiptText size={22} />
              <strong className="mt-3 block">Follow up overdue fees</strong>
              <span className="mt-1 flex items-center justify-between text-sm text-slate-600">
                Open the collection work list <ArrowRight size={16} />
              </span>
            </Link>
            <Link
              className="group rounded-2xl bg-[#eaf8ef] p-5 text-[#14532d] transition hover:bg-[#daf1e2]"
              href="/admin/finance/collections"
            >
              <FileText size={22} />
              <strong className="mt-3 block">Review collections</strong>
              <span className="mt-1 flex items-center justify-between text-sm text-slate-600">
                Check payments and receipts <ArrowRight size={16} />
              </span>
            </Link>
          </section>
          <ErrorMessage error={insights.error} />
          {insights.isLoading && (
            <p className="mb-5 text-sm text-slate-500">Loading finance insights…</p>
          )}
          {insights.data?.activeCharges === 0 && (
            <Card>
              <h2 className="text-lg font-bold text-[#102641]">Ready to start fee collection</h2>
              <p className="mt-2 text-sm text-slate-600">
                There are no active student fees yet. Add a fee to one student's ledger or charge a
                class. Balances, aging, collection trends, and follow-up priorities will appear here
                as you record fees and payments.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className={actionClass} href="/admin/finance">
                  Open student ledger
                </Link>
                {can('fee.create', 'SCHOOL') && (
                  <Link className={actionClass} href="/admin/finance/bulk">
                    Charge a class
                  </Link>
                )}
              </div>
            </Card>
          )}
          {Boolean(insights.data?.activeCharges) && (
            <>
              <section aria-label="Balances by currency" className="grid gap-4 lg:grid-cols-2">
                {insights.data?.currencies.map((item) => (
                  <CurrencyCard key={item.currency} row={item} />
                ))}
              </section>
              {insights.data && (
                <p className="mt-2 text-xs text-slate-500">
                  As of {insights.data.asOf} · {insights.data.activeCharges} active fees · USD and
                  KHR are never combined
                </p>
              )}
              <div className="mt-6 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">Analyze:</span>
                {(['USD', 'KHR'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrency(item)}
                    aria-pressed={currency === item}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold ${currency === item ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <section className="mt-4 grid gap-5 xl:grid-cols-2">
                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-[#102641]">Receivables aging</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Outstanding balance by time since due date
                      </p>
                    </div>
                    <Link
                      className="shrink-0 text-sm font-semibold text-blue-700"
                      href="/admin/finance/receivables"
                    >
                      Open list
                    </Link>
                  </div>
                  <div className="mt-5 space-y-4">
                    {agingLabels.map(({ key, label }) => (
                      <div key={key}>
                        <div className="mb-1 flex justify-between gap-2 text-xs">
                          <span className="font-medium text-slate-600">{label}</span>
                          <strong>{money(row?.aging[key] ?? '0', currency)}</strong>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${key === 'current' ? 'bg-blue-500' : 'bg-amber-500'}`}
                            style={{
                              width: `${Math.max(0, (Number(row?.aging[key] ?? 0) / maxAging) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-[#102641]">Collections trend</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Payments received over the last six calendar months
                      </p>
                    </div>
                    <Link
                      className="text-sm font-semibold text-blue-700"
                      href="/admin/finance/collections"
                    >
                      Details
                    </Link>
                  </div>
                  <div className="mt-5 flex h-44 items-end gap-3">
                    {row?.trend.map((item) => (
                      <div
                        className="flex min-w-0 flex-1 flex-col items-center gap-2"
                        key={item.month}
                      >
                        <span className="text-[10px] font-semibold text-slate-600">
                          {Number(item.amount)
                            ? new Intl.NumberFormat('en-US', { notation: 'compact' }).format(
                                Number(item.amount),
                              )
                            : '0'}
                        </span>
                        <div
                          className="w-full rounded-t-lg bg-emerald-500"
                          style={{
                            height: `${Math.max(3, (Number(item.amount) / maxTrend) * 112)}px`,
                          }}
                          title={`${item.month}: ${money(item.amount, currency)}`}
                        />
                        <span className="text-[10px] text-slate-500">{item.month.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Month number shown below each bar; open Collections for exact dates and payment
                    methods.
                  </p>
                </Card>
              </section>
              <section className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-[#102641]">Accounts to follow up</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Largest overdue student balances in {currency}
                      </p>
                    </div>
                    <Link
                      className="shrink-0 text-sm font-semibold text-blue-700"
                      href="/admin/finance/receivables"
                    >
                      All overdue
                    </Link>
                  </div>
                  {row?.priority.length ? (
                    <div className="mt-4 divide-y divide-slate-100">
                      {row.priority.map((item) => (
                        <Link
                          key={item.student.id}
                          className="flex items-center justify-between gap-4 py-3 text-sm hover:text-blue-700"
                          href={`/admin/finance/students/${item.student.id}`}
                        >
                          <span>
                            <strong className="block text-[#102641]">{name(item.student)}</strong>
                            <small className="text-slate-500">
                              {item.student.studentCode} · oldest due {item.oldestDue} ·{' '}
                              {item.feeCount} fee{item.feeCount === 1 ? '' : 's'}
                            </small>
                          </span>
                          <strong className="shrink-0 text-red-700">
                            {money(item.amount, currency)}
                          </strong>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <Empty>No overdue balances in {currency}.</Empty>
                    </div>
                  )}
                </Card>
                <Card>
                  <h2 className="font-bold text-[#102641]">Payment methods</h2>
                  <p className="mt-1 text-sm text-slate-500">Last 30 days · {currency}</p>
                  <div className="mt-4 space-y-3">
                    {row?.methods.map((item) => (
                      <div
                        key={item.method}
                        className="flex justify-between gap-3 border-b border-slate-100 pb-2 text-sm"
                      >
                        <span className="capitalize text-slate-600">
                          {item.method.replaceAll('_', ' ').toLowerCase()}
                        </span>
                        <strong>{money(item.amount, currency)}</strong>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}

function Pager({
  page,
  totalPages,
  total,
  setPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  setPage: (page: number) => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <span>
        {total} record{total === 1 ? '' : 's'} · page {page} of {Math.max(1, totalPages)}
      </span>
      <div className="flex gap-2">
        <button
          className={actionClass}
          type="button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <button
          className={actionClass}
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${status === 'PAID' || status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : status === 'OVERDUE' || status === 'VOIDED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}

export function ReceivablesWorkspace() {
  const [status, setStatus] = useState('OVERDUE');
  const [currency, setCurrency] = useState('');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState<Error | null>(null);
  const [exporting, setExporting] = useState(false);
  const filters = queryString({ status, currency, search });
  const result = useQuery({
    queryKey: ['finance', 'receivables', filters, page],
    queryFn: () =>
      apiFetch<FinancePage<Receivable>>(
        `/finance/receivables?${queryString({ status, currency, search, page, pageSize: 20 })}`,
      ),
  });
  async function download() {
    setExportError(null);
    setExporting(true);
    try {
      await apiDownloadCsv(`/finance/receivables.csv?${filters}`, `receivables-${localDate()}.csv`);
    } catch (error) {
      setExportError(error as Error);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Receivables"
        description="Find unpaid fees, see exactly what is overdue, and open a student's ledger to record a payment."
      />
      <FinanceNavigation current="/admin/finance/receivables" />
      <Card>
        <form
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_150px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchText.trim());
          }}
        >
          <label className="text-xs font-semibold text-slate-600">
            Student or fee
            <input
              className={`${inputClass} mt-1`}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Name, student code, or fee"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Status
            <select
              className={`${inputClass} mt-1`}
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="ALL">All fees</option>
              <option value="OVERDUE">Overdue</option>
              <option value="DUE_SOON">Due in 7 days</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partially paid</option>
              <option value="PAID">Paid</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Currency
            <select
              className={`${inputClass} mt-1`}
              value={currency}
              onChange={(event) => {
                setPage(1);
                setCurrency(event.target.value);
              }}
            >
              <option value="">All currencies</option>
              <option value="USD">USD</option>
              <option value="KHR">KHR</option>
            </select>
          </label>
          <Button className="self-end" type="submit">
            Search
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Balances reflect active payments. Export includes all matching rows, not just this page.
          </p>
          <button className={actionClass} type="button" onClick={download} disabled={exporting}>
            <Download size={16} />
            {exporting ? 'Preparing…' : 'Export CSV'}
          </button>
        </div>
      </Card>
      <ErrorMessage error={result.error ?? exportError} />
      {result.isLoading && <p className="mt-5 text-sm text-slate-500">Loading receivables…</p>}
      <Card className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#102641]">Fee work list</h2>
          <span className="text-sm text-slate-500">{result.data?.meta.total ?? 0} matching</span>
        </div>
        {result.data?.items.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-4">Student</th>
                  <th className="pb-3 pr-4">Fee</th>
                  <th className="pb-3 pr-4">Due</th>
                  <th className="pb-3 pr-4">Billed</th>
                  <th className="pb-3 pr-4">Paid</th>
                  <th className="pb-3 pr-4">Balance</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-4">
                      <strong className="block text-[#102641]">{name(item.student)}</strong>
                      <span className="text-xs text-slate-500">{item.student.studentCode}</span>
                    </td>
                    <td className="py-3 pr-4">{item.title}</td>
                    <td className="py-3 pr-4">
                      {item.dueOn}
                      {item.daysPastDue > 0 && Number(item.balance) > 0 && (
                        <span className="block text-xs text-red-700">
                          {item.daysPastDue} days late
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {money(item.amount, item.currency)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {money(item.paid, item.currency)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap font-semibold">
                      {money(item.balance, item.currency)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3">
                      <Link
                        className="font-semibold text-blue-700 hover:underline"
                        href={`/admin/finance/students/${item.student.id}`}
                      >
                        Open ledger
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !result.isLoading && (
            <div className="mt-4">
              <Empty>No fees match these filters.</Empty>
            </div>
          )
        )}
        {result.data && (
          <Pager
            page={page}
            totalPages={result.data.meta.totalPages}
            total={result.data.meta.total}
            setPage={setPage}
          />
        )}
      </Card>
    </>
  );
}

export function CollectionsWorkspace() {
  const [currency, setCurrency] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState<Error | null>(null);
  const [exporting, setExporting] = useState(false);
  const filters = queryString({ currency, method, status, from, to, search });
  const result = useQuery({
    queryKey: ['finance', 'collections', filters, page],
    queryFn: () =>
      apiFetch<CollectionPage>(
        `/finance/collections?${queryString({ currency, method, status, from, to, search, page, pageSize: 20 })}`,
      ),
  });
  async function download() {
    setExportError(null);
    setExporting(true);
    try {
      await apiDownloadCsv(`/finance/collections.csv?${filters}`, `collections-${localDate()}.csv`);
    } catch (error) {
      setExportError(error as Error);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Collections"
        description="Review money received by date and method, open receipts, and export records for reconciliation."
      />
      <FinanceNavigation current="/admin/finance/collections" />
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchText.trim());
          }}
        >
          <label className="text-xs font-semibold text-slate-600">
            From
            <input
              className={`${inputClass} mt-1`}
              type="date"
              value={from}
              onChange={(event) => {
                setPage(1);
                setFrom(event.target.value);
              }}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            To
            <input
              className={`${inputClass} mt-1`}
              type="date"
              min={from || undefined}
              value={to}
              onChange={(event) => {
                setPage(1);
                setTo(event.target.value);
              }}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Currency
            <select
              className={`${inputClass} mt-1`}
              value={currency}
              onChange={(event) => {
                setPage(1);
                setCurrency(event.target.value);
              }}
            >
              <option value="">All currencies</option>
              <option value="USD">USD</option>
              <option value="KHR">KHR</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Method
            <select
              className={`${inputClass} mt-1`}
              value={method}
              onChange={(event) => {
                setPage(1);
                setMethod(event.target.value);
              }}
            >
              <option value="">All methods</option>
              {(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'] as FeePaymentMethod[]).map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Record status
            <select
              className={`${inputClass} mt-1`}
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="ACTIVE">Active payments</option>
              <option value="VOIDED">Voided payments</option>
              <option value="ALL">All payments</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Student or reference
            <input
              className={`${inputClass} mt-1`}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Name, code, fee, reference"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit">Search</Button>
            <button className={actionClass} type="button" onClick={download} disabled={exporting}>
              <Download size={16} />
              {exporting ? 'Preparing…' : 'Export CSV'}
            </button>
          </div>
        </form>
      </Card>
      <ErrorMessage error={result.error ?? exportError} />
      {result.isLoading && <p className="mt-5 text-sm text-slate-500">Loading collections…</p>}
      <section
        aria-label="Active collections by currency"
        className="mt-5 grid gap-4 sm:grid-cols-2"
      >
        {result.data?.totals.map((item) => (
          <Card key={item.currency}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {item.currency} received
            </p>
            <strong className="mt-2 block text-2xl text-emerald-700">
              {money(item.amount, item.currency)}
            </strong>
            <p className="mt-1 text-sm text-slate-500">
              {item.count} active payment{item.count === 1 ? '' : 's'} matching filters
            </p>
          </Card>
        ))}
      </section>
      <Card className="mt-5">
        <h2 className="font-bold text-[#102641]">Payment records</h2>
        {result.data?.items.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Student</th>
                  <th className="pb-3 pr-4">Fee</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Method</th>
                  <th className="pb-3 pr-4">Reference</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-4">{item.receivedOn}</td>
                    <td className="py-3 pr-4">
                      <strong className="block">{name(item.student)}</strong>
                      <span className="text-xs text-slate-500">{item.student.studentCode}</span>
                    </td>
                    <td className="py-3 pr-4">{item.title}</td>
                    <td className="py-3 pr-4 whitespace-nowrap font-semibold">
                      {money(item.amount, item.currency)}
                    </td>
                    <td className="py-3 pr-4 capitalize">
                      {item.method.replaceAll('_', ' ').toLowerCase()}
                    </td>
                    <td className="py-3 pr-4">{item.reference || '—'}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3">
                      <Link
                        className="font-semibold text-blue-700 hover:underline"
                        href={`/admin/finance/receipts/${item.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !result.isLoading && (
            <div className="mt-4">
              <Empty>No payments match these filters.</Empty>
            </div>
          )
        )}
        {result.data && (
          <Pager
            page={page}
            totalPages={result.data.meta.totalPages}
            total={result.data.meta.total}
            setPage={setPage}
          />
        )}
      </Card>
    </>
  );
}

function BatchHistoryRow({ batch, canVoid }: { batch: FeeBatch; canVoid: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const client = useQueryClient();
  const voidBatch = useMutation({
    mutationFn: () => apiJson(`/finance/batches/${batch.id}/void`, 'POST', { reason }),
    onSuccess: () => {
      setOpen(false);
      setReason('');
      client.invalidateQueries({ queryKey: ['finance'] });
    },
  });
  return (
    <div className="border-b border-slate-100 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <strong className="block text-[#102641]">{batch.title}</strong>
          <p className="mt-1 text-xs text-slate-500">
            {batch.academicYear} · {batch.grade} {batch.className} · due {batch.dueOn} ·{' '}
            {batch.studentCount} students
          </p>
          {batch.voidedAt && (
            <span className="mt-2 inline-block">
              <StatusBadge status="VOIDED" />
            </span>
          )}
        </div>
        <div className="text-right">
          <strong className="block">{money(batch.total, batch.currency)}</strong>
          <span className="text-xs text-slate-500">
            Original total · {money(batch.amount, batch.currency)} each
          </span>
        </div>
      </div>
      {canVoid && !batch.voidedAt && (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-red-700 hover:underline"
          onClick={() => setOpen(!open)}
        >
          Void entire class charge
        </button>
      )}
      {open && (
        <form
          className="mt-3 flex flex-wrap gap-2 rounded-xl bg-red-50 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            voidBatch.mutate();
          }}
        >
          <label className="min-w-[220px] flex-1 text-xs font-semibold text-red-800">
            Reason
            <input
              className={`${inputClass} mt-1`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={3}
              maxLength={500}
              required
              placeholder="Why is this class charge being voided?"
            />
          </label>
          <button
            className="self-end rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            type="submit"
            disabled={voidBatch.isPending}
          >
            Void charge
          </button>
          {voidBatch.isError && (
            <p role="alert" className="w-full text-xs text-red-700">
              {voidBatch.error.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

export function BulkFeeWorkspace() {
  const client = useQueryClient();
  const { can } = useAuth();
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<FeeCurrency>('USD');
  const [dueOn, setDueOn] = useState('');
  const key = useRef(crypto.randomUUID());
  const classes = useQuery({
    queryKey: ['finance', 'classes'],
    queryFn: () => apiFetch<FinanceClass[]>('/finance/classes'),
  });
  const batches = useQuery({
    queryKey: ['finance', 'batches'],
    queryFn: () => apiFetch<FeeBatch[]>('/finance/batches'),
  });
  const selected = classes.data?.find((item) => item.id === classId);
  function changed() {
    key.current = crypto.randomUUID();
  }
  const create = useMutation({
    mutationFn: () =>
      apiJson<FeeBatch>('/finance/batches', 'POST', {
        batchId: key.current,
        classSectionId: classId,
        title,
        description,
        amount,
        currency,
        dueOn,
      }),
    onSuccess: () => {
      key.current = crypto.randomUUID();
      setTitle('');
      setDescription('');
      setAmount('');
      setDueOn('');
      client.invalidateQueries({ queryKey: ['finance'] });
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }
  return (
    <>
      <PageHeader
        title="Charge a class"
        description="Create the same fee for every active student enrolled in one class. Review the count and total before posting."
      />
      <FinanceNavigation current="/admin/finance/bulk" />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h2 className="font-bold text-[#102641]">New class charge</h2>
          <p className="mt-1 text-sm text-slate-500">
            Fees are added to each student's ledger and can be paid separately.
          </p>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
              Class
              <select
                className={`${inputClass} mt-1`}
                required
                value={classId}
                onChange={(event) => {
                  changed();
                  setClassId(event.target.value);
                }}
              >
                <option value="">Choose a class</option>
                {classes.data
                  ?.filter((item) => item.studentCount > 0)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.academicYear} · {item.grade} {item.name} · {item.studentCount} students
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
              Fee name
              <input
                className={`${inputClass} mt-1`}
                required
                minLength={2}
                maxLength={120}
                value={title}
                onChange={(event) => {
                  changed();
                  setTitle(event.target.value);
                }}
                placeholder="Semester tuition"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Amount per student
              <input
                className={`${inputClass} mt-1`}
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => {
                  changed();
                  setAmount(event.target.value);
                }}
                placeholder="0.00"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Currency
              <select
                className={`${inputClass} mt-1`}
                value={currency}
                onChange={(event) => {
                  changed();
                  setCurrency(event.target.value as FeeCurrency);
                }}
              >
                <option value="USD">USD</option>
                <option value="KHR">KHR</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Due date
              <input
                className={`${inputClass} mt-1`}
                required
                type="date"
                value={dueOn}
                onChange={(event) => {
                  changed();
                  setDueOn(event.target.value);
                }}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
              Description (optional)
              <input
                className={`${inputClass} mt-1`}
                maxLength={500}
                value={description}
                onChange={(event) => {
                  changed();
                  setDescription(event.target.value);
                }}
                placeholder="What this fee covers"
              />
            </label>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm sm:col-span-2">
              <strong className="block text-[#102641]">Review before posting</strong>
              {selected ? (
                <p className="mt-1 text-slate-700">
                  {selected.studentCount} active students × {money(amount || '0', currency)} ={' '}
                  <strong>
                    {money(String(Number(amount || 0) * selected.studentCount), currency)}
                  </strong>
                </p>
              ) : (
                <p className="mt-1 text-slate-600">
                  Choose a class to see the number of students and total.
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                The final student count is checked again when you post the charge.
              </p>
            </div>
            <Button
              className="sm:col-span-2"
              type="submit"
              disabled={create.isPending || !selected || !Number(amount)}
            >
              {create.isPending
                ? 'Posting fees…'
                : `Charge ${selected?.studentCount ?? 0} students`}
            </Button>
          </form>
          <ErrorMessage error={create.error} />
          {create.isSuccess && (
            <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              Class charge posted. Each student now has a fee in their ledger.
            </p>
          )}
          <ErrorMessage error={classes.error} />
          {!classes.isLoading && !classes.data?.some((item) => item.studentCount > 0) && (
            <div className="mt-4">
              <Empty>No classes with active students are available.</Empty>
            </div>
          )}
        </Card>
        <Card>
          <h2 className="font-bold text-[#102641]">How this works</h2>
          <ol className="mt-4 space-y-4 text-sm text-slate-600">
            <li>
              <strong className="text-[#102641]">1. Choose the class.</strong>
              <br />
              Only active enrollments receive the fee.
            </li>
            <li>
              <strong className="text-[#102641]">2. Check the total.</strong>
              <br />
              Amount per student and number of students are shown before posting.
            </li>
            <li>
              <strong className="text-[#102641]">3. Record payments.</strong>
              <br />
              Open a student's ledger to accept a full or partial payment.
            </li>
            <li>
              <strong className="text-[#102641]">4. Correct mistakes.</strong>
              <br />
              You can void the whole class charge if no active payments remain.
            </li>
          </ol>
        </Card>
      </div>
      <Card className="mt-5">
        <h2 className="font-bold text-[#102641]">Recent class charges</h2>
        <ErrorMessage error={batches.error} />
        {batches.isLoading && <p className="mt-3 text-sm text-slate-500">Loading class charges…</p>}
        {batches.data?.length ? (
          <div className="mt-2">
            {batches.data.map((batch) => (
              <BatchHistoryRow key={batch.id} batch={batch} canVoid={can('fee.update', 'SCHOOL')} />
            ))}
          </div>
        ) : (
          !batches.isLoading && (
            <div className="mt-4">
              <Empty>No class charges have been posted yet.</Empty>
            </div>
          )
        )}
      </Card>
    </>
  );
}

export function ReceiptWorkspace({ paymentId }: { paymentId: string }) {
  const receipt = useQuery({
    queryKey: ['finance', 'receipt', paymentId],
    queryFn: () => apiFetch<PaymentReceipt>(`/finance/payments/${paymentId}/receipt`),
  });
  const data = receipt.data;
  return (
    <>
      <style media="print">
        {
          '@page { size: A4; margin: 16mm; } body { background: white !important; } aside, nav, header, .receipt-no-print { display: none !important; } main { padding: 0 !important; } .receipt-paper { box-shadow: none !important; border: 0 !important; max-width: none !important; }'
        }
      </style>
      <div className="receipt-no-print">
        <PageHeader
          title="Payment receipt"
          description="Review the payment and print a copy for the student or school records."
        />
        <FinanceNavigation current="" />
        <div className="mb-5 flex flex-wrap gap-2">
          <Link className={actionClass} href="/admin/finance/collections">
            Back to collections
          </Link>
          {data && (
            <Link className={actionClass} href={`/admin/finance/students/${data.student.id}`}>
              Student ledger
            </Link>
          )}
          <button
            className={actionClass}
            type="button"
            onClick={() => window.print()}
            disabled={!data}
          >
            <Printer size={16} />
            Print receipt
          </button>
        </div>
      </div>
      <ErrorMessage error={receipt.error} />
      {receipt.isLoading && <p className="text-sm text-slate-500">Loading receipt…</p>}
      {data && (
        <article className="receipt-paper mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                School payment receipt
              </p>
              <h1 className="mt-2 text-2xl font-bold text-[#102641]">{data.school.name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {data.school.address || data.school.code}
              </p>
              <p className="text-sm text-slate-600">
                {[data.school.phone, data.school.email].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm text-slate-500">Receipt ID</p>
              <p className="font-mono text-xs font-semibold text-[#102641]">{data.id}</p>
              <p className="mt-2 text-sm text-slate-500">Received {data.payment.receivedOn}</p>
            </div>
          </div>
          {data.payment.voidedAt && (
            <div className="mt-6 rounded-xl border-2 border-red-500 bg-red-50 p-4 text-center text-lg font-bold text-red-700">
              VOIDED RECEIPT<p className="mt-1 text-sm font-normal">{data.payment.voidReason}</p>
            </div>
          )}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Received from
              </p>
              <p className="mt-2 font-semibold text-[#102641]">{name(data.student)}</p>
              <p className="text-sm text-slate-600">Student code {data.student.studentCode}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Payment details
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {data.payment.method.replaceAll('_', ' ')}
              </p>
              <p className="text-sm text-slate-600">
                Reference: {data.payment.reference || 'Not provided'}
              </p>
            </div>
          </div>
          <div className="mt-8 border-y border-slate-200 py-5">
            <div className="flex justify-between gap-4 text-sm">
              <span>Fee</span>
              <strong>{data.fee.title}</strong>
            </div>
            <div className="mt-2 flex justify-between gap-4 text-sm text-slate-600">
              <span>Fee due date</span>
              <span>{data.fee.dueOn}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4 text-sm text-slate-600">
              <span>Original fee</span>
              <span>{money(data.fee.amount, data.fee.currency)}</span>
            </div>
          </div>
          <div className="mt-6 flex justify-between gap-4 text-xl font-bold text-[#102641]">
            <span>Amount received</span>
            <span>{money(data.payment.amount, data.fee.currency)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-4 text-sm text-slate-600">
            <span>Current fee balance</span>
            <span>{money(data.fee.balance, data.fee.currency)}</span>
          </div>
          {data.payment.note && (
            <p className="mt-6 text-sm text-slate-600">Note: {data.payment.note}</p>
          )}
          <p className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
            Generated from the school's recorded payment. Current fee balance may change after this
            receipt was issued.
          </p>
        </article>
      )}
    </>
  );
}
