import type { Debt, DebtPayment, DebtSummary } from '../entities/Debt';

export interface DebtRepository {
  getAll(): Promise<Debt[]>;
  getById(id: string): Promise<Debt | null>;
  create(debt: Omit<Debt, 'id'>): Promise<Debt>;
  update(id: string, debt: Partial<Debt>): Promise<Debt>;
  delete(id: string): Promise<void>;

  getPayments(debtId?: string): Promise<DebtPayment[]>;
  addPayment(payment: Omit<DebtPayment, 'id'>): Promise<DebtPayment>;
  deletePayment(id: string): Promise<void>;

  getSummary(): Promise<DebtSummary>;
}
