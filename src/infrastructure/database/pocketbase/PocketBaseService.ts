/**
 * Infrastructure service untuk PocketBase API.
 */
export class PocketBaseService {
  private apiUrl: string;
  private token?: string;

  constructor(url: string, token?: string) {
    this.apiUrl = url;
    this.token = token;
  }

  async getBudgets(categoryId?: string): Promise<any[]> {
    // Implementasi GET /api/budgets
    return [];
  }

  async getTransactionsByCategories(budgetIds: string[]): Promise<any[]> {
    // Implementasi GET /api/transactions?filter=budget_id IN ...
    return [];
  }

  async saveTransactionsToPB(transactions: any[]): Promise<void> {
    // Implementasi POST /api/transactions
    console.log(`[PB] Saving ${transactions.length} transactions to PocketBase`);
  }

  async saveBudgetToPB(budget: any): Promise<void> {
    // Implementasi POST /api/budgets
  }
}
