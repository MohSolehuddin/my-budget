import type { DailyBudgetReport } from '../../use-cases/budget/GetDailyBudgetReportUseCase';

export interface BudgetService {
  getBudgetProgress(): Promise<any[]>;
  getDailyBudgetReport(): Promise<DailyBudgetReport>;
  addTransaction(tx: { title: string; amount: number; date: string; categoryId?: string }): Promise<void>;
}
