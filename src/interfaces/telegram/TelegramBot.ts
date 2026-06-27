import { Telegraf, Context } from 'telegraf';
import type { BudgetService } from '../../domain/interfaces/BudgetService';
import type { DebtRepository } from '../../domain/interfaces/DebtRepository';
import type { DailyBudgetReport } from '../../use-cases/budget/GetDailyBudgetReportUseCase';
import {
  CreateDebtUseCase,
  ListDebtsUseCase,
  GetDebtSummaryUseCase,
  PayDebtUseCase,
  ListDebtPaymentsUseCase,
} from '../../use-cases/debt/DebtUseCases';

export class TelegramBot {
  private bot: Telegraf<Context>;
  private listDebtsUseCase: ListDebtsUseCase;
  private createDebtUseCase: CreateDebtUseCase;
  private getDebtSummaryUseCase: GetDebtSummaryUseCase;
  private payDebtUseCase: PayDebtUseCase;
  private listDebtPaymentsUseCase: ListDebtPaymentsUseCase;

  constructor(token: string, private budgetService: BudgetService, debtRepository: DebtRepository) {
    this.bot = new Telegraf(token);
    this.listDebtsUseCase = new ListDebtsUseCase(debtRepository);
    this.createDebtUseCase = new CreateDebtUseCase(debtRepository);
    this.getDebtSummaryUseCase = new GetDebtSummaryUseCase(debtRepository);
    this.payDebtUseCase = new PayDebtUseCase(debtRepository);
    this.listDebtPaymentsUseCase = new ListDebtPaymentsUseCase(debtRepository);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.bot.start((ctx) => {
      ctx.reply(
        '💰 *MyBudget Bot*\n\n' +
        'Saya akan membantu Anda mengatur budget, tracking pengeluaran harian, dan hutang/paylater.\n\n' +
        '*Perintah yang tersedia:*\n' +
        '/add - Tambah transaksi baru\n' +
        '/budget - Lihat progress budget\n' +
        '/report - Laporan budget harian\n' +
        '/debt - Lihat daftar hutang\n' +
        '/debtSummary - Ringkasan hutang\n' +
        '/addDebt - Tambah hutang/paylater\n' +
        '/payDebt - Bayar hutang\n' +
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
        '/debt - Lihat daftar hutang\n' +
        '/debtSummary - Ringkasan hutang\n' +
        '/addDebt - Tambah hutang/paylater\n' +
        '/payDebt - Bayar hutang\n' +
        '/setBudget - Ubah budget kategori\n' +
        '/help - Tampilkan pesan ini'
      );
    });

    // ===== DEBT COMMANDS =====

    this.bot.command('debt', async (ctx) => {
      const debts = await this.listDebtsUseCase.execute();
      if (debts.length === 0) {
        ctx.reply('✅ Saat ini tidak ada hutang aktif.');
        return;
      }
      let message = '💳 *Daftar Hutang*\n\n';
      debts.forEach((d: any, i: number) => {
        const icon = this.debtTypeIcon(d.type);
        message += `${i + 1}. ${icon} *${d.name}*\n`;
        message += `   Total: Rp ${d.originalAmount.toLocaleString('id-ID')}\n`;
        message += `   Sisa: Rp ${d.remainingAmount.toLocaleString('id-ID')}\n`;
        message += `   Status: ${d.status}\n`;
        if (d.dueDate) {
          message += `   Jatuh tempo: ${new Date(d.dueDate).toLocaleDateString('id-ID')}\n`;
        }
        message += '\n';
      });
      ctx.reply(message, { parse_mode: 'Markdown' });
    });

    this.bot.command('debtSummary', async (ctx) => {
      const summary = await this.getDebtSummaryUseCase.execute();
      let message = '📊 *Ringkasan Hutang*\n\n';
      message += `Total Hutang: Rp ${summary.totalDebt.toLocaleString('id-ID')}\n`;
      message += `Total Sisa: Rp ${summary.totalRemaining.toLocaleString('id-ID')}\n`;
      message += `Total Sudah Bayar: Rp ${summary.totalPaid.toLocaleString('id-ID')}\n`;
      message += `Hutang Aktif: ${summary.activeDebts}\n`;
      message += `Lunas: ${summary.paidOffDebts}\n\n`;
      if (summary.upcomingPayments?.length) {
        message += '*Tagihan 30 hari ke depan:*\n';
        summary.upcomingPayments.forEach((u: any) => {
          message += `• ${u.name}: Rp ${u.amount.toLocaleString('id-ID')} (${u.daysUntilDue} hari)\n`;
        });
      }
      ctx.reply(message, { parse_mode: 'Markdown' });
    });

    this.bot.command('addDebt', (ctx) => {
      ctx.reply(
        'Tambah hutang/paylater:\n\n' +
        '*Format:*\n' +
        'Nama | Jumlah | Tipe | Bunga(%) | Jangka(bulan)\n' +
        'Tipe: paylater, credit_card, loan, installment, other\n' +
        'Contoh: ShopeePayLater | 2000000 | paylater | 0 | 12'
      );
    });

    this.bot.command('payDebt', (ctx) => {
      ctx.reply(
        'Bayar hutang:\n\n' +
        '*Format:*\n' +
        'Bayar | Nama Hutang | Jumlah Bayar | Tanggal (YYYY-MM-DD)\n' +
        'Contoh: Bayar | ShopeePayLater | 500000 | 2026-06-20'
      );
    });

    this.bot.on('text', async (ctx) => {
      if (ctx.message.text.startsWith('/')) return;
      const text = ctx.message.text.trim();
      const lines = text.split('\n').map((s) => s.trim());
      let handled = false;

      for (const line of lines) {
        const parts = line.split('|').map((s) => s.trim());

        // Debt payment: triggered when first column matches 'Bayar'
        if (parts[0].toLowerCase() === 'bayar' && parts.length >= 3) {
          const [bayarWord, debtName, amountStr, dateStr] = parts;
          const debts = await this.listDebtsUseCase.execute();
          const matchedDebt = debts.find((d: any) => d.name.toLowerCase() === debtName.toLowerCase());
          const amount = parseFloat(amountStr.replace(/\./g, '').replace(/,/g, '.'));

          if (matchedDebt && !isNaN(amount) && amount > 0) {
            const paymentDate = dateStr || new Date().toISOString().split('T')[0];
            await this.payDebtUseCase.execute({
              debtId: matchedDebt.id,
              amount,
              paymentDate,
              isInstallment: false,
            });
            
            // Integrasi ke Budget
            await this.budgetService.addTransaction({
              title: `Bayar Hutang: ${matchedDebt.name}`,
              amount: amount,
              date: paymentDate,
              categoryId: 'Pembayaran Hutang',
            });

            ctx.reply(`✅ Pembayaran Rp ${amount.toLocaleString('id-ID')} untuk "${matchedDebt.name}" berhasil dicatat!\nSisa hutang: Rp ${Math.max(0, matchedDebt.remainingAmount - amount).toLocaleString('id-ID')}\n(Otomatis tercatat sebagai pengeluaran)`);
            handled = true;
            continue;
          } else {
            ctx.reply(`❌ Hutang "${debtName}" tidak ditemukan atau jumlah tidak valid.`);
            handled = true;
            continue;
          }
        }

        // Add debt: 3-5 parts
        if (parts.length >= 3) {
          const [name, amountStr, type, interestStr, termStr] = parts;
          const amount = parseFloat(amountStr.replace(/\./g, '').replace(/,/g, '.'));
          const validTypes = ['paylater', 'credit_card', 'loan', 'installment', 'other'];
          if (validTypes.includes(type) && !isNaN(amount) && amount > 0) {
            const debt = await this.createDebtUseCase.execute({
              name,
              originalAmount: amount,
              remainingAmount: amount,
              type: type as any,
              status: 'active',
              startDate: new Date().toISOString().split('T')[0],
              interestRate: interestStr ? parseFloat(interestStr) : undefined,
              termMonths: termStr ? parseInt(termStr, 10) : undefined,
              currency: 'IDR',
              autoDebit: false,
            });
            ctx.reply(`✅ Hutang "${debt.name}" sebesar Rp ${debt.originalAmount.toLocaleString('id-ID')} berhasil ditambahkan!`);
            handled = true;
            continue;
          }
        }

        // Fallback: add transaction
        if (parts.length >= 2 && !handled) {
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
            ctx.reply('⚠️ Format tidak sesuai. Gunakan salah satu:\n• *Nama | Jumlah | Kategori*\n• *Bayar | Nama Hutang | Jumlah Bayar*\n• *Nama Hutang | Jumlah | Tipe | Bunga | Jangka*', { parse_mode: 'Markdown' });
          }
        }
      }
    });
  }

  private debtTypeIcon(type: string): string {
    switch (type) {
      case 'paylater': return '💳';
      case 'credit_card': return '💰';
      case 'loan': return '📄';
      case 'installment': return '📅';
      default: return '🔖';
    }
  }

  private sendDailyReport(ctx: Context, report: DailyBudgetReport): void {
    let message = '📅 *Laporan Budget Harian*\n\n' +
      `📅 Tanggal: ${new Date().toLocaleDateString('id-ID')}\n` +
      `💰 Budget: Rp ${(report.totalBudget).toLocaleString('id-ID')}\n` +
      `💸 Terpakai: Rp ${(report.spent).toLocaleString('id-ID')}\n` +
      `🧾 Sisa: Rp ${(report.remaining).toLocaleString('id-ID')}\n` +
      `📊 Persentase sisa: ${report.remainingPercentage.toFixed(1)}%\n\n` +
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
