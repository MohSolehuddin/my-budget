import type { PocketBaseService } from '../../infrastructure/database/pocketbase/PocketBaseService';

export class AddTransactionUseCase {
  constructor(
    private pocketbaseService: PocketBaseService
  ) {}

  async execute(
    transactions: { title: string; amount: number; date: string; categoryId?: string }[]
  ): Promise<{ message: string }> {
    if (!transactions || transactions.length === 0) {
      throw new Error('At least one transaction is required');
    }

    await this.pocketbaseService.saveTransactionsToPB(transactions);

    return {
      message: `Successfully added ${transactions.length} transaction(s)`,
    };
  }
}
