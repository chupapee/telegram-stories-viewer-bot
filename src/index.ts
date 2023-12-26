import { session, Telegraf } from 'telegraf';

import { addMsgToRemoveList } from '@features/bot';
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
			const text = ctx.message.text;
			if (text.includes('@')) {
				const { message_id } = await ctx.reply(ctx.i18n.t('processingLink'));
				addMsgToRemoveList(message_id, ctx);
			} else await ctx.reply(ctx.i18n.t('invalidLink'));
		}
	};

	handleMessage();
});

bot.launch({ dropPendingUpdates: true });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
