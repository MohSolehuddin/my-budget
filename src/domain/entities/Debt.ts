export type DebtType = 'paylater' | 'credit_card' | 'loan' | 'installment' | 'other';
export type DebtStatus = 'active' | 'paid_off' | 'defaulted' | 'on_hold';

export interface Debt {
  id: string;
  name: string;
  description?: string;
  creditor?: string;
  originalAmount: number;
  remainingAmount: number;
  interestRate?: number;
  currency: string;
  type: DebtType;
  status: DebtStatus;
  startDate: string;
  dueDate?: string;
  termMonths?: number;
  installmentAmount?: number;
  paymentDay?: number;
  autoDebit: boolean;
  linkedAccount?: string;
  notes?: string;
  deletedAt?: string;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  notes?: string;
  isInstallment: boolean;
  installmentNumber?: number;
  deletedAt?: string;
}

export interface DebtSummary {
  totalDebt: number;
  totalRemaining: number;
  totalPaid: number;
  activeDebts: number;
  paidOffDebts: number;
  upcomingPayments: UpcomingPayment[];
}

export interface UpcomingPayment {
  debtId: string;
  name: string;
  amount: number;
  dueDate?: string;
  paymentDay?: number;
  daysUntilDue: number;
}
