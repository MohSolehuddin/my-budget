/**
 * Infrastructure service untuk PocketBase API.
 */
export class PocketBaseService {
  private apiUrl: string;
  private token?: string;

  constructor(url: string, token?: string) {
    this.apiUrl = url.replace(/\/$/, '');
    this.token = token;
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.apiUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (this.token) {
      headers['Authorization'] = this.token.startsWith('Bearer ') ? this.token : `Bearer ${this.token}`;
    }

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`PocketBase ${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
    }
    const data = await response.json().catch(() => ({}));
    return data;
  }

  async getBudgets(categoryId?: string): Promise<any[]> {
    const params = new URLSearchParams();
    params.set('perPage', '500');
    params.set('expand', 'category,subcategory');
    if (categoryId) {
      params.set('filter', `category='${categoryId}'`);
    }
    const data = await this.request(`/api/collections/budgets/records?${params.toString()}`);
    return (data.items || []).map((item: any) => {
      const category = item.expand?.category;
      const subcategory = item.expand?.subcategory;
      return {
        id: item.id,
        categoryId: category?.id || item.category || '',
        subcategoryId: subcategory?.id || item.subcategory || '',
        name: subcategory?.name || category?.name || item.name || 'Budget',
        amount: item.amount || 0,
        periodStart: item.period_start || item.created || new Date().toISOString().split('T')[0],
        periodEnd: item.period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };
    });
  }

  async getTransactionsByCategories(categoryIds: string[]): Promise<any[]> {
    if (!categoryIds.length) return [];
    const filters = categoryIds.map((id) => `category='${id}'`).join(' || ');
    const params = new URLSearchParams();
    params.set('perPage', '500');
    params.set('expand', 'category,subcategory');
    params.set('filter', filters);
    const data = await this.request(`/api/collections/transactions/records?${params.toString()}`);
    return (data.items || []).map((item: any) => ({
      id: item.id,
      categoryId: item.category || '',
      subcategoryId: item.subcategory || '',
      amount: item.amount || 0,
      date: item.date,
      title: item.title,
    }));
  }

  async saveTransactionsToPB(transactions: any[]): Promise<void> {
    const categoryNames = [...new Set(transactions.map((tx) => tx.categoryId).filter(Boolean))];
    const categoryMap: Record<string, string> = {};

    for (const name of categoryNames) {
      const params = new URLSearchParams({ filter: `name='${name}'`, perPage: '1' });
      const data = await this.request(`/api/collections/budget_categories/records?${params.toString()}`);
      const record = data.items?.[0];
      if (record) {
        categoryMap[name as string] = record.id;
      }
    }

    for (const tx of transactions) {
      await this.request('/api/collections/transactions/records', {
        method: 'POST',
        body: JSON.stringify({
          title: tx.title,
          amount: tx.amount,
          date: tx.date || new Date().toISOString().split('T')[0],
          category: categoryMap[tx.categoryId] || null,
          subcategory: tx.subcategoryId || null,
          source: 'telegram',
        }),
      });
    }
    console.log(`[PB] Saved ${transactions.length} transaction(s) to PocketBase`);
  }

  async saveBudgetToPB(budget: any): Promise<void> {
    await this.request('/api/collections/budgets/records', {
      method: 'POST',
      body: JSON.stringify({
        category: budget.categoryId || null,
        subcategory: budget.subcategoryId || null,
        amount: budget.amount,
        period_start: budget.periodStart,
        period_end: budget.periodEnd,
      }),
    });
  }

  // ===== DEBTS =====

  private toDebt(item: any): any {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      creditor: item.creditor,
      originalAmount: item.original_amount || 0,
      remainingAmount: item.remaining_amount || 0,
      interestRate: item.interest_rate,
      currency: item.currency || 'IDR',
      type: item.type,
      status: item.status,
      startDate: item.start_date,
      dueDate: item.due_date,
      termMonths: item.term_months,
      installmentAmount: item.installment_amount,
      paymentDay: item.payment_day,
      autoDebit: item.auto_debit ?? false,
      linkedAccount: item.linked_account,
      notes: item.notes,
      deletedAt: item.deleted_at,
    };
  }

  async getDebts(): Promise<any[]> {
    const params = new URLSearchParams();
    params.set('perPage', '500');
    params.set('filter', "deleted_at=''");
    const data = await this.request(`/api/collections/debts/records?${params.toString()}`);
    return (data.items || []).map((item: any) => this.toDebt(item));
  }

  async getDebtById(id: string): Promise<any | null> {
    try {
      const data = await this.request(`/api/collections/debts/records/${id}`);
      return this.toDebt(data);
    } catch {
      return null;
    }
  }

  async createDebt(debt: Omit<any, 'id'>): Promise<any> {
    const body = {
      name: debt.name,
      description: debt.description,
      creditor: debt.creditor,
      original_amount: debt.originalAmount,
      remaining_amount: debt.remainingAmount,
      interest_rate: debt.interestRate,
      currency: debt.currency || 'IDR',
      type: debt.type,
      status: debt.status || 'active',
      start_date: debt.startDate,
      due_date: debt.dueDate,
      term_months: debt.termMonths,
      installment_amount: debt.installmentAmount,
      payment_day: debt.paymentDay,
      auto_debit: debt.autoDebit ?? false,
      linked_account: debt.linkedAccount,
      notes: debt.notes,
    };
    const data = await this.request('/api/collections/debts/records', { method: 'POST', body: JSON.stringify(body) });
    return this.toDebt(data);
  }

  async updateDebt(id: string, debt: Partial<any>): Promise<any> {
    const body: any = {};
    if (debt.name !== undefined) body.name = debt.name;
    if (debt.description !== undefined) body.description = debt.description;
    if (debt.creditor !== undefined) body.creditor = debt.creditor;
    if (debt.originalAmount !== undefined) body.original_amount = debt.originalAmount;
    if (debt.remainingAmount !== undefined) body.remaining_amount = debt.remainingAmount;
    if (debt.interestRate !== undefined) body.interest_rate = debt.interestRate;
    if (debt.currency !== undefined) body.currency = debt.currency;
    if (debt.type !== undefined) body.type = debt.type;
    if (debt.status !== undefined) body.status = debt.status;
    if (debt.startDate !== undefined) body.start_date = debt.startDate;
    if (debt.dueDate !== undefined) body.due_date = debt.dueDate;
    if (debt.termMonths !== undefined) body.term_months = debt.termMonths;
    if (debt.installmentAmount !== undefined) body.installment_amount = debt.installmentAmount;
    if (debt.paymentDay !== undefined) body.payment_day = debt.paymentDay;
    if (debt.autoDebit !== undefined) body.auto_debit = debt.autoDebit;
    if (debt.linkedAccount !== undefined) body.linked_account = debt.linkedAccount;
    if (debt.notes !== undefined) body.notes = debt.notes;
    const data = await this.request(`/api/collections/debts/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return this.toDebt(data);
  }

  async deleteDebt(id: string): Promise<void> {
    await this.request(`/api/collections/debts/records/${id}`, { method: 'DELETE' });
  }

  // ===== DEBT PAYMENTS =====

  private toPayment(item: any): any {
    return {
      id: item.id,
      debtId: item.debt,
      amount: item.amount,
      paymentDate: item.payment_date,
      paymentMethod: item.payment_method,
      notes: item.notes,
      isInstallment: item.is_installment ?? false,
      installmentNumber: item.installment_number,
      deletedAt: item.deleted_at,
    };
  }

  async getDebtPayments(debtId?: string): Promise<any[]> {
    const params = new URLSearchParams();
    params.set('perPage', '500');
    params.set('filter', "deleted_at=''");
    if (debtId) {
      params.set('filter', `debt='${debtId}' && deleted_at=''`);
    }
    const data = await this.request(`/api/collections/debt_payments/records?${params.toString()}`);
    return (data.items || []).map((item: any) => this.toPayment(item));
  }

  async createDebtPayment(payment: Omit<any, 'id'>): Promise<any> {
    const body = {
      debt: payment.debtId,
      amount: payment.amount,
      payment_date: payment.paymentDate,
      payment_method: payment.paymentMethod,
      notes: payment.notes,
      is_installment: payment.isInstallment ?? false,
      installment_number: payment.installmentNumber,
    };
    const data = await this.request('/api/collections/debt_payments/records', { method: 'POST', body: JSON.stringify(body) });

    // Update remaining amount on debt
    const debt = await this.getDebtById(payment.debtId);
    if (debt && debt.remainingAmount >= payment.amount) {
      const newRemaining = debt.remainingAmount - payment.amount;
      await this.updateDebt(payment.debtId, {
        remainingAmount: newRemaining,
        status: newRemaining <= 0 ? 'paid_off' : debt.status,
      });
    }

    return this.toPayment(data);
  }

  async deleteDebtPayment(id: string): Promise<void> {
    await this.request(`/api/collections/debt_payments/records/${id}`, { method: 'DELETE' });
  }
}
