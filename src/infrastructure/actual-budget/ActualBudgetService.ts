import type { IActualBudgetService } from '../../domain/interfaces/IActualBudgetService';
import type { TransactionInput, ImportTransactionsResult, Account, Category } from '../../domain/entities/index';

export class ActualBudgetService implements IActualBudgetService {
  private baseUrl: string;
  private apiKey: string;
  private syncId: string;

  constructor(
    serverUrl: string,
    password: string | undefined,
    syncId: string,
    _dataDir: string = './budget-data',
    _e2eePassword?: string
  ) {
    this.baseUrl = (process.env.ACTUAL_HTTP_API_URL || 'http://localhost:5007').replace(/\/$/, '');
    this.apiKey = process.env.ACTUAL_HTTP_API_KEY || '';
    this.syncId = syncId;
  }

  async init(): Promise<void> {
    if (!this.apiKey || !this.syncId) {
      throw new Error('Missing ACTUAL_HTTP_API_KEY or ACTUAL_SYNC_ID');
    }
    // Verify connection by fetching budgets
    const res = await this.request('GET', '/v1/budgets');
    const budgets = Array.isArray(res.data) ? res.data : [];
    const budget = budgets.find((b: any) => b.groupId === this.syncId);
    if (!budget) {
      throw new Error(`Budget sync id ${this.syncId} not found in Actual HTTP API`);
    }
  }

  async downloadBudget(): Promise<void> {
    // HTTP API opens budget per request, no local download needed
  }

  async getAccounts(): Promise<Account[]> {
    const res = await this.budgetRequest('GET', '/accounts');
    return (res.data || []).map((a: any) => ({ id: a.id, name: a.name }));
  }

  async getCategories(): Promise<Category[]> {
    const res = await this.budgetRequest('GET', '/categories');
    return (res.data || []).map((c: any) => ({ id: c.id, name: c.name }));
  }

  async addTransactions(accountId: string, transactions: TransactionInput[]): Promise<void> {
    await this.importTransactions(accountId, transactions);
  }

  async importTransactions(accountId: string, transactions: TransactionInput[]): Promise<ImportTransactionsResult> {
    const payload = transactions.map((tx) => ({
      account: accountId,
      date: tx.date,
      amount: tx.amount,
      payee_name: tx.payee_name,
      category: tx.category || undefined,
      notes: tx.notes || '',
      imported_id: tx.imported_id || `telegram-${Date.now()}`,
    }));

    const res = await this.budgetRequest(
      'POST',
      `/accounts/${accountId}/transactions/batch`,
      { transactions: payload, learnCategories: false, runTransfers: false }
    );

    return {
      added: res.message === 'ok' ? transactions.length : 0,
      updated: 0,
    };
  }

  async shutdown(): Promise<void> {
    // HTTP API is stateless
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    };
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Actual HTTP API ${method} ${path} failed: ${res.status} ${text}`);
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { data: text };
    }
  }

  private async budgetRequest(method: string, path: string, body?: any): Promise<any> {
    return this.request(method, `/v1/budgets/${this.syncId}${path}`, body);
  }
}
