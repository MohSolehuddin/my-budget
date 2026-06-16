import type { TransactionInput, ImportTransactionsResult } from './Transaction';

export type { TransactionInput, ImportTransactionsResult };

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  parent_id?: string;
  is_folder: boolean;
  sort_order: number;
}

export interface BudgetInfo {
  id: string;
  category_id: string;
  month: number;
  year: number;
  amount: number;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'cash' | 'investment' | 'other';
  balance: number;
  closed: boolean;
  sort_order: number;
}
