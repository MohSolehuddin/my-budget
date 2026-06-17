import fastify from 'fastify';
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

export const createServer = async () => {
  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

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

  // ===== DEBT ENDPOINTS =====

  // GET /api/debts - List semua hutang
  server.get('/api/debts', async (request, reply) => {
    try {
      const debts = await listDebtsUseCase.execute();
      reply.code(200).send({ status: 'success', data: debts });
    } catch (error) {
      console.error('Error fetching debts:', error);
      reply.code(500).send({ error: 'Failed to fetch debts', details: (error as Error).message });
    }
  });

  // POST /api/debts - Tambah hutang baru
  server.post<{ Body: { name: string; originalAmount: number; remainingAmount?: number; type: string; creditor?: string; interestRate?: number; termMonths?: number; startDate?: string; dueDate?: string; notes?: string } }>('/api/debts', async (request, reply) => {
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
      console.error('Error creating debt:', error);
      reply.code(500).send({ error: 'Failed to create debt', details: (error as Error).message });
    }
  });

  // GET /api/debts/summary - Ringkasan hutang
  server.get('/api/debts/summary', async (request, reply) => {
    try {
      const summary = await getDebtSummaryUseCase.execute();
      reply.code(200).send({ status: 'success', data: summary });
    } catch (error) {
      console.error('Error fetching debt summary:', error);
      reply.code(500).send({ error: 'Failed to fetch debt summary', details: (error as Error).message });
    }
  });

  // GET /api/debts/:id/payments - Riwayat pembayaran hutang
  server.get<{ Params: { id: string } }>('/api/debts/:id/payments', async (request, reply) => {
    try {
      const payments = await listDebtPaymentsUseCase.execute(request.params.id);
      reply.code(200).send({ status: 'success', data: payments });
    } catch (error) {
      console.error('Error fetching debt payments:', error);
      reply.code(500).send({ error: 'Failed to fetch debt payments', details: (error as Error).message });
    }
  });

  // POST /api/debts/:id/payments - Bayar hutang
  server.post<{ Params: { id: string }; Body: { amount: number; paymentDate?: string; paymentMethod?: string; notes?: string; isInstallment?: boolean; installmentNumber?: number } }>('/api/debts/:id/payments', async (request, reply) => {
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
      console.error('Error paying debt:', error);
      reply.code(500).send({ error: 'Failed to pay debt', details: (error as Error).message });
    }
  });

  return server;
};
