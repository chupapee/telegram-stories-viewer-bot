import { newTaskReceived } from 'model';
import { session, Telegraf } from 'telegraf';

import { initUserbot } from '@entities/userbot';
import {
  BOT_TOKEN,
  IContextBot,
  SUPABASE_API_KEY,
  SUPABASE_PROJECT_URL,
} from '@shared/config';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(SUPABASE_PROJECT_URL, SUPABASE_API_KEY);
export const bot = new Telegraf<IContextBot>(BOT_TOKEN);

bot.use(session());

bot.catch((error) => {
  console.error(error, 'INDEX.TS');
});

bot.start(async (ctx) => {
  await ctx.reply('🔗 Please send a @username (@ symbol is necessary)');
});

bot.on('message', async (ctx) => {
  const handleMessage = async () => {
    if ('text' in ctx.message) {
      const text = ctx.message.text;

      // username
      if (text.startsWith('@')) {
        newTaskReceived({
          chatId: String(ctx.chat.id),
          link: text,
          linkType: 'username',
          locale: '',
          user: ctx.from,
        });
        return;
      }

      // particular story link
      if (text.startsWith('https') || text.startsWith('t.me/')) {
        const paths = text.split('/');
        if (
          !Number.isNaN(Number(paths.at(-1))) &&
          paths.at(-2) === 's' &&
          paths.at(-3)
        ) {
          newTaskReceived({
            chatId: String(ctx.chat.id),
            link: text,
            linkType: 'link',
            locale: '',
            user: ctx.from,
          });
          return;
        }
      }

      await ctx.reply('🚫 Please send a valid username');
    }
  };

  handleMessage();
});

bot.on('callback_query', (ctx) => {
  ctx.answerCbQuery('⏳ Please wait...');
  if ('data' in ctx.callbackQuery) {
    const [username, page] = ctx.callbackQuery.data.split('&');
    newTaskReceived({
      chatId: String(ctx?.from?.id ?? 0),
      link: username,
      linkType: 'username',
      currentPage: Number(page),
      locale: '',
      user: ctx.from,
    });
  }
});

bot.launch({ dropPendingUpdates: true });
initUserbot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
