import type { BudgetInfo, Category, Account } from '../../domain/entities/index';
import type { BudgetService } from '../../domain/interfaces/BudgetService';
import { PocketBaseService } from '../../infrastructure/database/pocketbase/PocketBaseService';
import { AddTransactionUseCase } from './AddTransactionUseCase';
import { GetBudgetProgressUseCase } from './GetBudgetProgressUseCase';
import { GetDailyBudgetReportUseCase, type DailyBudgetReport } from './GetDailyBudgetReportUseCase';
import type { BudgetProgress } from './GetBudgetProgressUseCase';

export class BudgetServiceImpl implements BudgetService {
  private addTransactionUseCase: AddTransactionUseCase;
  private getBudgetProgressUseCase: GetBudgetProgressUseCase;
  private getDailyBudgetReportUseCase: GetDailyBudgetReportUseCase;

  constructor() {
    const pocketbaseService = new PocketBaseService(
      process.env.POCKETBASE_URL || 'http://localhost:8091',
      process.env.POCKETBASE_TOKEN
    );

    this.addTransactionUseCase = new AddTransactionUseCase(pocketbaseService);
    this.getBudgetProgressUseCase = new GetBudgetProgressUseCase(pocketbaseService);
    this.getDailyBudgetReportUseCase = new GetDailyBudgetReportUseCase();
  }

  async addTransaction(tx: { title: string; amount: number; date: string; categoryId?: string }): Promise<void> {
    await this.addTransactionUseCase.execute([tx]);
  }

  async getBudgetProgress(): Promise<BudgetProgress[]> {
    return await this.getBudgetProgressUseCase.execute();
  }

  async getDailyBudgetReport(): Promise<DailyBudgetReport> {
    const budgets = await this.getBudgetProgressUseCase.execute();
    const budget = budgets[0];
    if (!budget) {
      throw new Error('No budget found');
    }
    const currentDate = new Date();
    const periodStart = new Date(budget.periodStart);
    const totalBudgetCents = Math.round(budget.budgetAmount * 100);
    const spentCents = Math.round(budget.spentAmount * 100);

    return await this.getDailyBudgetReportUseCase.execute(
      totalBudgetCents,
      spentCents,
      periodStart,
      currentDate
    );
  }
}
