import fastify from 'fastify';
import type { BudgetService } from '../../domain/interfaces/BudgetService';
import { BudgetServiceImpl } from '../../use-cases/budget/BudgetServiceImpl';

export const createServer = async () => {
  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  server.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Initialize BudgetService
  let budgetService: BudgetService | undefined;
  try {
    budgetService = new BudgetServiceImpl();
  } catch (error) {
    console.error('Failed to initialize BudgetService:', error);
  }

  // POST /api/budget/transactions - Tambah transaksi baru
  server.post<{ Body: { account?: string; payee: string; amount: number; date: string; category?: string; notes?: string } }>(
    '/api/budget/transactions',
    async (request, reply) => {
      if (!budgetService) {
        reply.status(503).send({ error: 'Budget service not available' });
        return;
      }

      const { payee, amount, date, category, notes } = request.body;

      try {
        await budgetService.addTransaction({
          title: payee,
          amount,
          date,
          categoryId: category,
        });

        reply.code(201).send({
          status: 'success',
          message: 'Transaction added successfully',
          transaction: { payee, amount, date, category, notes },
        });
      } catch (error) {
        console.error('Error adding transaction:', error);
        reply.code(500).send({ error: 'Failed to add transaction', details: (error as Error).message });
      }
    }
  );

  // GET /api/budget/progress - Progress budget per kategori
  server.get('/api/budget/progress', async (request, reply) => {
    if (!budgetService) {
      reply.status(503).send({ error: 'Budget service not available' });
      return;
    }

    try {
      const progress = await budgetService.getBudgetProgress();
      reply.code(200).send({ status: 'success', data: progress });
    } catch (error) {
      console.error('Error fetching budget progress:', error);
      reply.code(500).send({ error: 'Failed to fetch budget progress', details: (error as Error).message });
    }
  });

  // GET /api/budget/daily-report - Laporan budget harian
  server.get('/api/budget/daily-report', async (request, reply) => {
    if (!budgetService) {
      reply.status(503).send({ error: 'Budget service not available' });
      return;
    }

    try {
      const report = await budgetService.getDailyBudgetReport();
      reply.code(200).send({ status: 'success', data: report });
    } catch (error) {
      console.error('Error fetching daily report:', error);
      reply.code(500).send({ error: 'Failed to fetch daily report', details: (error as Error).message });
    }
  });

  return server;
};
