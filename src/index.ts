import { createServer } from './infrastructure/web/Server';
import { TelegramBot } from './interfaces/telegram/TelegramBot';
import { BudgetServiceImpl } from './use-cases/budget/BudgetServiceImpl';
import { PocketBaseService } from './infrastructure/database/pocketbase/PocketBaseService';
import { PocketBaseDebtRepository } from './infrastructure/database/pocketbase/PocketBaseDebtRepository';

const start = async () => {
  try {
    const server = await createServer();
    const port = parseInt(process.env.PORT || '3002', 10);
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });
    console.log(`✅ Budget API ready at http://${host}:${port}`);

    // Start Telegram bot if token is configured
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      const budgetService = new BudgetServiceImpl();
      const pbService = new PocketBaseService(
        process.env.POCKETBASE_URL || 'http://localhost:8091',
        process.env.POCKETBASE_TOKEN
      );
      const debtRepository = new PocketBaseDebtRepository(pbService);
      const bot = new TelegramBot(botToken, budgetService, debtRepository);
      bot.start();
    }
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
