import type { IActualBudgetService } from '../../domain/interfaces/IActualBudgetService';
import type { TransactionInput } from '../../domain/entities/Transaction';
import type { BudgetInfo, Category, Account } from '../../domain/entities/index';

export class DailyAllowanceService {
  private actualBudgetService: IActualBudgetService;

  constructor(actualBudgetService: IActualBudgetService) {
    this.actualBudgetService = actualBudgetService;
  }

  public calculateDailyAllowance(budgetAmount: number, periodDays: number): number {
    if (periodDays <= 0) {
      throw new Error('Period days must be greater than 0');
    }
    return Math.ceil(budgetAmount / periodDays);
  }

  public getBudgetSummary(
    totalBudgetCents: number,
    spentCents: number,
    startDate: Date,
    currentDate: Date
  ): {
    remainingCents: number;
    remainingPercentage: number;
    daysRemaining: number;
    dailyAllowanceCents: number;
    projectedSpendPerDay: number;
  } {
    const daysElapsed = this.getDaysDifference(startDate, currentDate);
    const daysInPeriod = 30;
    const daysRemaining = Math.max(0, daysInPeriod - daysElapsed);

    const remainingCents = totalBudgetCents - spentCents;
    const remainingPercentage = (remainingCents / totalBudgetCents) * 100;
    const dailyAllowanceCents = Math.ceil(totalBudgetCents / daysInPeriod);
    const projectedSpendPerDay = daysElapsed > 0 ? spentCents / daysElapsed : 0;

    return {
      remainingCents,
      remainingPercentage,
      daysRemaining,
      dailyAllowanceCents,
      projectedSpendPerDay,
    };
  }

  private getDaysDifference(start: Date, end: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = Math.round((end.getTime() - start.getTime()) / oneDay);
    return Math.max(0, diff);
  }
}
