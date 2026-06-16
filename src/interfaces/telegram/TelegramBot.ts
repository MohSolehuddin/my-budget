import { Telegraf, Context } from 'telegraf';
import type { BudgetService } from '../../domain/interfaces/BudgetService';
import type { DailyBudgetReport } from '../../use-cases/budget/GetDailyBudgetReportUseCase';

export class TelegramBot {
  private bot: Telegraf<Context>;

  constructor(token: string, private budgetService: BudgetService) {
    this.bot = new Telegraf(token);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.bot.start((ctx) => {
      ctx.reply(
        '💰 *MyBudget Bot*\n\n' +
        'Saya akan membantu Anda mengatur budget dan tracking pengeluaran harian.\n\n' +
        '*Perintah yang tersedia:*\n' +
        '/add - Tambah transaksi baru\n' +
        '/budget - Lihat progress budget\n' +
        '/report - Laporan budget harian\n' +
        '/help - Bantuan'
      );
    });

    this.bot.command('add', (ctx) => {
      ctx.reply('Masukkan detail transaksi:\n\n' +
        '*Format:*\n' +
        'Nama transaksi | Jumlah (Rp) | Kategori\n' +
        'Contoh: Makan siang | 50000 | Makanan & Minuman');
    });

    this.bot.command('budget', async (ctx) => {
      const progress: any[] = await this.budgetService.getBudgetProgress();
      let message = '📊 *Progress Budget Per Kategori*\n\n';
      progress.forEach((p: any) => {
        message += `*${p.categoryName}*\n` +
          `-budget: Rp ${(p.budgetAmount / 100).toLocaleString('id-ID')}\n` +
          `Terpakai: Rp ${(p.spentAmount / 100).toLocaleString('id-ID')} (${p.remainingPercentage.toFixed(1)}% sisa)\n\n`;
      });
      ctx.reply(message, { parse_mode: 'Markdown' });
    });

    this.bot.command('report', async (ctx) => {
      const report = await this.budgetService.getDailyBudgetReport();
      this.sendDailyReport(ctx, report);
    });

    this.bot.command('help', (ctx) => {
      ctx.reply(
        '*Bantuan MyBudget Bot*\n\n' +
        '/start - Mulai bot\n' +
        '/add - Tambah transaksi baru\n' +
        '/budget - Lihat progress budget\n' +
        '/report - Laporan budget harian\n' +
        '/setBudget - Ubah budget kategori\n' +
        '/help - Tampilkan pesan ini'
      );
    });

    this.bot.on('text', async (ctx) => {
      if (ctx.message.text.startsWith('/')) return;
      const parts = ctx.message.text.split('|').map(s => s.trim());
      if (parts.length >= 2) {
        const [title, amountStr, category] = parts;
        const amount = parseFloat(amountStr.replace(/\./g, '').replace(/,/g, '.'));
        if (!isNaN(amount) && amount > 0) {
          await this.budgetService.addTransaction({
            title,
            amount,
            date: new Date().toISOString().split('T')[0],
            categoryId: category,
          });
          ctx.reply(`✅ Transaksi "${title}" sebesar Rp ${amount.toLocaleString('id-ID')} berhasil dicatat!`);
        } else {
          ctx.reply('⚠️ Jumlah tidak valid. Mohon masukkan angka positif.');
        }
      } else {
        ctx.reply('⚠️ Format tidak sesuai. Gunakan: *Nama | Jumlah | Kategori*', { parse_mode: 'Markdown' });
      }
    });
  }

  private sendDailyReport(ctx: Context, report: DailyBudgetReport): void {
    let message = '📅 *Laporan Budget Harian*\n\n' +
      `📅 Tanggal: ${new Date().toLocaleDateString('id-ID')}\n` +
      `💰 Budget: Rp ${(report.totalBudget).toLocaleString('id-ID')}\n` +
      `💸 Terpakai: Rp ${(report.spent).toLocaleString('id-ID')}\n` +
      `剩余: Rp ${(report.remaining).toLocaleString('id-ID')}\n` +
      `📊 Sisa: ${report.remainingPercentage.toFixed(1)}%\n\n` +
      `📅 Hari tersisa: ${report.daysRemaining}\n` +
      `📈 Rata-rata/hari: Rp ${(report.projectedSpendPerDay).toLocaleString('id-ID')}\n` +
      `☀️ Budget hari ini: Rp ${(report.dailyAllowance).toLocaleString('id-ID')}`;

    ctx.reply(message, { parse_mode: 'Markdown' });
  }

  public start(): void {
    this.bot.launch();
    console.log('Telegram bot launched');
  }

  public stop(): void {
    this.bot.stop();
    console.log('Telegram bot stopped');
  }
}
