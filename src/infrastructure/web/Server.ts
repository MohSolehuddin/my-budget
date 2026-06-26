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
    return JSON.parse(Buffer.from(payload, 'base64').toString());
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

  // ===== SUMMARY =====
  server.get('/api/summary', async (_request, reply) => {
    try {
      const [budgets, transactions, debtSummary, pockets] = await Promise.all([
        pocketbaseService.getBudgets().catch(() => []),
        pocketbaseService.getTransactions().catch(() => []),
        getDebtSummaryUseCase.execute().catch(() => null),
        pocketbaseService.getPockets().catch(() => []),
      ]);

      const totalBudget = budgets.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
      const totalSpent = transactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const recentTransactions = transactions.slice(0, 10);

      reply.send({
        status: 'success',
        data: {
          totalBudget,
          totalSpent,
          remaining: totalBudget - totalSpent,
          budgetCount: budgets.length,
          transactionCount: transactions.length,
          debtSummary,
          pockets,
          recentTransactions,
          budgets: budgets.map((b: any) => ({
            ...b,
            spentAmount: transactions
              .filter((t: any) => t.categoryId === b.categoryId)
              .reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
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
      const transactions = await pocketbaseService.getTransactions({
        categoryId: query.categoryId,
        startDate: query.startDate,
        endDate: query.endDate,
      });
      reply.send({ status: 'success', data: transactions });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch transactions', details: (error as Error).message });
    }
  });

  // POST /api/transactions
  server.post<{ Body: { title: string; amount: number; date: string; categoryId?: string; notes?: string } }>(
    '/api/transactions',
    async (request, reply) => {
      try {
        await pocketbaseService.saveTransactionsToPB([request.body]);
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
  server.post<{ Body: { name: string; balance: number; icon?: string; color?: string; type?: string; notes?: string } }>(
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
  server.put<{ Params: { id: string }; Body: { name?: string; balance?: number; icon?: string; color?: string; type?: string; notes?: string; isArchived?: boolean } }>(
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
