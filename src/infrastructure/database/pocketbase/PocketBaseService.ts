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

  async getTransactions(filters?: { categoryId?: string; startDate?: string; endDate?: string }): Promise<any[]> {
    const params = new URLSearchParams();
    params.set('perPage', '500');
    params.set('expand', 'category,subcategory');
    params.set('sort', '-date');
    const filterParts: string[] = [];
    if (filters?.categoryId) filterParts.push(`category='${filters.categoryId}'`);
    if (filters?.startDate) filterParts.push(`date>='${filters.startDate}'`);
    if (filters?.endDate) filterParts.push(`date<='${filters.endDate}'`);
    if (filterParts.length) params.set('filter', filterParts.join(' && '));
    const data = await this.request(`/api/collections/transactions/records?${params.toString()}`);
    return (data.items || []).map((item: any) => ({
      id: item.id,
      categoryId: item.category || '',
      subcategoryId: item.subcategory || '',
      amount: item.amount || 0,
      date: item.date,
      title: item.title,
      notes: item.notes,
      source: item.source,
    }));
  }

  async updateTransaction(id: string, data: Partial<{ title: string; amount: number; date: string; categoryId: string; notes: string }>): Promise<any> {
    const body: any = {};
    if (data.title !== undefined) body.title = data.title;
    if (data.amount !== undefined) body.amount = data.amount;
    if (data.date !== undefined) body.date = data.date;
    if (data.categoryId !== undefined) body.category = data.categoryId;
    if (data.notes !== undefined) body.notes = data.notes;
    const result = await this.request(`/api/collections/transactions/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return result;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.request(`/api/collections/transactions/records/${id}`, { method: 'DELETE' });
  }

  async getCategories(): Promise<any[]> {
    const params = new URLSearchParams();
    params.set('perPage', '500');
    const data = await this.request(`/api/collections/budget_categories/records?${params.toString()}`);
    return (data.items || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      icon: item.icon,
      color: item.color,
    }));
  }

  async createCategory(cat: { name: string; icon?: string; color?: string }): Promise<any> {
    const data = await this.request('/api/collections/budget_categories/records', {
      method: 'POST',
      body: JSON.stringify({
        name: cat.name,
        slug: cat.name.toLowerCase().replace(/\s+/g, '-'),
        icon: cat.icon || '',
        color: cat.color || '#3b82f6',
      }),
    });
    return data;
  }

  async updateCategory(id: string, cat: { name?: string; icon?: string; color?: string }): Promise<any> {
    const body: any = {};
    if (cat.name !== undefined) { body.name = cat.name; body.slug = cat.name.toLowerCase().replace(/\s+/g, '-'); }
    if (cat.icon !== undefined) body.icon = cat.icon;
    if (cat.color !== undefined) body.color = cat.color;
    return this.request(`/api/collections/budget_categories/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.request(`/api/collections/budget_categories/records/${id}`, { method: 'DELETE' });
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

  async saveBudgetToPB(budget: any): Promise<any> {
    const data = await this.request('/api/collections/budgets/records', {
      method: 'POST',
      body: JSON.stringify({
        category: budget.categoryId || null,
        subcategory: budget.subcategoryId || null,
        amount: budget.amount,
        period_start: budget.periodStart,
        period_end: budget.periodEnd,
      }),
    });
    return data;
  }

  async updateBudget(id: string, budget: Partial<{ categoryId: string; subcategoryId: string; amount: number; periodStart: string; periodEnd: string }>): Promise<any> {
    const body: any = {};
    if (budget.categoryId !== undefined) body.category = budget.categoryId;
    if (budget.subcategoryId !== undefined) body.subcategory = budget.subcategoryId;
    if (budget.amount !== undefined) body.amount = budget.amount;
    if (budget.periodStart !== undefined) body.period_start = budget.periodStart;
    if (budget.periodEnd !== undefined) body.period_end = budget.periodEnd;
    const data = await this.request(`/api/collections/budgets/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return data;
  }

  async deleteBudget(id: string): Promise<void> {
    await this.request(`/api/collections/budgets/records/${id}`, { method: 'DELETE' });
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
    if (debtId) {
      params.set('filter', `debt='${debtId}'`);
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

  async updateDebtPayment(id: string, payment: { amount?: number; paymentDate?: string; paymentMethod?: string; notes?: string }): Promise<any> {
    const body: any = {};
    if (payment.amount !== undefined) body.amount = payment.amount;
    if (payment.paymentDate !== undefined) body.payment_date = payment.paymentDate;
    if (payment.paymentMethod !== undefined) body.payment_method = payment.paymentMethod;
    if (payment.notes !== undefined) body.notes = payment.notes;
    return this.request(`/api/collections/debt_payments/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  // ===== POCKETS =====

  async getPockets(): Promise<any[]> {
    const params = new URLSearchParams();
    params.set('perPage', '500');
    const data = await this.request(`/api/collections/pockets/records?${params.toString()}`);
    return (data.items || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      balance: item.balance || 0,
      icon: item.icon,
      color: item.color,
      type: item.type,
      notes: item.notes,
      isArchived: item.is_archived ?? false,
    }));
  }

  async createPocket(pocket: { name: string; balance: number; icon?: string; color?: string; type?: string; notes?: string }): Promise<any> {
    const body: any = {
      name: pocket.name,
      balance: pocket.balance || 0,
      icon: pocket.icon || '',
      color: pocket.color || '#3b82f6',
      type: pocket.type || 'cash',
      notes: pocket.notes || '',
      is_archived: false,
    };
    const data = await this.request('/api/collections/pockets/records', { method: 'POST', body: JSON.stringify(body) });
    return data;
  }

  async updatePocket(id: string, pocket: Partial<{ name: string; balance: number; icon: string; color: string; type: string; notes: string; isArchived: boolean }>): Promise<any> {
    const body: any = {};
    if (pocket.name !== undefined) body.name = pocket.name;
    if (pocket.balance !== undefined) body.balance = pocket.balance;
    if (pocket.icon !== undefined) body.icon = pocket.icon;
    if (pocket.color !== undefined) body.color = pocket.color;
    if (pocket.type !== undefined) body.type = pocket.type;
    if (pocket.notes !== undefined) body.notes = pocket.notes;
    if (pocket.isArchived !== undefined) body.is_archived = pocket.isArchived;
    return this.request(`/api/collections/pockets/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async deletePocket(id: string): Promise<void> {
    await this.request(`/api/collections/pockets/records/${id}`, { method: 'DELETE' });
  }

  async transferBetweenPockets(fromId: string, toId: string, amount: number): Promise<void> {
    const from = (await this.getPockets()).find(p => p.id === fromId);
    const to = (await this.getPockets()).find(p => p.id === toId);
    if (!from || !to) throw new Error('Pocket not found');
    if (from.balance < amount) throw new Error('Insufficient balance');
    await this.updatePocket(fromId, { balance: from.balance - amount });
    await this.updatePocket(toId, { balance: to.balance + amount });
  }
}
