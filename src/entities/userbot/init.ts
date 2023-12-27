import EventEmitter from 'events';
import { bot } from 'index';

import { i18n, IContextBot } from '@shared/config';
import { Queue } from '@shared/lib';

import { downloadLink, getTextInsideQuotes } from './lib';
import { processStories, Userbot } from './model';

export interface UserMessage {
  chatId: string;
  targetUsername: string;
  locale: string;
}

const usersQueue = Queue.getInstance<UserMessage>();
export const queueEmitter = new EventEmitter();
let processing: UserMessage | null = null;

queueEmitter.on('pushed', async (ctx: IContextBot) => {
  console.warn('push emmited');

  if (processing !== null) {
    await ctx.reply(ctx.i18n.t('queued'));
    return;
  }
  queueEmitter.emit('runProcess');
});

queueEmitter.on('runProcess', async () => {
  console.warn('run process emitted');

  const data = usersQueue.shift();
  if (data) {
    processing = { ...data };
    const { targetUsername, chatId, locale } = data;
    await bot.telegram.sendMessage(chatId, i18n.t(locale, 'processing'));
    processStories(targetUsername);
  }
});

queueEmitter.on('messageLoaded', async (event) => {
  try {
    const messageData = event?.message;
    const entities: { url?: string }[] | null = event?.message?.entities;
    console.log({ msg: messageData.message, processing });

    if (processing && entities && entities.length > 0) {
      const { chatId } = processing;

      const mediaGroup: {
        media: { source: Buffer };
        type: 'photo' | 'video';
        caption?: string;
      }[] = [];

      const links: string[] = [];

      for (const link of entities) {
        if (link.url) {
          const result = await downloadLink(link.url);

          if (result instanceof Buffer) {
            const type = link.url.includes('video') ? 'video' : 'photo';
            mediaGroup.push({ media: { source: result }, type });
            continue;
          }
          links.push(result);
        }
      }

      if (mediaGroup.length > 0) {
        mediaGroup[0].caption = getTextInsideQuotes(messageData.message);

        await bot.telegram.sendMediaGroup(chatId, mediaGroup);
      }

      if (links.length > 0) {
        const formatted = links
          .map((link, i) => `<a href="${link}">${i} ссылка</a>`)
          .join('\n');
        await bot.telegram.sendMessage(chatId, formatted, {
          parse_mode: 'HTML',
        });
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    queueEmitter.emit('processFinished');
  }
});

export async function initUserbot() {
  await Userbot.getInstance(); // init

  Userbot.addEventListener('messages', async (event) => {
    queueEmitter.emit('messageLoaded', event);
  });
}

queueEmitter.on('processFinished', () => {
  processing = null;
  if (!usersQueue.isEmpty()) {
    queueEmitter.emit('runProcess');
  }
});
