import type { DebtRepository } from '../../domain/interfaces/DebtRepository';
import type { Debt, DebtPayment } from '../../domain/entities/Debt';

export class CreateDebtUseCase {
  constructor(private repo: DebtRepository) {}

  async execute(debt: Omit<Debt, 'id'>): Promise<Debt> {
    return this.repo.create(debt);
  }
}

export class ListDebtsUseCase {
  constructor(private repo: DebtRepository) {}

  async execute(): Promise<Debt[]> {
    return this.repo.getAll();
  }
}

export class GetDebtSummaryUseCase {
  constructor(private repo: DebtRepository) {}

  async execute(): Promise<any> {
    return this.repo.getSummary();
  }
}

export class PayDebtUseCase {
  constructor(private repo: DebtRepository) {}

  async execute(payment: Omit<DebtPayment, 'id'>): Promise<DebtPayment> {
    if (!payment.debtId) throw new Error('debtId is required');
    if (!payment.amount || payment.amount <= 0) throw new Error('amount must be positive');
    return this.repo.addPayment(payment);
  }
}

export class ListDebtPaymentsUseCase {
  constructor(private repo: DebtRepository) {}

  async execute(debtId?: string): Promise<DebtPayment[]> {
    return this.repo.getPayments(debtId);
  }
}
