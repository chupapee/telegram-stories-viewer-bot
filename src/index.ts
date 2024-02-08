import { session, Telegraf } from 'telegraf';

import { initUserbot, messageInfoChanged } from '@entities/userbot';
import { processStories } from '@entities/userbot/model';
import { BOT_TOKEN, i18n, IContextBot } from '@shared/config';

export const bot = new Telegraf<IContextBot>(BOT_TOKEN);

bot.use(session());
bot.use(i18n.middleware());

bot.catch((error) => {
  console.error(error, 'INDEX.TS');
});

const lang = {
  ru: '🇷🇺 Язык изменен на русский!',
  en: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Language changed to English!',
};

bot.command('ru', async (ctx) => {
  ctx.i18n.locale('ru');
  await ctx.reply(lang.ru);
});

bot.command('en', async (ctx) => {
  ctx.i18n.locale('en');
  await ctx.reply(lang.en);
});

bot.start(async (ctx) => {
  await ctx.reply(ctx.i18n.t('start', { userId: ctx.from.id }));
});

bot.on('message', async (ctx) => {
  const handleMessage = async () => {
    if ('text' in ctx.message) {
      const targetUsername = ctx.message.text;
      if (targetUsername.includes('@')) {
        messageInfoChanged({
          chatId: String(ctx.chat.id),
          targetUsername,
          locale: ctx.i18n.locale(),
        });
        await ctx.reply(ctx.i18n.t('processing'));
        processStories(targetUsername);
      } else await ctx.reply(ctx.i18n.t('invalidUsername'));
    }
  };

  handleMessage();
});

bot.launch({ dropPendingUpdates: true });
initUserbot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
