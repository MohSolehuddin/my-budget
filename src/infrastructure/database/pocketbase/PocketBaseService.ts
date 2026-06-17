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
}
