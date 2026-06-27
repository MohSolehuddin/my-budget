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

  async request(path: string, options: RequestInit = {}): Promise<any> {
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

  /**
   * Verify that a user ID exists in PocketBase.
   * Returns true if valid, false if user not found or error.
   */
  async verifyUserId(userId: string): Promise<boolean> {
    try {
      await this.request(`/api/collections/users/records/${userId}`);
      return true;
    } catch {
      return false;
    }
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
    params.set('expand', 'category,subcategory,pocket');
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
      pocketId: item.pocket || '',
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
    try {
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
        accountNumber: item.account_number || '',
        bankName: item.bank_name || '',
        isArchived: item.is_archived ?? false,
      }));
    } catch {
      return [];
    }
  }

  async createPocket(pocket: { name: string; balance: number; icon?: string; color?: string; type?: string; notes?: string; accountNumber?: string; bankName?: string }): Promise<any> {
    const body: any = {
      name: pocket.name,
      balance: pocket.balance || 0,
      icon: pocket.icon || '',
      color: pocket.color || '#3b82f6',
      type: pocket.type || 'cash',
      notes: pocket.notes || '',
      account_number: pocket.accountNumber || '',
      bank_name: pocket.bankName || '',
      is_archived: false,
    };
    const data = await this.request('/api/collections/pockets/records', { method: 'POST', body: JSON.stringify(body) });
    return data;
  }

  async updatePocket(id: string, pocket: Partial<{ name: string; balance: number; icon: string; color: string; type: string; notes: string; accountNumber: string; bankName: string; isArchived: boolean }>): Promise<any> {
    const body: any = {};
    if (pocket.name !== undefined) body.name = pocket.name;
    if (pocket.balance !== undefined) body.balance = pocket.balance;
    if (pocket.icon !== undefined) body.icon = pocket.icon;
    if (pocket.color !== undefined) body.color = pocket.color;
    if (pocket.type !== undefined) body.type = pocket.type;
    if (pocket.notes !== undefined) body.notes = pocket.notes;
    if (pocket.accountNumber !== undefined) body.account_number = pocket.accountNumber;
    if (pocket.bankName !== undefined) body.bank_name = pocket.bankName;
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

  // ===== CUTOFFS =====

  async getCutoffs(): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.set('perPage', '100');
      params.set('sort', '-cutoff_date');
      const data = await this.request(`/api/collections/cutoffs/records?${params.toString()}`);
      return (data.items || []).map((item: any) => ({
        id: item.id,
        title: item.title || '',
        cutoffDate: item.cutoff_date || '',
        notes: item.notes || '',
        userId: item.user || '',
        created: item.created || '',
      }));
    } catch {
      return [];
    }
  }

  async getLatestCutoffDate(): Promise<string | null> {
    try {
      const cutoffs = await this.getCutoffs();
      if (!cutoffs.length) return null;
      // Already sorted by -cutoff_date, take first
      return cutoffs[0].cutoffDate?.split('T')[0] || cutoffs[0].cutoffDate || null;
    } catch {
      return null;
    }
  }

  async createCutoff(cutoff: { title: string; cutoffDate: string; notes?: string; userId?: string }): Promise<any> {
    const body: any = {
      title: cutoff.title,
      cutoff_date: cutoff.cutoffDate,
      notes: cutoff.notes || '',
    };
    if (cutoff.userId) body.user = cutoff.userId;
    const data = await this.request('/api/collections/cutoffs/records', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return data;
  }

  async updateCutoff(id: string, cutoff: Partial<{ title: string; cutoffDate: string; notes: string }>): Promise<any> {
    const body: any = {};
    if (cutoff.title !== undefined) body.title = cutoff.title;
    if (cutoff.cutoffDate !== undefined) body.cutoff_date = cutoff.cutoffDate;
    if (cutoff.notes !== undefined) body.notes = cutoff.notes;
    return this.request(`/api/collections/cutoffs/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async deleteCutoff(id: string): Promise<void> {
    await this.request(`/api/collections/cutoffs/records/${id}`, { method: 'DELETE' });
  }

  // ===== SAVINGS TARGETS =====

  private toSavingsTarget(item: any): any {
    const pocket = item.expand?.pocket;
    return {
      id: item.id,
      title: item.title || '',
      targetAmount: item.target_amount || 0,
      currentAmount: item.current_amount || 0,
      pocketId: item.pocket || '',
      pocketName: pocket?.name || '',
      targetDate: item.target_date || '',
      status: item.status || 'active',
      icon: item.icon || '',
      color: item.color || '#3b82f6',
      notes: item.notes || '',
      userId: item.user || '',
      targetType: item.target_type || 'pocket',
      created: item.created || '',
      updated: item.updated || '',
    };
  }

  async getSavingsTargets(filters?: { pocketId?: string; status?: string }): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.set('perPage', '500');
      params.set('expand', 'pocket');
      const filterParts: string[] = [];
      if (filters?.pocketId) filterParts.push(`pocket='${filters.pocketId}'`);
      if (filters?.status) filterParts.push(`status='${filters.status}'`);
      if (filterParts.length) params.set('filter', filterParts.join(' && '));
      const data = await this.request(`/api/collections/savings_targets/records?${params.toString()}`);
      return (data.items || []).map((item: any) => this.toSavingsTarget(item));
    } catch {
      return [];
    }
  }

  async createSavingsTarget(target: { title: string; targetAmount: number; currentAmount?: number; pocketId?: string; targetDate?: string; status?: string; icon?: string; color?: string; notes?: string; userId?: string; targetType?: string }): Promise<any> {
    const body: any = {
      title: target.title,
      target_amount: target.targetAmount,
      current_amount: target.currentAmount || 0,
      status: target.status || 'active',
      icon: target.icon || '',
      color: target.color || '#3b82f6',
      notes: target.notes || '',
    };
    if (target.pocketId) body.pocket = target.pocketId;
    if (target.targetDate) body.target_date = target.targetDate;
    if (target.userId) body.user = target.userId;
    if (target.targetType) body.target_type = target.targetType;
    const data = await this.request('/api/collections/savings_targets/records', { method: 'POST', body: JSON.stringify(body) });
    return this.toSavingsTarget(data);
  }

  async updateSavingsTarget(id: string, target: Partial<{ title: string; targetAmount: number; currentAmount: number; pocketId: string; targetDate: string; status: string; icon: string; color: string; notes: string; targetType: string }>): Promise<any> {
    const body: any = {};
    if (target.title !== undefined) body.title = target.title;
    if (target.targetAmount !== undefined) body.target_amount = target.targetAmount;
    if (target.currentAmount !== undefined) body.current_amount = target.currentAmount;
    if (target.pocketId !== undefined) body.pocket = target.pocketId;
    if (target.targetDate !== undefined) body.target_date = target.targetDate;
    if (target.status !== undefined) body.status = target.status;
    if (target.icon !== undefined) body.icon = target.icon;
    if (target.color !== undefined) body.color = target.color;
    if (target.notes !== undefined) body.notes = target.notes;
    if (target.targetType !== undefined) body.target_type = target.targetType;
    const data = await this.request(`/api/collections/savings_targets/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return this.toSavingsTarget(data);
  }

  async deleteSavingsTarget(id: string): Promise<void> {
    await this.request(`/api/collections/savings_targets/records/${id}`, { method: 'DELETE' });
  }

  // ===== RECURRING TRANSACTIONS =====

  private toRecurringTransaction(item: any): any {
    const category = item.expand?.category;
    const pocket = item.expand?.pocket;
    return {
      id: item.id,
      title: item.title || '',
      amount: item.amount || 0,
      type: item.type || 'expense',
      categoryId: item.category || '',
      categoryName: category?.name || '',
      pocketId: item.pocket || '',
      pocketName: pocket?.name || '',
      dayOfMonth: item.day_of_month || 1,
      frequency: item.frequency || 'monthly',
      startDate: item.start_date || '',
      endDate: item.end_date || '',
      isActive: item.is_active ?? true,
      lastGenerated: item.last_generated || '',
      notes: item.notes || '',
      userId: item.user || '',
      created: item.created || '',
      updated: item.updated || '',
    };
  }

  async getRecurringTransactions(filters?: { pocketId?: string; isActive?: boolean }): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.set('perPage', '500');
      params.set('expand', 'category,pocket');
      const filterParts: string[] = [];
      if (filters?.pocketId) filterParts.push(`pocket='${filters.pocketId}'`);
      if (filters?.isActive !== undefined) filterParts.push(`is_active=${filters.isActive}`);
      if (filterParts.length) params.set('filter', filterParts.join(' && '));
      const data = await this.request(`/api/collections/recurring_transactions/records?${params.toString()}`);
      return (data.items || []).map((item: any) => this.toRecurringTransaction(item));
    } catch {
      return [];
    }
  }

  async createRecurringTransaction(rt: { title: string; amount: number; type: string; categoryId?: string; pocketId?: string; dayOfMonth: number; frequency?: string; startDate?: string; endDate?: string; isActive?: boolean; notes?: string; userId?: string }): Promise<any> {
    const body: any = {
      title: rt.title,
      amount: rt.amount,
      type: rt.type,
      day_of_month: rt.dayOfMonth,
      frequency: rt.frequency || 'monthly',
      is_active: rt.isActive ?? true,
      notes: rt.notes || '',
    };
    if (rt.categoryId) body.category = rt.categoryId;
    if (rt.pocketId) body.pocket = rt.pocketId;
    body.start_date = rt.startDate || new Date().toISOString().split('T')[0];
    if (rt.endDate) body.end_date = rt.endDate;
    if (rt.userId) body.user = rt.userId;
    const data = await this.request('/api/collections/recurring_transactions/records', { method: 'POST', body: JSON.stringify(body) });
    return this.toRecurringTransaction(data);
  }

  async updateRecurringTransaction(id: string, rt: Partial<{ title: string; amount: number; type: string; categoryId: string; pocketId: string; dayOfMonth: number; frequency: string; startDate: string; endDate: string; isActive: boolean; notes: string }>): Promise<any> {
    const body: any = {};
    if (rt.title !== undefined) body.title = rt.title;
    if (rt.amount !== undefined) body.amount = rt.amount;
    if (rt.type !== undefined) body.type = rt.type;
    if (rt.categoryId !== undefined) body.category = rt.categoryId;
    if (rt.pocketId !== undefined) body.pocket = rt.pocketId;
    if (rt.dayOfMonth !== undefined) body.day_of_month = rt.dayOfMonth;
    if (rt.frequency !== undefined) body.frequency = rt.frequency;
    if (rt.startDate !== undefined) body.start_date = rt.startDate;
    if (rt.endDate !== undefined) body.end_date = rt.endDate;
    if (rt.isActive !== undefined) body.is_active = rt.isActive;
    if (rt.notes !== undefined) body.notes = rt.notes;
    const data = await this.request(`/api/collections/recurring_transactions/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return this.toRecurringTransaction(data);
  }

  async deleteRecurringTransaction(id: string): Promise<void> {
    await this.request(`/api/collections/recurring_transactions/records/${id}`, { method: 'DELETE' });
  }

  /**
   * Auto-generate transactions for active recurring_transactions whose
   * day_of_month has passed in the current month and last_generated < current month.
   * For each due recurring record, creates a transaction and updates last_generated.
   */
  async generateRecurringTransactions(): Promise<{ generated: number; errors: number }> {
    const result = { generated: 0, errors: 0 };
    try {
      const recurring = await this.getRecurringTransactions({ isActive: true });
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed
      const today = now.getDate();
      const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

      for (const rt of recurring) {
        try {
          // Check end_date
          if (rt.endDate && new Date(rt.endDate) < now) continue;

          // Check start_date
          if (rt.startDate && new Date(rt.startDate) > now) continue;

          // Check if already generated this month
          if (rt.lastGenerated && rt.lastGenerated.startsWith(currentMonthStr)) continue;

          // Check if day_of_month has passed
          const dom = rt.dayOfMonth || 1;
          if (today < dom) continue;

          // Create transaction
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(Math.min(dom, 28)).padStart(2, '0')}`;
          const body: any = {
            title: rt.title,
            amount: rt.type === 'income' ? Math.abs(rt.amount) : -Math.abs(rt.amount),
            date: dateStr,
            source: 'recurring',
          };
          if (rt.categoryId) body.category = rt.categoryId;
          if (rt.pocketId) body.pocket = rt.pocketId;
          if (rt.notes) body.notes = rt.notes;

          await this.request('/api/collections/transactions/records', {
            method: 'POST',
            body: JSON.stringify(body),
          });

          // Update last_generated
          await this.request(`/api/collections/recurring_transactions/records/${rt.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ last_generated: dateStr }),
          });

          result.generated++;
        } catch (e) {
          console.error(`[PB] generateRecurringTransactions: failed for ${rt.id}:`, e);
          result.errors++;
        }
      }
    } catch (e) {
      console.error('[PB] generateRecurringTransactions failed:', e);
    }
    return result;
  }

  // ===== RECURRING BUDGETS =====

  private toRecurringBudget(item: any): any {
    const category = item.expand?.category;
    const pocket = item.expand?.pocket;
    return {
      id: item.id,
      title: item.title || '',
      amount: item.amount || 0,
      categoryId: item.category || '',
      categoryName: category?.name || '',
      pocketId: item.pocket || '',
      pocketName: pocket?.name || '',
      dayOfMonth: item.day_of_month || 1,
      frequency: item.frequency || 'monthly',
      startDate: item.start_date || '',
      endDate: item.end_date || '',
      isActive: item.is_active ?? true,
      lastGenerated: item.last_generated || '',
      notes: item.notes || '',
      userId: item.user || '',
      created: item.created || '',
      updated: item.updated || '',
    };
  }

  async getRecurringBudgets(filters?: { pocketId?: string; isActive?: boolean }): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.set('perPage', '500');
      params.set('expand', 'category,pocket');
      const filterParts: string[] = [];
      if (filters?.pocketId) filterParts.push(`pocket='${filters.pocketId}'`);
      if (filters?.isActive !== undefined) filterParts.push(`is_active=${filters.isActive}`);
      if (filterParts.length) params.set('filter', filterParts.join(' && '));
      const data = await this.request(`/api/collections/recurring_budgets/records?${params.toString()}`);
      return (data.items || []).map((item: any) => this.toRecurringBudget(item));
    } catch {
      return [];
    }
  }

  async createRecurringBudget(rb: { title: string; amount: number; categoryId?: string; pocketId?: string; dayOfMonth: number; frequency?: string; startDate?: string; endDate?: string; isActive?: boolean; notes?: string; userId?: string }): Promise<any> {
    const body: any = {
      title: rb.title,
      amount: rb.amount,
      day_of_month: rb.dayOfMonth,
      frequency: rb.frequency || 'monthly',
      is_active: rb.isActive ?? true,
      notes: rb.notes || '',
    };
    if (rb.categoryId) body.category = rb.categoryId;
    if (rb.pocketId) body.pocket = rb.pocketId;
    if (rb.startDate) body.start_date = rb.startDate;
    if (rb.endDate) body.end_date = rb.endDate;
    if (rb.userId) body.user = rb.userId;
    const data = await this.request('/api/collections/recurring_budgets/records', { method: 'POST', body: JSON.stringify(body) });
    return this.toRecurringBudget(data);
  }

  async updateRecurringBudget(id: string, rb: Partial<{ title: string; amount: number; categoryId: string; pocketId: string; dayOfMonth: number; frequency: string; startDate: string; endDate: string; isActive: boolean; notes: string }>): Promise<any> {
    const body: any = {};
    if (rb.title !== undefined) body.title = rb.title;
    if (rb.amount !== undefined) body.amount = rb.amount;
    if (rb.categoryId !== undefined) body.category = rb.categoryId;
    if (rb.pocketId !== undefined) body.pocket = rb.pocketId;
    if (rb.dayOfMonth !== undefined) body.day_of_month = rb.dayOfMonth;
    if (rb.frequency !== undefined) body.frequency = rb.frequency;
    if (rb.startDate !== undefined) body.start_date = rb.startDate;
    if (rb.endDate !== undefined) body.end_date = rb.endDate;
    if (rb.isActive !== undefined) body.is_active = rb.isActive;
    if (rb.notes !== undefined) body.notes = rb.notes;
    const data = await this.request(`/api/collections/recurring_budgets/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return this.toRecurringBudget(data);
  }

  async deleteRecurringBudget(id: string): Promise<void> {
    await this.request(`/api/collections/recurring_budgets/records/${id}`, { method: 'DELETE' });
  }

  /**
   * Auto-generate budgets for active recurring_budgets whose day_of_month
   * has passed in the current month and last_generated < current month.
   * For each due recurring_budget, creates a new budget record in `budgets`
   * collection and updates last_generated.
   */
  async generateRecurringBudgets(): Promise<{ generated: number; errors: number }> {
    const result = { generated: 0, errors: 0 };
    try {
      const recurring = await this.getRecurringBudgets({ isActive: true });
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed
      const today = now.getDate();
      const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

      for (const rb of recurring) {
        try {
          // Check end_date
          if (rb.endDate && new Date(rb.endDate) < now) continue;

          // Check start_date
          if (rb.startDate && new Date(rb.startDate) > now) continue;

          // Check if already generated this month
          if (rb.lastGenerated && rb.lastGenerated.startsWith(currentMonthStr)) continue;

          // Check if day_of_month has passed
          const dom = rb.dayOfMonth || 1;
          if (today < dom) continue;

          // Create budget record
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(Math.min(dom, 28)).padStart(2, '0')}`;
          const periodStart = dateStr;
          const periodEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${new Date(currentYear, currentMonth + 1, 0).getDate().toString().padStart(2, '0')}`;
          const budgetBody: any = {
            amount: rb.amount,
            period_start: periodStart,
            period_end: periodEnd,
          };
          if (rb.categoryId) budgetBody.category = rb.categoryId;

          await this.request('/api/collections/budgets/records', {
            method: 'POST',
            body: JSON.stringify(budgetBody),
          });

          // Update last_generated
          await this.request(`/api/collections/recurring_budgets/records/${rb.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ last_generated: dateStr }),
          });

          result.generated++;
        } catch (e) {
          console.error(`[PB] generateRecurringBudgets: failed for ${rb.id}:`, e);
          result.errors++;
        }
      }
    } catch (e) {
      console.error('[PB] generateRecurringBudgets failed:', e);
    }
    return result;
  }

  // ===== AI SUMMARIES =====

  private toAISummary(item: any): any {
    let topCategories: any[] = [];
    try {
      topCategories = typeof item.top_categories === 'string' ? JSON.parse(item.top_categories) : (item.top_categories || []);
    } catch { topCategories = []; }
    return {
      id: item.id,
      summaryText: item.summary_text || '',
      summaryDate: item.summary_date || '',
      period: item.period || 'monthly',
      totalIncome: item.total_income || 0,
      totalExpense: item.total_expense || 0,
      net: item.net || 0,
      topCategories,
      insights: item.insights || '',
      recommendations: item.recommendations || '',
      userId: item.user || '',
      created: item.created || '',
      updated: item.updated || '',
    };
  }

  async getAISummaries(filters?: { period?: string; startDate?: string; endDate?: string }): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.set('perPage', '500');
      params.set('sort', '-summary_date');
      const filterParts: string[] = [];
      if (filters?.period) filterParts.push(`period='${filters.period}'`);
      if (filters?.startDate) filterParts.push(`summary_date>='${filters.startDate}'`);
      if (filters?.endDate) filterParts.push(`summary_date<='${filters.endDate}'`);
      if (filterParts.length) params.set('filter', filterParts.join(' && '));
      const data = await this.request(`/api/collections/ai_summaries/records?${params.toString()}`);
      return (data.items || []).map((item: any) => this.toAISummary(item));
    } catch {
      return [];
    }
  }

  async createAISummary(summary: { summaryText: string; summaryDate: string; period?: string; totalIncome?: number; totalExpense?: number; net?: number; topCategories?: any[]; insights?: string; recommendations?: string; userId?: string }): Promise<any> {
    const body: any = {
      summary_text: summary.summaryText,
      summary_date: summary.summaryDate,
      period: summary.period || 'monthly',
      total_income: summary.totalIncome || 0,
      total_expense: summary.totalExpense || 0,
      net: summary.net || 0,
      top_categories: JSON.stringify(summary.topCategories || []),
      insights: summary.insights || '',
      recommendations: summary.recommendations || '',
    };
    if (summary.userId) body.user = summary.userId;
    const data = await this.request('/api/collections/ai_summaries/records', { method: 'POST', body: JSON.stringify(body) });
    return this.toAISummary(data);
  }

  async deleteAISummary(id: string): Promise<void> {
    await this.request(`/api/collections/ai_summaries/records/${id}`, { method: 'DELETE' });
  }

  // ===== PREDICTIONS =====

  private toPrediction(item: any): any {
    let details: any = {};
    try {
      details = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {});
    } catch { details = {}; }
    let basedOn: any[] = [];
    try {
      basedOn = typeof item.based_on === 'string' ? JSON.parse(item.based_on) : (item.based_on || []);
    } catch { basedOn = []; }
    return {
      id: item.id,
      type: item.type || 'expense',
      predictedAmount: item.predicted_amount || 0,
      targetMonth: item.target_month || '',
      targetDate: item.target_date || '',
      confidence: item.confidence || 0,
      basedOn,
      isAuto: item.is_auto ?? false,
      isEditable: item.is_editable ?? true,
      details,
      userId: item.user || '',
      created: item.created || '',
      updated: item.updated || '',
    };
  }

  async getPredictions(filters?: { type?: string; targetMonth?: string; isAuto?: boolean }): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.set('perPage', '500');
      params.set('sort', '-target_date');
      const filterParts: string[] = [];
      if (filters?.type) filterParts.push(`type='${filters.type}'`);
      if (filters?.targetMonth) filterParts.push(`target_month='${filters.targetMonth}'`);
      if (filters?.isAuto !== undefined) filterParts.push(`is_auto=${filters.isAuto}`);
      if (filterParts.length) params.set('filter', filterParts.join(' && '));
      const data = await this.request(`/api/collections/predictions/records?${params.toString()}`);
      return (data.items || []).map((item: any) => this.toPrediction(item));
    } catch {
      return [];
    }
  }

  async createPrediction(pred: { type: string; predictedAmount: number; targetMonth?: string; targetDate?: string; confidence?: number; basedOn?: any[]; isAuto?: boolean; isEditable?: boolean; details?: any; userId?: string }): Promise<any> {
    const body: any = {
      type: pred.type,
      predicted_amount: pred.predictedAmount,
      confidence: pred.confidence ?? 0,
      is_auto: pred.isAuto ?? false,
      is_editable: pred.isEditable ?? true,
      based_on: JSON.stringify(pred.basedOn || []),
      details: JSON.stringify(pred.details || {}),
    };
    if (pred.targetMonth) body.target_month = pred.targetMonth;
    if (pred.targetDate) body.target_date = pred.targetDate;
    if (pred.userId) body.user = pred.userId;
    const data = await this.request('/api/collections/predictions/records', { method: 'POST', body: JSON.stringify(body) });
    return this.toPrediction(data);
  }

  async updatePrediction(id: string, pred: Partial<{ type: string; predictedAmount: number; targetMonth: string; targetDate: string; confidence: number; isAuto: boolean; isEditable: boolean; details: any }>): Promise<any> {
    const body: any = {};
    if (pred.type !== undefined) body.type = pred.type;
    if (pred.predictedAmount !== undefined) body.predicted_amount = pred.predictedAmount;
    if (pred.targetMonth !== undefined) body.target_month = pred.targetMonth;
    if (pred.targetDate !== undefined) body.target_date = pred.targetDate;
    if (pred.confidence !== undefined) body.confidence = pred.confidence;
    if (pred.isAuto !== undefined) body.is_auto = pred.isAuto;
    if (pred.isEditable !== undefined) body.is_editable = pred.isEditable;
    if (pred.details !== undefined) body.details = JSON.stringify(pred.details);
    const data = await this.request(`/api/collections/predictions/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return this.toPrediction(data);
  }

  async deletePrediction(id: string): Promise<void> {
    await this.request(`/api/collections/predictions/records/${id}`, { method: 'DELETE' });
  }

  /**
   * Auto-calculate income/expense predictions for next month based on
   * transaction history. Uses positive amounts (excluding Transfer category)
   * for income, negative amounts (excluding Transfer) for expense.
   * - Income: target_date = 26th of next month
   * - Expense: target_date = average day-of-month of expenses
   * - is_auto=true, is_editable=true
   * - confidence based on data consistency (std deviation vs mean)
   */
  async generatePredictions(options?: { monthsHistory?: number; userId?: string }): Promise<{ income: any | null; expense: any | null }> {
    try {
      const monthsHistory = options?.monthsHistory ?? 3;
      const now = new Date();
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const targetMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

      // Build history window filter (last N months)
      const startDate = new Date(now.getFullYear(), now.getMonth() - monthsHistory + 1, 1);
      const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
      const endDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Fetch all transactions in the window
      const params = new URLSearchParams();
      params.set('perPage', '500');
      params.set('expand', 'category');
      params.set('filter', `date>='${startDateStr}' && date<='${endDateStr}'`);
      const data = await this.request(`/api/collections/transactions/records?${params.toString()}`);
      const transactions: any[] = data.items || [];

      // Find Transfer category id(s)
      const catParams = new URLSearchParams();
      catParams.set('perPage', '500');
      const catData = await this.request(`/api/collections/budget_categories/records?${catParams.toString()}`);
      const transferCatIds: string[] = (catData.items || [])
        .filter((c: any) => (c.name || '').toLowerCase() === 'transfer')
        .map((c: any) => c.id);

      // Group income/expense by month
      const monthlyIncome: Record<string, number[]> = {};
      const monthlyExpense: Record<string, number[]> = {};

      for (const tx of transactions) {
        const catId = tx.category || '';
        if (transferCatIds.includes(catId)) continue;
        const amount = tx.amount || 0;
        if (!tx.date) continue;
        const monthKey = String(tx.date).slice(0, 7); // YYYY-MM
        if (amount > 0) {
          (monthlyIncome[monthKey] ||= []).push(amount);
        } else if (amount < 0) {
          (monthlyExpense[monthKey] ||= []).push(Math.abs(amount));
        }
      }

      // Compute average monthly income
      const incomeMonths = Object.values(monthlyIncome);
      const incomeTotals = incomeMonths.map((arr) => arr.reduce((a, b) => a + b, 0));
      const avgIncome = incomeTotals.length ? incomeTotals.reduce((a, b) => a + b, 0) / incomeTotals.length : 0;
      const incomeConfidence = this.computeConfidence(incomeTotals);

      // Compute average monthly expense
      const expenseMonths = Object.values(monthlyExpense);
      const expenseTotals = expenseMonths.map((arr) => arr.reduce((a, b) => a + b, 0));
      const avgExpense = expenseTotals.length ? expenseTotals.reduce((a, b) => a + b, 0) / expenseTotals.length : 0;
      const expenseConfidence = this.computeConfidence(expenseTotals);

      // Average expense day-of-month
      const expenseDays: number[] = [];
      for (const tx of transactions) {
        const catId = tx.category || '';
        if (transferCatIds.includes(catId)) continue;
        const amount = tx.amount || 0;
        if (amount < 0 && tx.date) {
          const d = new Date(tx.date);
          if (!isNaN(d.getTime())) expenseDays.push(d.getDate());
        }
      }
      const avgExpenseDay = expenseDays.length
        ? Math.round(expenseDays.reduce((a, b) => a + b, 0) / expenseDays.length)
        : 1;

      // Target dates
      const incomeTargetDate = `${targetMonth}-26`;
      const expenseTargetDate = `${targetMonth}-${String(Math.min(Math.max(avgExpenseDay, 1), 28)).padStart(2, '0')}`;

      // Delete existing auto predictions for target month
      try {
        const existing = await this.getPredictions({ targetMonth, isAuto: true });
        for (const p of existing) {
          await this.deletePrediction(p.id);
        }
      } catch (e) {
        console.error('[PB] generatePredictions: cleanup failed:', e);
      }

      // Create income prediction
      let incomePred: any = null;
      if (avgIncome > 0) {
        incomePred = await this.createPrediction({
          type: 'income',
          predictedAmount: Math.round(avgIncome),
          targetMonth,
          targetDate: incomeTargetDate,
          confidence: incomeConfidence,
          basedOn: incomeTotals.map((v, i) => ({ month: Object.keys(monthlyIncome)[i], total: v })),
          isAuto: true,
          isEditable: true,
          details: { avg: avgIncome, months: incomeTotals.length },
          userId: options?.userId,
        });
      }

      // Create expense prediction
      let expensePred: any = null;
      if (avgExpense > 0) {
        expensePred = await this.createPrediction({
          type: 'expense',
          predictedAmount: Math.round(avgExpense),
          targetMonth,
          targetDate: expenseTargetDate,
          confidence: expenseConfidence,
          basedOn: expenseTotals.map((v, i) => ({ month: Object.keys(monthlyExpense)[i], total: v })),
          isAuto: true,
          isEditable: true,
          details: { avg: avgExpense, months: expenseTotals.length },
          userId: options?.userId,
        });
      }

      return { income: incomePred, expense: expensePred };
    } catch (e) {
      console.error('[PB] generatePredictions failed:', e);
      return { income: null, expense: null };
    }
  }

  /**
   * Compute confidence score 0..1 based on consistency (low std-dev relative to mean).
   * Returns higher value when monthly totals are similar across months.
   */
  private computeConfidence(values: number[]): number {
    if (!values.length) return 0;
    if (values.length === 1) return 0.4;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean; // coefficient of variation
    // cv=0 -> 1.0, cv=1 -> ~0.3, higher cv -> lower
    const confidence = Math.max(0, Math.min(1, 1 / (1 + cv)));
    return Math.round(confidence * 100) / 100;
  }
}
