import type { TransactionInput, ImportTransactionsResult } from '../entities/Transaction';
import type { Account, Category } from '../entities/index';

export interface IActualBudgetService {
  init(): Promise<void>;
  downloadBudget(): Promise<void>;
  getAccounts(): Promise<Account[]>;
  getCategories(): Promise<Category[]>;
  addTransactions(accountId: string, transactions: TransactionInput[]): Promise<void>;
  importTransactions(accountId: string, transactions: TransactionInput[]): Promise<ImportTransactionsResult>;
  shutdown(): Promise<void>;
}
