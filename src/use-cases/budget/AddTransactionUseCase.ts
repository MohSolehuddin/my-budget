import type { IActualBudgetService } from '../../domain/interfaces/IActualBudgetService';
import type { TransactionInput } from '../../domain/entities/Transaction';
import type { BudgetInfo } from '../../domain/entities/index';
import type { PocketBaseService } from '../../infrastructure/database/pocketbase/PocketBaseService';

export class AddTransactionUseCase {
  constructor(
    private actualBudgetService: IActualBudgetService,
    private pocketbaseService: PocketBaseService
  ) {}

  async execute(
    accountId: string,
    transactions: { title: string; amount: number; date: string; categoryId?: string }[]
  ): Promise<{ message: string; transactionIds: string[] }> {
    if (!accountId) {
      throw new Error('accountId is required');
    }
    if (!transactions || transactions.length === 0) {
      throw new Error('At least one transaction is required');
    }

    const actualTransactions: TransactionInput[] = transactions.map((tx) => ({
      date: tx.date,
      amount: Math.round(tx.amount * 100),
      payee_name: tx.title,
      category: tx.categoryId || undefined,
      notes: `Created via Telegram Bot`,
    }));

    await this.actualBudgetService.addTransactions(accountId, actualTransactions);
    await this.pocketbaseService.saveTransactionsToPB(transactions);

    return {
      message: `Successfully added ${transactions.length} transaction(s)`,
      transactionIds: actualTransactions.map((_, i) => `tx_${Date.now()}_${i}`),
    };
  }
}
