import type { IActualBudgetService } from '../../domain/interfaces/IActualBudgetService';
import type { TransactionInput, ImportTransactionsResult, Account, Category } from '../../domain/entities/index';

export class ActualBudgetService implements IActualBudgetService {
  private serverUrl: string;
  private password?: string;
  private syncId: string;
  private dataDir: string;
  private e2eePassword?: string;
  private isInitialized = false;

  constructor(
    serverUrl: string,
    password: string | undefined,
    syncId: string,
    dataDir: string = './budget-data',
    e2eePassword?: string
  ) {
    this.serverUrl = serverUrl;
    this.password = password;
    this.syncId = syncId;
    this.dataDir = dataDir;
    this.e2eePassword = e2eePassword;
  }

  async init(): Promise<void> {
    if (this.isInitialized) {
      console.log('Actual Budget already initialized, skipping...');
      return;
    }

    if (!this.serverUrl || !this.password || !this.syncId) {
      throw new Error('Missing serverUrl, password, or syncId for Actual Budget');
    }

    const api = await import('@actual-app/api');
    await api.init({
      serverURL: this.serverUrl,
      password: this.password,
      dataDir: this.dataDir,
    });

    this.isInitialized = true;
  }

  async downloadBudget(): Promise<void> {
    this.ensureInitialized();
    const api = await import('@actual-app/api');
    const options: Record<string, unknown> = {};
    if (this.e2eePassword) {
      options.password = this.e2eePassword;
    }
    await api.downloadBudget(this.syncId, options);
  }

  async getAccounts(): Promise<Account[]> {
    this.ensureInitialized();
    const api = await import('@actual-app/api');
    return await api.getAccounts() as Account[];
  }

  async getCategories(): Promise<Category[]> {
    this.ensureInitialized();
    const api = await import('@actual-app/api');
    return await api.getCategories() as Category[];
  }

  async addTransactions(accountId: string, transactions: TransactionInput[]): Promise<void> {
    this.ensureInitialized();
    const api = await import('@actual-app/api');
    await api.addTransactions(accountId, transactions);
  }

  async importTransactions(accountId: string, transactions: TransactionInput[]): Promise<ImportTransactionsResult> {
    this.ensureInitialized();
    const api = await import('@actual-app/api');
    const transactionsWithAccount = transactions.map(tx => ({ ...tx, account: accountId }));
    const result = await api.importTransactions(accountId, transactionsWithAccount);
    return {
      added: result?.added?.length ?? 0,
      updated: result?.updated?.length ?? 0,
    };
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;
    try {
      const api = await import('@actual-app/api');
      await api.shutdown();
      this.isInitialized = false;
      console.log('Actual Budget shut down cleanly.');
    } catch (error) {
      console.error('Error shutting down Actual Budget:', error);
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ActualBudgetService is not initialized. Call init() first.');
    }
  }
}
