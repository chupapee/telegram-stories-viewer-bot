import { createEffect } from 'effector';
import { bot } from 'index';
import { tempMessageSent, UserInfo } from 'model';
import { Api } from 'telegram';
import {
  chunkMediafiles,
  downloadStories,
  mapStories,
  notifyAdmin,
} from 'utils';

import { Userbot } from '@entities/userbot/model';
import { timeout } from '@shared/lib';

// ----- GET -----
export const getAllStoriesFx = createEffect(async (task: UserInfo) => {
  try {
    const client = await Userbot.getInstance();
    const entity = await client.getEntity(task.link);

    const tempText = '⏳ Fetching stories...';
    const { message_id } = await bot.telegram.sendMessage(
      task.chatId!,
      tempText
    );
    notifyAdmin({ task, status: 'start' });

    tempMessageSent({ id: message_id, text: tempText });

    let activeStories: Api.TypeStoryItem[] = [];
    let pinnedStories: Api.TypeStoryItem[] = [];
    console.log('getting active stories');
    const active = await client.invoke(
      new Api.stories.GetPeerStories({ peer: entity })
    );
    console.log('getting pinned stories');
    const pinned = await client.invoke(
      new Api.stories.GetPinnedStories({ peer: entity })
    );

    if (active.stories.stories.length > 0) {
      activeStories = active.stories.stories;
    }
    if (pinned.stories.length > 0) {
      pinnedStories = pinned.stories.filter(
        (x) => !activeStories.some((y) => y.id === x.id)
      );
    }

    if (activeStories.length > 0 || pinnedStories.length > 0) {
      const text =
        `⚡️ ${activeStories.length} Active stories found and\n` +
        `📌 ${pinnedStories.length} Pinned ones!`;

      bot.telegram.editMessageText(task.chatId, message_id, undefined, text);
      tempMessageSent({ id: message_id, text });
      notifyAdmin({
        status: 'info',
        baseInfo: text,
      });
      return { activeStories, pinnedStories };
    }

    return '🚫 Stories not found!';
  } catch (error) {
    console.log('ERROR occured:', error);

    // TODO: set sleep time after each request to avoid this error
    if (JSON.stringify(error).includes('FloodWaitError')) {
      return '⚠️ Too much requests accepted from users, please try again later';
    }
    return '🚫 Wrong link to user!';
  }
});

export const getParticularStory = createEffect(async (task: UserInfo) => {
  try {
    const client = await Userbot.getInstance();
    const linkPaths = task.link.split('/');
    const storyId = Number(linkPaths.at(-1));
    const username = linkPaths.at(-3);

    const entity = await client.getEntity(username!);

    const { message_id } = await bot.telegram.sendMessage(
      task.chatId!,
      '⏳ Fetching story...'
    );
    notifyAdmin({ task, status: 'start' });

    tempMessageSent({ id: message_id });

    const storyData = await client.invoke(
      new Api.stories.GetStoriesByID({ id: [storyId], peer: entity })
    );

    if (storyData.stories.length === 0) throw new Error('stories not found!');

    const text = '⚡️ Story founded successfully!';
    await bot.telegram.editMessageText(
      task.chatId!,
      message_id,
      undefined,
      text
    );
    tempMessageSent({ id: message_id, text });

    return {
      activeStories: [],
      pinnedStories: [],
      particularStory: storyData.stories[0],
    };
  } catch (error) {
    console.log('ERROR occured:', error);
    return '🚫 Something wrong with the link!';
  }
});

// ----- SEND -----
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

export const sendErrorMessageFx = createEffect(
  async ({ task, message }: { task: UserInfo; message: string }) => {
    console.log('error occured:', message);
    notifyAdmin({
      task,
      status: 'error',
      errorInfo: { cause: message },
    });
    bot.telegram.sendMessage(task.chatId, message);
  }
);

interface SendStoriesArgs {
  stories: Api.TypeStoryItem[];
  task: UserInfo;
}

async function sendActiveStories({ stories, task }: SendStoriesArgs) {
  const mapped = mapStories(stories);

  try {
    if (task.tempMessage?.id) {
      bot.telegram.editMessageText(
        task.chatId!,
        task.tempMessage.id,
        undefined,
        task.tempMessage.text + '\n⏳ Downloading Active stories...'
      );
    }
    console.log(`downloading ${mapped.length} active stories`);

    await downloadStories(mapped, 'active');

    console.log(`active stories downloaded`);

    const uploadableStories = mapped.filter(
      (x) => x.buffer && x.buffer.byteLength <= 47 * 1024 * 1024 // max size = 50mb
    );

    if (task.tempMessage?.id) {
      bot.telegram.editMessageText(
        task.chatId,
        task.tempMessage.id,
        undefined,
        task.tempMessage.text +
          `\n📥 ${uploadableStories.length} Active stories downloaded successfully!\n` +
          '⏳ Uploading stories to Telegram...'
      );
    }
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
            caption: 'Active stories',
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
    if (task.tempMessage?.id) {
      bot.telegram.editMessageText(
        task.chatId!,
        task.tempMessage.id,
        undefined,
        task.tempMessage.text +
          '\n✅ Active stories processed!\n' +
          '⏳ Downloading Pinned stories...'
      );
    }

    await downloadStories(mapped, 'pinned');
    const uploadableStories = mapped.filter(
      (x) => x.buffer && x.bufferSize! < 50 // skip too large file
    );

    console.log(`pinned stories downloaded`);

    console.log(
      `sending ${uploadableStories.length} uploadable pinned stories`
    );
    if (task.tempMessage?.id) {
      bot.telegram.editMessageText(
        task.chatId!,
        task.tempMessage.id,
        undefined,
        task.tempMessage.text +
          '\n✅ Active stories processed!\n' +
          `📥 ${uploadableStories.length} Pinned stories downloaded successfully!\n` +
          '⏳ Uploading stories to Telegram...'
      );
    }

    if (uploadableStories.length > 0) {
      await bot.telegram.sendMediaGroup(
        task.chatId,
        uploadableStories.map((x) => ({
          media: { source: x.buffer! },
          type: x.mediaType,
          caption: 'Pinned stories',
        }))
      );
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
}

async function sendParticularStory({
  story,
  task,
}: Omit<SendStoriesArgs, 'stories'> & {
  story: Api.TypeStoryItem;
}) {
  const mapped = mapStories([story]);

  try {
    if (task.tempMessage?.id) {
      await bot.telegram.editMessageText(
        task.chatId,
        task.tempMessage.id,
        undefined,
        task.tempMessage.text + '\n⏳ Downloading...'
      );
    }

    await downloadStories(mapped, 'active');

    const story = mapped[0];

    if (story.buffer) {
      if (task.tempMessage?.id) {
        bot.telegram.editMessageText(
          task.chatId,
          task.tempMessage.id,
          undefined,
          task.tempMessage.text + '\n⏳ Uploading to Telegram...'
        );
      }
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
}
