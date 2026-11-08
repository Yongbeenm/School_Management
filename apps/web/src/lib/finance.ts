export type FeeCurrency = 'USD' | 'KHR';
export type FeePaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';

export type FinanceTotals = {
  currency: FeeCurrency;
  billed: string;
  collected: string;
  outstanding: string;
  overdue: string;
  chargeCount: number;
};

export type FinanceSummary = {
  totals: FinanceTotals[];
  recentPayments: {
    id: string;
    amount: string;
    currency: FeeCurrency;
    method: FeePaymentMethod;
    receivedOn: string;
    title: string;
    student: { id: string; firstName: string; lastName: string; studentCode: string };
  }[];
};

export type FeePayment = {
  id: string;
  amount: string;
  method: FeePaymentMethod;
  reference: string | null;
  note: string | null;
  receivedOn: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export type FeeCharge = {
  id: string;
  title: string;
  description: string | null;
  amount: string;
  currency: FeeCurrency;
  dueOn: string;
  paid: string;
  balance: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOIDED';
  voidedAt: string | null;
  voidReason: string | null;
  payments: FeePayment[];
};

export type StudentLedger = {
  student: { id: string; firstName: string; lastName: string; studentCode: string };
  totals: FinanceTotals[];
  charges: FeeCharge[];
};

export type FinanceStudent = {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
};
export type FinanceInsights = {
  asOf: string;
  activeCharges: number;
  currencies: {
    currency: FeeCurrency;
    billed: string;
    collected: string;
    outstanding: string;
    overdue: string;
    dueSoon: string;
    collectionRate: string;
    aging: {
      current: string;
      days1to30: string;
      days31to60: string;
      days61to90: string;
      days91plus: string;
    };
    trend: { month: string; amount: string }[];
    methods: { method: FeePaymentMethod; amount: string }[];
    priority: { student: FinanceStudent; amount: string; oldestDue: string; feeCount: number }[];
  }[];
};

export type FinancePage<T> = {
  items: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};
export type Receivable = {
  id: string;
  student: FinanceStudent;
  title: string;
  dueOn: string;
  currency: FeeCurrency;
  amount: string;
  paid: string;
  balance: string;
  status: 'PAID' | 'OVERDUE' | 'PARTIAL' | 'UNPAID';
  daysPastDue: number;
  dueSoon: boolean;
};
export type Collection = {
  id: string;
  student: FinanceStudent;
  title: string;
  chargeId: string;
  amount: string;
  currency: FeeCurrency;
  method: FeePaymentMethod;
  reference: string | null;
  receivedOn: string;
  status: 'ACTIVE' | 'VOIDED';
};
export type CollectionPage = FinancePage<Collection> & {
  totals: { currency: FeeCurrency; amount: string; count: number }[];
};
export type FinanceClass = {
  id: string;
  name: string;
  grade: string;
  academicYear: string;
  yearStatus: string;
  studentCount: number;
};
export type FeeBatch = {
  id: string;
  classSectionId: string;
  className?: string;
  grade?: string;
  academicYear?: string;
  title: string;
  description: string | null;
  amount: string;
  currency: FeeCurrency;
  dueOn: string;
  studentCount: number;
  total: string;
  createdAt: string;
  voidedAt: string | null;
};
export type PaymentReceipt = {
  id: string;
  school: {
    name: string;
    code: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  student: FinanceStudent;
  fee: { title: string; amount: string; dueOn: string; currency: FeeCurrency; balance: string };
  payment: {
    amount: string;
    method: FeePaymentMethod;
    reference: string | null;
    note: string | null;
    receivedOn: string;
    createdAt: string;
    voidedAt: string | null;
    voidReason: string | null;
  };
};

export function formatMoney(amount: string, currency: FeeCurrency): string {
  return `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function localDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
