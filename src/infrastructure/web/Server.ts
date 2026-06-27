import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BudgetService } from '../../domain/interfaces/BudgetService';
import { BudgetServiceImpl } from '../../use-cases/budget/BudgetServiceImpl';
import { PocketBaseDebtRepository } from '../../infrastructure/database/pocketbase/PocketBaseDebtRepository';
import { PocketBaseService } from '../../infrastructure/database/pocketbase/PocketBaseService';
import {
  CreateDebtUseCase,
  ListDebtsUseCase,
  GetDebtSummaryUseCase,
  PayDebtUseCase,
  ListDebtPaymentsUseCase,
} from '../../use-cases/debt/DebtUseCases';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple JWT decode (no verify — PocketBase tokens are verified by PB itself)
function decodeJWT(token: string): any {
  try {
    const payload = token.split('.')[1];
    // JWT uses base64url (not standard base64): replace - → +, _ → /, add padding
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString());
  } catch {
    return null;
  }
}

export const createServer = async () => {
  const server = fastify({
    logger: { level: process.env.LOG_LEVEL || 'info' },
  });

  await server.register(fastifyCookie);

  // Initialize shared PocketBase service
  const pocketbaseService = new PocketBaseService(
    process.env.POCKETBASE_URL || 'http://localhost:8091',
    process.env.POCKETBASE_TOKEN
  );

  // Initialize debt use cases
  const debtRepository = new PocketBaseDebtRepository(pocketbaseService);
  const listDebtsUseCase = new ListDebtsUseCase(debtRepository);
  const createDebtUseCase = new CreateDebtUseCase(debtRepository);
  const getDebtSummaryUseCase = new GetDebtSummaryUseCase(debtRepository);
  const payDebtUseCase = new PayDebtUseCase(debtRepository);
  const listDebtPaymentsUseCase = new ListDebtPaymentsUseCase(debtRepository);

  // Initialize BudgetService
  let budgetService: BudgetService | undefined;
  try {
    budgetService = new BudgetServiceImpl();
  } catch (error) {
    console.error('Failed to initialize BudgetService:', error);
  }

  // ===== AUTH MIDDLEWARE =====
  // Extract user token from Authorization header or cookie
  const getUserToken = (request: any): string | null => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    const cookie = request.cookies?.pb_token;
    if (cookie) return cookie;
    return null;
  };

  // ===== AUTH ENDPOINTS =====

  // POST /api/auth/login
  server.post<{ Body: { email: string; password: string } }>('/api/auth/login', async (request, reply) => {
    try {
      const { email, password } = request.body;
      const res = await fetch(`${pocketbaseService['apiUrl']}/api/collections/users/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password }),
      });
      const data: any = await res.json();
      if (!res.ok) {
        reply.code(401).send({ error: data.message || 'Login failed' });
        return;
      }
      reply.send({
        status: 'success',
        data: {
          token: data.token,
          user: { id: data.record.id, email: data.record.email, name: data.record.name },
        },
      });
    } catch (error) {
      reply.code(500).send({ error: 'Login failed', details: (error as Error).message });
    }
  });

  // POST /api/auth/register
  server.post<{ Body: { email: string; password: string; passwordConfirm: string; name?: string } }>(
    '/api/auth/register',
    async (request, reply) => {
      try {
        const { email, password, passwordConfirm, name } = request.body;
        const res = await fetch(`${pocketbaseService['apiUrl']}/api/collections/users/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, passwordConfirm, name: name || email.split('@')[0] }),
        });
        const data: any = await res.json();
        if (!res.ok) {
          reply.code(400).send({ error: data.message || 'Registration failed' });
          return;
        }
        reply.code(201).send({
          status: 'success',
          data: { id: data.id, email: data.email, name: data.name },
        });
      } catch (error) {
        reply.code(500).send({ error: 'Registration failed', details: (error as Error).message });
      }
    }
  );

  // GET /api/auth/me
  server.get('/api/auth/me', async (request, reply) => {
    const token = getUserToken(request);
    if (!token) {
      reply.code(401).send({ error: 'Not authenticated' });
      return;
    }
    const decoded = decodeJWT(token);
    if (!decoded) {
      reply.code(401).send({ error: 'Invalid token' });
      return;
    }
    reply.send({
      status: 'success',
      data: { id: decoded.id, email: decoded.email, name: decoded.name },
    });
  });

  // ===== HEALTH =====
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // ===== CUTOFFS =====

  // GET /api/cutoffs
  server.get('/api/cutoffs', async (_request, reply) => {
    try {
      const cutoffs = await pocketbaseService.getCutoffs();
      reply.send({ status: 'success', data: cutoffs });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch cutoffs', details: (error as Error).message });
    }
  });

  // POST /api/cutoffs
  server.post<{ Body: { title: string; cutoffDate: string; notes?: string } }>(
    '/api/cutoffs',
    async (request, reply) => {
      try {
        const token = request.cookies?.token || (request.headers.authorization || '').replace('Bearer ', '');
        const decoded = decodeJWT(token);
        const userId = decoded?.id;
        const result = await pocketbaseService.createCutoff({
          title: request.body.title,
          cutoffDate: request.body.cutoffDate,
          notes: request.body.notes,
          userId,
        });
        reply.code(201).send({ status: 'success', data: result });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to create cutoff', details: (error as Error).message });
      }
    }
  );

  // PUT /api/cutoffs/:id
  server.put<{ Params: { id: string }; Body: { title?: string; cutoffDate?: string; notes?: string } }>(
    '/api/cutoffs/:id',
    async (request, reply) => {
      try {
        await pocketbaseService.updateCutoff(request.params.id, request.body);
        reply.send({ status: 'success', message: 'Cutoff updated' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update cutoff', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/cutoffs/:id
  server.delete<{ Params: { id: string } }>('/api/cutoffs/:id', async (request, reply) => {
    try {
      await pocketbaseService.deleteCutoff(request.params.id);
      reply.send({ status: 'success', message: 'Cutoff deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete cutoff', details: (error as Error).message });
    }
  });

  // ===== SUMMARY =====
  server.get('/api/summary', async (_request, reply) => {
    try {
      // Get latest cutoff date — transactions before this date are excluded from dashboard
      const cutoffDate = await pocketbaseService.getLatestCutoffDate().catch(() => null);

      const [budgets, transactions, debtSummary, pockets, categories] = await Promise.all([
        pocketbaseService.getBudgets().catch(() => []),
        pocketbaseService.getTransactions().catch(() => []),
        getDebtSummaryUseCase.execute().catch(() => null),
        pocketbaseService.getPockets().catch(() => []),
        pocketbaseService.getCategories().catch(() => []),
      ]);

      // Filter out transactions before cutoff date (they're history, not for dashboard)
      const dashboardTx = cutoffDate
        ? transactions.filter((t: any) => {
            const txDate = (t.date || '').split('T')[0];
            return txDate >= cutoffDate;
          })
        : transactions;

      // Find the Transfer category ID to exclude from income/spent
      const transferCategory = categories.find((c: any) =>
        c.name?.toLowerCase() === 'transfer'
      );
      const transferCategoryId = transferCategory?.id;

      const totalBudget = budgets.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

      // Exclude Transfer category from income/spent (antar-kantong, bukan real income/expense)
      const realTransactions = dashboardTx.filter((t: any) =>
        t.categoryId !== transferCategoryId
      );

      // Separate income vs expense (excluding transfers)
      const incomeTx = realTransactions.filter((t: any) => t.amount > 0);
      const expenseTx = realTransactions.filter((t: any) => t.amount < 0);
      const totalIncome = incomeTx.reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);
      const totalSpent = expenseTx.reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);

      // Calculate pocket balances from ALL transactions (including pre-cutoff, for running balance)
      // But we use dashboardTx for display, while balance includes everything for accuracy
      const pocketsWithBalance = pockets.map((p: any) => {
        const pocketTx = transactions.filter((t: any) => t.pocketId === p.id);
        const txBalance = pocketTx.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
        return { ...p, balance: (p.balance || 0) + txBalance };
      });

      // Recent transactions from dashboard only
      const recentTransactions = dashboardTx.slice(0, 10);

      reply.send({
        status: 'success',
        data: {
          totalBudget,
          totalIncome,
          totalSpent,
          remaining: totalBudget - totalSpent,
          budgetCount: budgets.length,
          transactionCount: dashboardTx.length,
          totalTransactionsAll: transactions.length,
          cutoffDate,
          debtSummary,
          pockets: pocketsWithBalance,
          recentTransactions,
          budgets: budgets.map((b: any) => ({
            ...b,
            spentAmount: dashboardTx
              .filter((t: any) => t.categoryId === b.categoryId)
              .reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0),
          })),
        },
      });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch summary', details: (error as Error).message });
    }
  });

  // ===== CATEGORIES =====

  // GET /api/categories
  server.get('/api/categories', async (_request, reply) => {
    try {
      const categories = await pocketbaseService.getCategories();
      reply.send({ status: 'success', data: categories });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch categories', details: (error as Error).message });
    }
  });

  // POST /api/categories
  server.post<{ Body: { name: string; icon?: string; color?: string } }>(
    '/api/categories',
    async (request, reply) => {
      try {
        const result = await pocketbaseService.createCategory(request.body);
        reply.code(201).send({ status: 'success', data: result });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to create category', details: (error as Error).message });
      }
    }
  );

  // PUT /api/categories/:id
  server.put<{ Params: { id: string }; Body: { name?: string; icon?: string; color?: string } }>(
    '/api/categories/:id',
    async (request, reply) => {
      try {
        await pocketbaseService.updateCategory(request.params.id, request.body);
        reply.send({ status: 'success', message: 'Category updated' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update category', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/categories/:id
  server.delete<{ Params: { id: string } }>('/api/categories/:id', async (request, reply) => {
    try {
      await pocketbaseService.deleteCategory(request.params.id);
      reply.send({ status: 'success', message: 'Category deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete category', details: (error as Error).message });
    }
  });

  // ===== TRANSACTIONS =====

  // GET /api/transactions
  server.get('/api/transactions', async (request, reply) => {
    try {
      const query = request.query as any;
      let transactions = await pocketbaseService.getTransactions({
        categoryId: query.categoryId,
        startDate: query.startDate,
        endDate: query.endDate,
      });

      // If no explicit date filter, apply cutoff filter by default
      if (!query.startDate && !query.endDate) {
        const cutoffDate = await pocketbaseService.getLatestCutoffDate().catch(() => null);
        if (cutoffDate) {
          transactions = transactions.filter((t: any) => {
            const txDate = (t.date || '').split('T')[0];
            return txDate >= cutoffDate;
          });
        }
      }

      reply.send({ status: 'success', data: transactions });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch transactions', details: (error as Error).message });
    }
  });

  // POST /api/transactions
  server.post<{ Body: { description?: string; title?: string; amount: number; date: string; category?: string; categoryId?: string; pocket?: string; pocketId?: string; type?: string; notes?: string } }>(
    '/api/transactions',
    async (request, reply) => {
      try {
        const body = request.body;
        const token = getUserToken(request);
        if (!token) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        console.log('[POST /api/transactions] token length:', token.length, 'first 20:', token.substring(0, 20));
        const decoded = decodeJWT(token);
        console.log('[POST /api/transactions] decoded:', JSON.stringify(decoded));
        const userId = decoded?.id;

        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        // Resolve category name → ID
        let categoryId = body.categoryId || null;
        if (!categoryId && body.category) {
          const params = new URLSearchParams({ filter: `name='${body.category}'`, perPage: '1' });
          const catData = await pocketbaseService.request(`/api/collections/budget_categories/records?${params.toString()}`);
          categoryId = catData.items?.[0]?.id || null;
        }

        // Resolve pocket: accept pocketId directly, or resolve pocket name → ID
        let pocketId = body.pocketId || null;
        if (!pocketId && body.pocket) {
          const params = new URLSearchParams({ filter: `name='${body.pocket}'`, perPage: '1' });
          const pocketData = await pocketbaseService.request(`/api/collections/pockets/records?${params.toString()}`);
          pocketId = pocketData.items?.[0]?.id || null;
        }

        const record: any = {
          user: userId,
          title: body.title || body.description || '',
          description: body.description || body.title || '',
          amount: body.type === 'income' ? Math.abs(body.amount) : -Math.abs(body.amount),
          type: body.type || (body.amount >= 0 ? 'income' : 'expense'),
          date: body.date || new Date().toISOString().split('T')[0],
          category: categoryId,
          pocket: pocketId,
          source: 'manual',
        };

        await pocketbaseService.request('/api/collections/transactions/records', {
          method: 'POST',
          body: JSON.stringify(record),
        });

        reply.code(201).send({ status: 'success', message: 'Transaction added' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to add transaction', details: (error as Error).message });
      }
    }
  );

  // PUT /api/transactions/:id
  server.put<{ Params: { id: string }; Body: { title?: string; amount?: number; date?: string; categoryId?: string; notes?: string } }>(
    '/api/transactions/:id',
    async (request, reply) => {
      try {
        await pocketbaseService.updateTransaction(request.params.id, request.body);
        reply.send({ status: 'success', message: 'Transaction updated' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update transaction', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/transactions/:id
  server.delete<{ Params: { id: string } }>('/api/transactions/:id', async (request, reply) => {
    try {
      await pocketbaseService.deleteTransaction(request.params.id);
      reply.send({ status: 'success', message: 'Transaction deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete transaction', details: (error as Error).message });
    }
  });

  // ===== BUDGETS =====

  // GET /api/budgets
  server.get('/api/budgets', async (request, reply) => {
    try {
      const query = request.query as any;
      const budgets = await pocketbaseService.getBudgets(query.categoryId);
      reply.send({ status: 'success', data: budgets });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch budgets', details: (error as Error).message });
    }
  });

  // POST /api/budgets
  server.post<{ Body: { categoryId?: string; subcategoryId?: string; amount: number; periodStart?: string; periodEnd?: string } }>(
    '/api/budgets',
    async (request, reply) => {
      try {
        const result = await pocketbaseService.saveBudgetToPB(request.body);
        reply.code(201).send({ status: 'success', data: result });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to create budget', details: (error as Error).message });
      }
    }
  );

  // PUT /api/budgets/:id
  server.put<{ Params: { id: string }; Body: { categoryId?: string; subcategoryId?: string; amount?: number; periodStart?: string; periodEnd?: string } }>(
    '/api/budgets/:id',
    async (request, reply) => {
      try {
        await pocketbaseService.updateBudget(request.params.id, request.body);
        reply.send({ status: 'success', message: 'Budget updated' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update budget', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/budgets/:id
  server.delete<{ Params: { id: string } }>('/api/budgets/:id', async (request, reply) => {
    try {
      await pocketbaseService.deleteBudget(request.params.id);
      reply.send({ status: 'success', message: 'Budget deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete budget', details: (error as Error).message });
    }
  });

  // ===== BUDGET PROGRESS (legacy compat) =====
  server.get('/api/budget/progress', async (_request, reply) => {
    if (!budgetService) {
      reply.status(503).send({ error: 'Budget service not available' });
      return;
    }
    try {
      const progress = await budgetService.getBudgetProgress();
      reply.send({ status: 'success', data: progress });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch budget progress', details: (error as Error).message });
    }
  });

  // ===== DEBTS =====

  // GET /api/debts
  server.get('/api/debts', async (_request, reply) => {
    try {
      const debts = await listDebtsUseCase.execute();
      reply.send({ status: 'success', data: debts });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch debts', details: (error as Error).message });
    }
  });

  // POST /api/debts
  server.post<{ Body: { name: string; originalAmount: number; remainingAmount?: number; type: string; creditor?: string; interestRate?: number; termMonths?: number; startDate?: string; dueDate?: string; notes?: string } }>(
    '/api/debts',
    async (request, reply) => {
      try {
        const body = request.body;
        const debt = await createDebtUseCase.execute({
          name: body.name,
          originalAmount: body.originalAmount,
          remainingAmount: body.remainingAmount ?? body.originalAmount,
          type: body.type as any,
          creditor: body.creditor,
          interestRate: body.interestRate,
          termMonths: body.termMonths,
          startDate: body.startDate || new Date().toISOString().split('T')[0],
          dueDate: body.dueDate,
          notes: body.notes,
          status: 'active',
          currency: 'IDR',
          autoDebit: false,
        });
        reply.code(201).send({ status: 'success', data: debt });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to create debt', details: (error as Error).message });
      }
    }
  );

  // PUT /api/debts/:id
  server.put<{ Params: { id: string }; Body: Partial<{ name: string; originalAmount: number; remainingAmount: number; type: string; creditor: string; interestRate: number; termMonths: number; startDate: string; dueDate: string; status: string; notes: string }> }>(
    '/api/debts/:id',
    async (request, reply) => {
      try {
        const debt = await debtRepository.update(request.params.id, request.body as any);
        reply.send({ status: 'success', data: debt });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update debt', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/debts/:id
  server.delete<{ Params: { id: string } }>('/api/debts/:id', async (request, reply) => {
    try {
      await debtRepository.delete(request.params.id);
      reply.send({ status: 'success', message: 'Debt deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete debt', details: (error as Error).message });
    }
  });

  // GET /api/debts/summary
  server.get('/api/debts/summary', async (_request, reply) => {
    try {
      const summary = await getDebtSummaryUseCase.execute();
      reply.send({ status: 'success', data: summary });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch debt summary', details: (error as Error).message });
    }
  });

  // GET /api/debts/:id/payments
  server.get<{ Params: { id: string } }>('/api/debts/:id/payments', async (request, reply) => {
    try {
      const payments = await listDebtPaymentsUseCase.execute(request.params.id);
      reply.send({ status: 'success', data: payments });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch debt payments', details: (error as Error).message });
    }
  });

  // POST /api/debts/:id/payments
  server.post<{ Params: { id: string }; Body: { amount: number; paymentDate?: string; paymentMethod?: string; notes?: string; isInstallment?: boolean; installmentNumber?: number } }>(
    '/api/debts/:id/payments',
    async (request, reply) => {
      try {
        const body = request.body;
        const payment = await payDebtUseCase.execute({
          debtId: request.params.id,
          amount: body.amount,
          paymentDate: body.paymentDate || new Date().toISOString().split('T')[0],
          paymentMethod: body.paymentMethod,
          notes: body.notes,
          isInstallment: body.isInstallment ?? false,
          installmentNumber: body.installmentNumber,
        });
        reply.code(201).send({ status: 'success', data: payment });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to pay debt', details: (error as Error).message });
      }
    }
  );

  // PUT /api/debts/:debtId/payments/:id
  server.put<{ Params: { debtId: string; id: string }; Body: { amount?: number; paymentDate?: string; paymentMethod?: string; notes?: string } }>(
    '/api/debts/:debtId/payments/:id',
    async (request, reply) => {
      try {
        await pocketbaseService.updateDebtPayment(request.params.id, request.body);
        reply.send({ status: 'success', message: 'Payment updated' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update payment', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/debts/:debtId/payments/:id
  server.delete<{ Params: { debtId: string; id: string } }>('/api/debts/:debtId/payments/:id', async (request, reply) => {
    try {
      await pocketbaseService.deleteDebtPayment(request.params.id);
      reply.send({ status: 'success', message: 'Payment deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete payment', details: (error as Error).message });
    }
  });

  // ===== POCKETS =====

  // GET /api/pockets
  server.get('/api/pockets', async (_request, reply) => {
    try {
      const pockets = await pocketbaseService.getPockets();
      reply.send({ status: 'success', data: pockets });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch pockets', details: (error as Error).message });
    }
  });

  // POST /api/pockets
  server.post<{ Body: { name: string; balance: number; icon?: string; color?: string; type?: string; notes?: string; accountNumber?: string; bankName?: string } }>(
    '/api/pockets',
    async (request, reply) => {
      try {
        const result = await pocketbaseService.createPocket(request.body);
        reply.code(201).send({ status: 'success', data: result });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to create pocket', details: (error as Error).message });
      }
    }
  );

  // PUT /api/pockets/:id
  server.put<{ Params: { id: string }; Body: { name?: string; balance?: number; icon?: string; color?: string; type?: string; notes?: string; accountNumber?: string; bankName?: string; isArchived?: boolean } }>(
    '/api/pockets/:id',
    async (request, reply) => {
      try {
        await pocketbaseService.updatePocket(request.params.id, request.body);
        reply.send({ status: 'success', message: 'Pocket updated' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update pocket', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/pockets/:id
  server.delete<{ Params: { id: string } }>('/api/pockets/:id', async (request, reply) => {
    try {
      await pocketbaseService.deletePocket(request.params.id);
      reply.send({ status: 'success', message: 'Pocket deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete pocket', details: (error as Error).message });
    }
  });

  // POST /api/pockets/transfer
  server.post<{ Body: { fromId: string; toId: string; amount: number } }>(
    '/api/pockets/transfer',
    async (request, reply) => {
      try {
        const { fromId, toId, amount } = request.body;
        await pocketbaseService.transferBetweenPockets(fromId, toId, amount);
        reply.send({ status: 'success', message: 'Transfer completed' });
      } catch (error) {
        reply.code(500).send({ error: 'Transfer failed', details: (error as Error).message });
      }
    }
  );

  // ===== SAVINGS TARGETS =====

  // GET /api/savings-targets
  server.get('/api/savings-targets', async (request, reply) => {
    try {
      const query = request.query as any;
      const targets = await pocketbaseService.getSavingsTargets({
        pocketId: query.pocketId,
        status: query.status,
      });
      reply.send({ status: 'success', data: targets });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch savings targets', details: (error as Error).message });
    }
  });

  // POST /api/savings-targets
  server.post<{ Body: { title: string; targetAmount: number; currentAmount?: number; pocketId?: string; targetDate?: string; status?: string; icon?: string; color?: string; notes?: string; targetType?: string } }>(
    '/api/savings-targets',
    async (request, reply) => {
      try {
        const token = getUserToken(request);
        if (!token) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const decoded = decodeJWT(token);
        const userId = decoded?.id;
        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const result = await pocketbaseService.createSavingsTarget({
          ...request.body,
          userId,
        });
        if (!result) return reply.code(500).send({ error: 'Failed to create savings target' });
        reply.code(201).send({ status: 'success', data: result });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to create savings target', details: (error as Error).message });
      }
    }
  );

  // PUT /api/savings-targets/:id
  server.put<{ Params: { id: string }; Body: { title?: string; targetAmount?: number; currentAmount?: number; pocketId?: string; targetDate?: string; status?: string; icon?: string; color?: string; notes?: string; targetType?: string } }>(
    '/api/savings-targets/:id',
    async (request, reply) => {
      try {
        await pocketbaseService.updateSavingsTarget(request.params.id, request.body);
        reply.send({ status: 'success', message: 'Savings target updated' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update savings target', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/savings-targets/:id
  server.delete<{ Params: { id: string } }>('/api/savings-targets/:id', async (request, reply) => {
    try {
      await pocketbaseService.deleteSavingsTarget(request.params.id);
      reply.send({ status: 'success', message: 'Savings target deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete savings target', details: (error as Error).message });
    }
  });

  // ===== RECURRING TRANSACTIONS =====

  // GET /api/recurring-transactions
  server.get('/api/recurring-transactions', async (request, reply) => {
    try {
      const query = request.query as any;
      const recurring = await pocketbaseService.getRecurringTransactions({
        pocketId: query.pocketId,
        isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
      });
      reply.send({ status: 'success', data: recurring });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch recurring transactions', details: (error as Error).message });
    }
  });

  // POST /api/recurring-transactions
  server.post<{ Body: { title: string; amount: number; type: string; categoryId?: string; pocketId?: string; dayOfMonth: number; frequency?: string; startDate?: string; endDate?: string; isActive?: boolean; notes?: string } }>(
    '/api/recurring-transactions',
    async (request, reply) => {
      try {
        const token = getUserToken(request);
        if (!token) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const decoded = decodeJWT(token);
        const userId = decoded?.id;
        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const result = await pocketbaseService.createRecurringTransaction({
          ...request.body,
          userId,
        });
        if (!result) return reply.code(500).send({ error: 'Failed to create recurring transaction' });
        reply.code(201).send({ status: 'success', data: result });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to create recurring transaction', details: (error as Error).message });
      }
    }
  );

  // PUT /api/recurring-transactions/:id
  server.put<{ Params: { id: string }; Body: { title?: string; amount?: number; type?: string; categoryId?: string; pocketId?: string; dayOfMonth?: number; frequency?: string; startDate?: string; endDate?: string; isActive?: boolean; notes?: string } }>(
    '/api/recurring-transactions/:id',
    async (request, reply) => {
      try {
        await pocketbaseService.updateRecurringTransaction(request.params.id, request.body);
        reply.send({ status: 'success', message: 'Recurring transaction updated' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update recurring transaction', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/recurring-transactions/:id
  server.delete<{ Params: { id: string } }>('/api/recurring-transactions/:id', async (request, reply) => {
    try {
      await pocketbaseService.deleteRecurringTransaction(request.params.id);
      reply.send({ status: 'success', message: 'Recurring transaction deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete recurring transaction', details: (error as Error).message });
    }
  });

  // POST /api/recurring-transactions/generate — auto-generate due recurring transactions
  server.post('/api/recurring-transactions/generate', async (_request, reply) => {
    try {
      const result = await pocketbaseService.generateRecurringTransactions();
      reply.send({ status: 'success', data: result });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to generate recurring transactions', details: (error as Error).message });
    }
  });

  // ===== RECURRING BUDGETS =====

  // GET /api/recurring-budgets
  server.get('/api/recurring-budgets', async (request, reply) => {
    try {
      const query = request.query as any;
      const recurring = await pocketbaseService.getRecurringBudgets({
        pocketId: query.pocketId,
        isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
      });
      reply.send({ status: 'success', data: recurring });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch recurring budgets', details: (error as Error).message });
    }
  });

  // POST /api/recurring-budgets
  server.post<{ Body: { title: string; amount: number; categoryId?: string; pocketId?: string; dayOfMonth: number; frequency?: string; startDate?: string; endDate?: string; isActive?: boolean; notes?: string } }>(
    '/api/recurring-budgets',
    async (request, reply) => {
      try {
        const token = getUserToken(request);
        if (!token) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const decoded = decodeJWT(token);
        const userId = decoded?.id;
        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const result = await pocketbaseService.createRecurringBudget({
          ...request.body,
          userId,
        });
        if (!result) return reply.code(500).send({ error: 'Failed to create recurring budget' });
        reply.code(201).send({ status: 'success', data: result });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to create recurring budget', details: (error as Error).message });
      }
    }
  );

  // PUT /api/recurring-budgets/:id
  server.put<{ Params: { id: string }; Body: { title?: string; amount?: number; categoryId?: string; pocketId?: string; dayOfMonth?: number; frequency?: string; startDate?: string; endDate?: string; isActive?: boolean; notes?: string } }>(
    '/api/recurring-budgets/:id',
    async (request, reply) => {
      try {
        await pocketbaseService.updateRecurringBudget(request.params.id, request.body);
        reply.send({ status: 'success', message: 'Recurring budget updated' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update recurring budget', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/recurring-budgets/:id
  server.delete<{ Params: { id: string } }>('/api/recurring-budgets/:id', async (request, reply) => {
    try {
      await pocketbaseService.deleteRecurringBudget(request.params.id);
      reply.send({ status: 'success', message: 'Recurring budget deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete recurring budget', details: (error as Error).message });
    }
  });

  // POST /api/recurring-budgets/generate — auto-generate due recurring budgets
  server.post('/api/recurring-budgets/generate', async (_request, reply) => {
    try {
      const result = await pocketbaseService.generateRecurringBudgets();
      reply.send({ status: 'success', data: result });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to generate recurring budgets', details: (error as Error).message });
    }
  });

  // ===== AI SUMMARIES =====

  // GET /api/ai-summaries
  server.get('/api/ai-summaries', async (request, reply) => {
    try {
      const query = request.query as any;
      const limit = Math.max(1, Math.min(500, parseInt(query.limit, 10) || 10));
      const summaries = await pocketbaseService.getAISummaries({
        period: query.period,
        startDate: query.startDate,
        endDate: query.endDate,
      });
      // Already sorted by -summary_date in PocketBaseService; apply limit
      reply.send({ status: 'success', data: summaries.slice(0, limit) });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch AI summaries', details: (error as Error).message });
    }
  });

  // POST /api/ai-summaries
  server.post<{ Body: { summaryText: string; summaryDate: string; period?: string; totalIncome?: number; totalExpense?: number; net?: number; topCategories?: any[]; insights?: string; recommendations?: string } }>(
    '/api/ai-summaries',
    async (request, reply) => {
      try {
        const token = getUserToken(request);
        if (!token) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const decoded = decodeJWT(token);
        const userId = decoded?.id;
        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const result = await pocketbaseService.createAISummary({
          ...request.body,
          userId,
        });
        if (!result) return reply.code(500).send({ error: 'Failed to create AI summary' });
        reply.code(201).send({ status: 'success', data: result });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to create AI summary', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/ai-summaries/:id
  server.delete<{ Params: { id: string } }>('/api/ai-summaries/:id', async (request, reply) => {
    try {
      await pocketbaseService.deleteAISummary(request.params.id);
      reply.send({ status: 'success', message: 'AI summary deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete AI summary', details: (error as Error).message });
    }
  });

  // ===== PREDICTIONS =====

  // GET /api/predictions
  server.get('/api/predictions', async (request, reply) => {
    try {
      const query = request.query as any;
      const predictions = await pocketbaseService.getPredictions({
        type: query.type,
        targetMonth: query.targetMonth,
        isAuto: query.isAuto === undefined ? undefined : query.isAuto === 'true',
      });
      reply.send({ status: 'success', data: predictions });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch predictions', details: (error as Error).message });
    }
  });

  // POST /api/predictions
  server.post<{ Body: { type: string; predictedAmount: number; targetMonth?: string; targetDate?: string; confidence?: number; basedOn?: any[]; isAuto?: boolean; isEditable?: boolean; details?: any } }>(
    '/api/predictions',
    async (request, reply) => {
      try {
        const token = getUserToken(request);
        if (!token) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const decoded = decodeJWT(token);
        const userId = decoded?.id;
        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const result = await pocketbaseService.createPrediction({
          ...request.body,
          userId,
        });
        if (!result) return reply.code(500).send({ error: 'Failed to create prediction' });
        reply.code(201).send({ status: 'success', data: result });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to create prediction', details: (error as Error).message });
      }
    }
  );

  // PUT /api/predictions/:id
  server.put<{ Params: { id: string }; Body: { type?: string; predictedAmount?: number; targetMonth?: string; targetDate?: string; confidence?: number; isAuto?: boolean; isEditable?: boolean; details?: any } }>(
    '/api/predictions/:id',
    async (request, reply) => {
      try {
        await pocketbaseService.updatePrediction(request.params.id, request.body);
        reply.send({ status: 'success', message: 'Prediction updated' });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to update prediction', details: (error as Error).message });
      }
    }
  );

  // DELETE /api/predictions/:id
  server.delete<{ Params: { id: string } }>('/api/predictions/:id', async (request, reply) => {
    try {
      await pocketbaseService.deletePrediction(request.params.id);
      reply.send({ status: 'success', message: 'Prediction deleted' });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete prediction', details: (error as Error).message });
    }
  });

  // POST /api/predictions/generate — auto-calculate predictions from transaction history
  server.post<{ Body: { monthsHistory?: number } }>(
    '/api/predictions/generate',
    async (request, reply) => {
      try {
        const token = request.cookies?.token || (request.headers.authorization || '').replace('Bearer ', '');
        const decoded = decodeJWT(token);
        const userId = decoded?.id;
        const result = await pocketbaseService.generatePredictions({
          monthsHistory: request.body?.monthsHistory,
          userId,
        });
        reply.send({ status: 'success', data: result });
      } catch (error) {
        reply.code(500).send({ error: 'Failed to generate predictions', details: (error as Error).message });
      }
    }
  );

  // ===== STATIC UI =====
  const uiPath = path.join(__dirname, '..', '..', '..', 'ui');
  await server.register(fastifyStatic, {
    root: uiPath,
    prefix: '/',
  });

  // SPA fallback: serve index.html for non-API routes
  server.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    return reply.sendFile('index.html');
  });

  return server;
};
