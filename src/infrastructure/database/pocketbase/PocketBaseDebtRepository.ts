import type { DebtRepository } from '../../../domain/interfaces/DebtRepository';
import type { Debt, DebtPayment, DebtSummary, UpcomingPayment } from '../../../domain/entities/Debt';
import type { PocketBaseService } from './PocketBaseService';

export class PocketBaseDebtRepository implements DebtRepository {
  constructor(private pb: PocketBaseService) {}

  async getAll(): Promise<Debt[]> {
    return this.pb.getDebts();
  }

  async getById(id: string): Promise<Debt | null> {
    return this.pb.getDebtById(id);
  }

  async create(debt: Omit<Debt, 'id'>): Promise<Debt> {
    return this.pb.createDebt(debt);
  }

  async update(id: string, debt: Partial<Debt>): Promise<Debt> {
    return this.pb.updateDebt(id, debt);
  }

  async delete(id: string): Promise<void> {
    return this.pb.deleteDebt(id);
  }

  async getPayments(debtId?: string): Promise<DebtPayment[]> {
    return this.pb.getDebtPayments(debtId);
  }

  async addPayment(payment: Omit<DebtPayment, 'id'>): Promise<DebtPayment> {
    return this.pb.createDebtPayment(payment);
  }

  async deletePayment(id: string): Promise<void> {
    return this.pb.deleteDebtPayment(id);
  }

  async getSummary(): Promise<DebtSummary> {
    const debts = await this.getAll();
    const payments = await this.getPayments();

    const activeDebts = debts.filter((d) => d.status === 'active');
    const paidOffDebts = debts.filter((d) => d.status === 'paid_off');

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    const today = new Date();
    const upcomingPayments: UpcomingPayment[] = activeDebts
      .map((d) => {
        const due = d.dueDate ? new Date(d.dueDate) : undefined;
        const daysUntilDue = due ? Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 9999;
        return {
          debtId: d.id,
          name: d.name,
          amount: d.installmentAmount || d.remainingAmount,
          dueDate: d.dueDate,
          paymentDay: d.paymentDay,
          daysUntilDue,
        };
      })
      .filter((u) => u.daysUntilDue <= 30)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    return {
      totalDebt: debts.reduce((sum, d) => sum + d.originalAmount, 0),
      totalRemaining: debts.reduce((sum, d) => sum + d.remainingAmount, 0),
      totalPaid,
      activeDebts: activeDebts.length,
      paidOffDebts: paidOffDebts.length,
      upcomingPayments,
    };
  }
}
