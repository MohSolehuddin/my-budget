/**
 * Input type for creating a transaction in Actual Budget.
 * Amounts are integers without decimal places (e.g., $12.50 = 1250, -$15.00 = -1500).
 * Dates use YYYY-MM-DD format.
 */
export interface TransactionInput {
  /** Required. Transaction date in YYYY-MM-DD format */
  date: string;
  /** Amount as integer without decimals (e.g., $120.30 = 12030) */
  amount?: number;
  /** Existing payee ID — overrides payee_name if set */
  payee?: string | null;
  /** If given, a payee will be created with this name or matched to existing */
  payee_name?: string;
  /** Raw description from the bank import */
  imported_payee?: string;
  /** Category ID to assign */
  category?: string;
  /** Additional notes */
  notes?: string;
  /** Unique ID from the bank, used to avoid duplicate transactions */
  imported_id?: string;
  /** Transfer ID (only set when importing) */
  transfer_id?: string;
  /** Whether the transaction has cleared */
  cleared?: boolean;
  /** Split transaction subtransactions */
  subtransactions?: Array<{
    amount: number;
    category?: string;
    notes?: string;
  }>;
}

/**
 * Result from import operations that includes dedup info.
 */
export interface ImportTransactionsResult {
  /** Number of new transactions added */
  added: number;
  /** Number of existing transactions updated */
  updated: number;
  /** Number of transactions skipped (duplicates) */
  skipped?: number;
  /** Any errors that occurred */
  errors?: string[];
}
