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

    const text = '⚡️ Story founded successfully!';
    bot.telegram.editMessageText(task.chatId!, message_id, undefined, text);
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
    return '🚫 Wrong username!';
  }
});

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

    if (activeStories.length > 0) {
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
      status: 'error',
      errorInfo: { cause: message, targetUsername: task.link },
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
      status: 'error',
      errorInfo: { cause: error, targetUsername: task.link },
    });
    console.log('error occured on sending ACTIVE stories:', error);
  }
}

async function sendPinnedStories({ stories, task }: SendStoriesArgs) {
  const mapped = mapStories(stories)
    .sort((x, y) => {
      if (x.mediaType === 'photo') return -1;
      if (y.mediaType === 'photo') return 1;
      return 0;
    })
    .slice(0, 21);

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
      const chunkedList = chunkMediafiles(uploadableStories);

      for (const album of chunkedList) {
        await bot.telegram.sendMediaGroup(
          task.chatId,
          album.map((x) => ({
            media: { source: x.buffer! },
            type: x.mediaType,
            caption: 'Pinned stories',
          }))
        );
      }
    } else {
      await bot.telegram.sendMessage(
        task.chatId,
        '❌ Cannot download Pinned stories, most likely they have too large size to send them via bot'
      );
    }

    notifyAdmin({
      status: 'info',
      baseInfo: `📥 ${uploadableStories.length} Pinned stories uploaded to user!`,
    });
  } catch (error) {
    notifyAdmin({
      status: 'error',
      errorInfo: { cause: error, targetUsername: task.link },
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
      errorInfo: { cause: error, targetUsername: task.link },
    });
    console.log('error occured on sending PINNED stories:', error);
  }
}
