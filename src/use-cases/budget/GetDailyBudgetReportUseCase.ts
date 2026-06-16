import type { BudgetProgress } from './GetBudgetProgressUseCase';

export class GetDailyBudgetReportUseCase {
  async execute(
    totalBudgetCents: number,
    spentCents: number,
    periodStart: Date,
    currentDate: Date
  ): Promise<DailyBudgetReport> {
    const daysElapsed = this.getDaysDifference(periodStart, currentDate);
    const daysInPeriod = 30; // Default bulan = 30 hari
    const daysRemaining = Math.max(0, daysInPeriod - daysElapsed);

    const remainingCents = totalBudgetCents - spentCents;
    const dailyAllowanceCents = Math.ceil(totalBudgetCents / daysInPeriod);
    const projectedSpendPerDay = daysElapsed > 0 ? spentCents / daysElapsed : 0;

    return {
      totalBudget: totalBudgetCents / 100,
      spent: spentCents / 100,
      remaining: remainingCents / 100,
      dailyAllowance: dailyAllowanceCents / 100,
      daysRemaining,
      projectedSpendPerDay: projectedSpendPerDay / 100,
      remainingPercentage: (remainingCents / totalBudgetCents) * 100,
    };
  }

  private getDaysDifference(start: Date, end: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = Math.round((end.getTime() - start.getTime()) / oneDay);
    return Math.max(0, diff);
  }
}

export interface DailyBudgetReport {
  totalBudget: number;
  spent: number;
  remaining: number;
  dailyAllowance: number;
  daysRemaining: number;
  projectedSpendPerDay: number;
  remainingPercentage: number;
}
