import { newTaskReceived } from 'model';
import { session, Telegraf } from 'telegraf';
import { callbackQuery, message } from 'telegraf/filters';

import { initUserbot } from '@entities/userbot';
import {
  BOT_ADMIN_ID,
  BOT_TOKEN,
  IContextBot,
  SUPABASE_API_KEY,
  SUPABASE_PROJECT_URL,
} from '@shared/config';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(SUPABASE_PROJECT_URL, SUPABASE_API_KEY);
export const bot = new Telegraf<IContextBot>(BOT_TOKEN);
const RESTART_COMMAND = 'restart';

bot.use(session());

bot.catch((error) => {
  console.error(error, 'INDEX.TS');
});

bot.start(async (ctx) => {
  await ctx.reply('🔗 Please send a @username (@ symbol is necessary)');
});

bot.on(message('text'), async (ctx) => {
  const handleMessage = async () => {
    const text = ctx.message.text;

    // username
    if (text.startsWith('@')) {
      newTaskReceived({
        chatId: String(ctx.chat.id),
        link: text,
        linkType: 'username',
        locale: '',
        user: ctx.from,
        initTime: Date.now(),
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
          initTime: Date.now(),
        });
        return;
      }
    }

    // restart action
    if (ctx.from.id === BOT_ADMIN_ID && ctx.message.text === RESTART_COMMAND) {
      ctx.reply('Are you sure?', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Yes', callback_data: RESTART_COMMAND }]],
        },
      });
      return;
    }

    await ctx.reply('🚫 Please send a valid username');
  };

  handleMessage();
});

bot.on(callbackQuery('data'), async (ctx) => {
  // handle stories pagination
  if (ctx.callbackQuery.data.includes('&')) {
    const [pageType, username, page] = ctx.callbackQuery.data.split('&');
    newTaskReceived({
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      chatId: String(ctx?.from?.id),
      link: username,
      linkType: 'username',
      currentPage: Number(page),
      pageType: pageType as 'active' | 'pinned',
      locale: '',
      user: ctx.from,
      initTime: Date.now(),
    });
  }

  // restart action
  if (
    ctx.callbackQuery.data === RESTART_COMMAND &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    ctx?.from?.id === BOT_ADMIN_ID
  ) {
    await ctx.answerCbQuery('⏳ Restarting...');
    process.exit();
  }
});

bot.launch({ dropPendingUpdates: true });
initUserbot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
