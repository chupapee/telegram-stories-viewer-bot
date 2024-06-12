import { createEffect } from 'effector';
import { bot } from 'index';
import { chunkMediafiles, timeout } from 'lib';
import {
  cleanUpTempMessagesFired,
  tempMessageSent,
  UserInfo,
} from 'services/stories-service';
import { Api } from 'telegram';

import { downloadStories, mapStories } from './download-stories';
import { notifyAdmin } from './send-message';

export const sendStoriesFx = createEffect(
  async ({
    activeStories = [],
    pinnedStories = [],
    particularStory,
    task,
  }: {
    activeStories: Api.TypeStoryItem[];
    pinnedStories: Api.TypeStoryItem[];
    particularStory?: Api.TypeStoryItem;
    task: UserInfo;
  }) => {
    if (particularStory) {
      await sendParticularStory({ story: particularStory, task });
    }

    if (!task.currentPage && activeStories.length > 0) {
      await sendActiveStories({ stories: activeStories, task });
    }

    if (pinnedStories.length > 0) {
      await sendPinnedStories({ stories: pinnedStories, task });
    }
  }
);

interface SendStoriesArgs {
  stories: Api.TypeStoryItem[];
  task: UserInfo;
}

async function sendActiveStories({ stories, task }: SendStoriesArgs) {
  const mapped = mapStories(stories);

  try {
    const { message_id } = await bot.telegram.sendMessage(
      task.chatId!,
      '⏳ Downloading Active stories...'
    );
    tempMessageSent(message_id);

    console.log(`downloading ${mapped.length} active stories`);

    await downloadStories(mapped, 'active');

    console.log(`active stories downloaded`);

    const uploadableStories = mapped.filter(
      (x) => x.buffer && x.buffer.byteLength <= 47 * 1024 * 1024 // max size = 50mb
    );

    bot.telegram
      .sendMessage(
        task.chatId,

        `📥 ${uploadableStories.length} Active stories downloaded successfully!\n` +
          '⏳ Uploading stories to Telegram...'
      )
      .then(({ message_id }) => {
        tempMessageSent(message_id);
      });

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

    notifyAdmin({
      status: 'info',
      baseInfo: `📥 ${uploadableStories.length} Active stories uploaded to user!`,
    });
    await timeout(2000);
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

async function sendPinnedStories({ stories, task }: SendStoriesArgs) {
  let mapped = mapStories(stories);

  let hasMorePages = false;
  let nextPage: number | null = null;
  const PER_PAGE = 5;

  if (stories.length > 5) {
    hasMorePages = true;
    const currentPage = task.currentPage ?? 1;
    const totalPages = Math.ceil(stories.length / PER_PAGE);

    const from = (currentPage - 1) * PER_PAGE;
    const to = from + PER_PAGE;
    mapped = mapped.slice(from, to);

    nextPage = currentPage + 1;

    if (totalPages < nextPage) {
      hasMorePages = false;
      nextPage = null;
    }
  }

  try {
    console.log(`downloading ${mapped.length} pinned stories`);
    bot.telegram
      .sendMessage(
        task.chatId!,
        '✅ Active stories processed!\n' + '⏳ Downloading Pinned stories...'
      )
      .then(({ message_id }) => {
        tempMessageSent(message_id);
      })
      .catch(() => null);

    await downloadStories(mapped, 'pinned');
    const uploadableStories = mapped.filter(
      (x) => x.buffer && x.bufferSize! < 50 // skip too large file
    );

    console.log(`pinned stories downloaded`);

    console.log(
      `sending ${uploadableStories.length} uploadable pinned stories`
    );
    bot.telegram
      .sendMessage(
        task.chatId!,
        '✅ Active stories processed!\n' +
          `📥 ${uploadableStories.length} Pinned stories downloaded successfully!\n` +
          '⏳ Uploading stories to Telegram...'
      )
      .then(({ message_id }) => {
        tempMessageSent(message_id);
      })
      .catch(() => null);

    if (uploadableStories.length > 0) {
      const chunkedList = chunkMediafiles(uploadableStories);

      for (const album of chunkedList) {
        await bot.telegram.sendMediaGroup(
          task.chatId,
          album.map((x) => ({
            media: { source: x.buffer! },
            type: x.mediaType,
            caption: x.caption ?? 'Pinned stories',
          }))
        );
      }
    } else {
      await bot.telegram.sendMessage(
        task.chatId,
        '❌ Cannot download Pinned stories, most likely they have too large size to send them via bot'
      );
    }

    if (hasMorePages && nextPage) {
      await bot.telegram.sendMessage(
        task.chatId,
        `Uploaded ${(nextPage - 1) * Number(PER_PAGE)}/${
          stories.length
        } pinned stories ✅`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📥 Download more 📥',
                  callback_data: `${task.link}&${nextPage}`,
                },
              ],
            ],
          },
        }
      );
    }

    notifyAdmin({
      status: 'info',
      baseInfo: `📥 ${uploadableStories.length} Pinned stories uploaded to user!`,
    });
  } catch (error) {
    notifyAdmin({
      status: 'error',
      task,
      errorInfo: { cause: error },
    });
    console.log('error occured on sending PINNED stories:', error);
  }
  cleanUpTempMessagesFired();
}

async function sendParticularStory({
  story,
  task,
}: Omit<SendStoriesArgs, 'stories'> & {
  story: Api.TypeStoryItem;
}) {
  const mapped = mapStories([story]);

  try {
    bot.telegram
      .sendMessage(task.chatId, '⏳ Downloading...')
      .then(({ message_id }) => tempMessageSent(message_id))
      .catch(() => null);

    await downloadStories(mapped, 'active');

    const story = mapped[0];

    if (story.buffer) {
      bot.telegram
        .sendMessage(task.chatId, '⏳ Uploading to Telegram...')
        .then(({ message_id }) => tempMessageSent(message_id))
        .catch(() => null);
      await bot.telegram.sendMediaGroup(task.chatId, [
        {
          media: { source: story.buffer },
          type: story.mediaType,
          caption:
            `${story.caption ? `${story.caption}\n` : ''}` +
            `\n📅 Post date: ${story.date.toUTCString()}`,
        },
      ]);
    }
    notifyAdmin({
      status: 'info',
      baseInfo: `📥 Particular story uploaded to user!`,
    });
  } catch (error) {
    notifyAdmin({
      status: 'error',
      task,
      errorInfo: { cause: error },
    });
    console.log('error occured on sending PINNED stories:', error);
  }
  cleanUpTempMessagesFired();
}
