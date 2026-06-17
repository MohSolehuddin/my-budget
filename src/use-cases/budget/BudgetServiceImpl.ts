import type { IActualBudgetService } from '../../domain/interfaces/IActualBudgetService';
import type { TransactionInput } from '../../domain/entities/Transaction';
import type { BudgetInfo, Category, Account } from '../../domain/entities/index';
import type { BudgetService } from '../../domain/interfaces/BudgetService';
import { ActualBudgetService } from '../../infrastructure/actual-budget/ActualBudgetService';
import { PocketBaseService } from '../../infrastructure/database/pocketbase/PocketBaseService';
import { AddTransactionUseCase } from './AddTransactionUseCase';
import { GetBudgetProgressUseCase } from './GetBudgetProgressUseCase';
import { GetDailyBudgetReportUseCase, type DailyBudgetReport } from './GetDailyBudgetReportUseCase';
import type { BudgetProgress } from './GetBudgetProgressUseCase';

export class BudgetServiceImpl implements BudgetService {
  private addTransactionUseCase: AddTransactionUseCase;
  private getBudgetProgressUseCase: GetBudgetProgressUseCase;
  private getDailyBudgetReportUseCase: GetDailyBudgetReportUseCase;
  private actualBudgetService: IActualBudgetService;

  constructor() {
    this.actualBudgetService = new ActualBudgetService(
      process.env.ACTUAL_SERVER_URL || 'http://localhost:3001',
      process.env.ACTUAL_PASSWORD || '',
      process.env.ACTUAL_SYNC_ID || 'my-budget-sync',
      process.env.ACTUAL_DATA_DIR || './budget-data',
      process.env.ACTUAL_E2EE_PASSWORD
    );

    const pocketbaseService = new PocketBaseService(
      process.env.POCKETBASE_URL || 'http://localhost:8091',
      process.env.POCKETBASE_TOKEN
    );

    this.addTransactionUseCase = new AddTransactionUseCase(this.actualBudgetService, pocketbaseService);
    this.getBudgetProgressUseCase = new GetBudgetProgressUseCase(this.actualBudgetService, pocketbaseService);
    this.getDailyBudgetReportUseCase = new GetDailyBudgetReportUseCase();
  }

  async addTransaction(tx: { title: string; amount: number; date: string; categoryId?: string }): Promise<void> {
    await this.actualBudgetService.init();
    await this.actualBudgetService.downloadBudget();
    const accounts = await this.actualBudgetService.getAccounts();
    const account = accounts.find((a) => a.id === process.env.ACTUAL_DEFAULT_ACCOUNT_ID) || accounts[0];
    if (!account) {
      throw new Error('No Actual Budget account found');
    }
    await this.addTransactionUseCase.execute(account.id, [tx]);
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
