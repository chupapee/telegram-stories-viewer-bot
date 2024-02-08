import { createEvent, createStore } from 'effector';
import { bot } from 'index';

import { downloadLink, getTextInsideQuotes } from './lib';
import { Userbot } from './model';

interface MessageInfo {
  chatId: string;
  targetUsername: string;
  locale: string;
}

const $messageInfo = createStore<MessageInfo | null>(null);
export const messageInfoChanged = createEvent<MessageInfo>();

$messageInfo.on(messageInfoChanged, (_, payload) => payload);

export async function initUserbot() {
  await Userbot.getInstance(); // init

  Userbot.addEventListener('messages', async (event) => {
    try {
      const messageData = event?.message;
      const entities: { url?: string }[] | null = event?.message?.entities;

      if (entities && entities.length > 0) {
        const { chatId = '' } = $messageInfo.getState() ?? {};

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

          console.log('sending media-group');
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
    }
  });
}
