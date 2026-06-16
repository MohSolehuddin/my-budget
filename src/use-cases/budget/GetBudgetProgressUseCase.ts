import type { IActualBudgetService } from '../../domain/interfaces/IActualBudgetService';
import type { BudgetInfo } from '../../domain/entities/index';
import type { PocketBaseService } from '../../infrastructure/database/pocketbase/PocketBaseService';

export class GetBudgetProgressUseCase {
  constructor(
    private actualBudgetService: IActualBudgetService,
    private pocketbaseService: PocketBaseService
  ) {}

  async execute(categoryId?: string): Promise<BudgetProgress[]> {
    const budgets = await this.pocketbaseService.getBudgets(categoryId);
    const transactions = await this.pocketbaseService.getTransactionsByCategories(
      budgets.map((b) => b.id)
    );

    return budgets.map((budget) => {
      const relatedTransactions = transactions.filter((t) => t.categoryId === budget.categoryId);
      const totalSpent = relatedTransactions.reduce((sum, t) => sum + t.amount, 0);

      return {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.name || '',
        budgetAmount: budget.amount,
        spentAmount: totalSpent,
        remainingAmount: budget.amount - totalSpent,
        remainingPercentage: ((budget.amount - totalSpent) / budget.amount) * 100,
        periodStart: budget.periodStart || new Date().toISOString().split('T')[0],
        periodEnd: budget.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };
    });
  }
}

export interface BudgetProgress {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  remainingPercentage: number;
  periodStart: string;
  periodEnd: string;
}
