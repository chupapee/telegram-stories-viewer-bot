import { Userbot } from 'config/userbot';
import { bot } from 'index';
import { chunkMediafiles } from 'lib';
import {
  cleanUpTempMessagesFired,
  tempMessageSent,
} from 'services/stories-service';
import { Markup } from 'telegraf';
import { Api } from 'telegram';

import { downloadStories, mapStories } from './download-stories';
import { notifyAdmin } from './send-message';
import { SendStoriesArgs } from './types';

export async function sendActiveStories({ stories, task }: SendStoriesArgs) {
  let mapped = mapStories(stories);

  // TODO: move to a separate function
  let hasMorePages = false;
  const nextStories: Record<string, number[]> = {};

  const PER_PAGE = 5;

  if (stories.length > 5) {
    hasMorePages = true;

    const currentStories = mapped.slice(0, 5);

    for (let i = PER_PAGE; i < mapped.length; i += PER_PAGE) {
      const from = i + 1;
      const to = Math.min(i + PER_PAGE, mapped.length);
      nextStories[`${from}-${to}`] = mapped
        .slice(i, i + PER_PAGE)
        .map((x) => x.id);
    }

    mapped = currentStories;
  }

  // TODO: move to a separate function
  const storiesWithoutMedia = mapped.filter((x) => !x.media);

  if (storiesWithoutMedia.length > 0) {
    mapped = mapped.filter((x) => Boolean(x.media));

    const client = await Userbot.getInstance();
    const entity = await client.getEntity(task.link!);

    const ids = storiesWithoutMedia.map((x) => x.id);

    const storiesWithMedia = await client.invoke(
      new Api.stories.GetStoriesByID({
        id: ids,
        peer: entity,
      })
    );

    mapped.push(...mapStories(storiesWithMedia.stories));
  }

  try {
    console.log(`downloading ${mapped.length} active stories`);

    bot.telegram
      .sendMessage(task.chatId!, '⏳ Downloading Active stories...')
      .then(({ message_id }) => {
        tempMessageSent(message_id);
      })
      .catch(() => null);

    await downloadStories(mapped, 'active');

    const uploadableStories = mapped.filter(
      (x) => x.buffer && x.bufferSize! <= 47 // skip too large file
    );

    console.log(`active stories downloaded`);

    console.log(
      `sending ${uploadableStories.length} uploadable pinned stories`
    );

    bot.telegram
      .sendMessage(
        task.chatId,

        `📥 ${uploadableStories.length} Active stories downloaded successfully!\n` +
          '⏳ Uploading stories to Telegram...'
      )
      .then(({ message_id }) => {
        tempMessageSent(message_id);
      })
      .catch(() => null);

    console.log(
      `sending ${uploadableStories.length} uploadable active stories`
    );

    if (uploadableStories.length > 0) {
      const chunkedList = chunkMediafiles(uploadableStories);

      for (const album of chunkedList) {
        await bot.telegram.sendMediaGroup(
          task.chatId,
          album.map((x) => ({
            media: { source: x.buffer! },
            type: x.mediaType,
            caption: x.caption ?? 'Active stories',
          }))
        );
      }
    } else {
      await bot.telegram.sendMessage(
        task.chatId,
        '❌ Cannot download Active stories, most likely they have too large size to send them via bot'
      );
    }

    if (hasMorePages) {
      // TODO: move to a separate function
      const btns = Object.entries(nextStories).map(
        ([pages, nextStoriesIds]) => ({
          text: `📥 ${pages} 📥`,
          callback_data: `${task.link}&${JSON.stringify(nextStoriesIds)}`,
        })
      );

      // TODO: move to a separate function
      const res = btns.reduce<any>((acc, curr, index) => {
        const chunkIndex = Math.floor(index / 3);

        if (!acc[chunkIndex]) {
          acc[chunkIndex] = [];
        }

        acc[chunkIndex].push(curr);

        return acc;
      }, []);

      await bot.telegram.sendMessage(
        task.chatId,
        `Uploaded ${PER_PAGE}/${stories.length} active stories ✅`,
        Markup.inlineKeyboard(res)
      );
    }

    notifyAdmin({
      status: 'info',
      baseInfo: `📥 ${uploadableStories.length} Active stories uploaded to user!`,
    });
  } catch (error) {
    notifyAdmin({
      task,
      status: 'error',
      errorInfo: { cause: error },
    });
    console.log('error occured on sending ACTIVE stories:', error);
  }
  cleanUpTempMessagesFired();
}
