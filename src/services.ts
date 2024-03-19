import { createEffect } from 'effector';
import { bot } from 'index';
import { $currentTask, $tasksQueue, MessageInfo, tempMessageSent } from 'model';
import { Api } from 'telegram';
import {
  chunkMediafiles,
  downloadStories,
  mapStories,
  notifyAdmin,
} from 'utils';

import { Userbot } from '@entities/userbot/model';
import { timeout } from '@shared/lib';

export const getAllStoriesFx = createEffect(async (task: MessageInfo) => {
  try {
    const client = await Userbot.getInstance();
    const entity = await client.getEntity(task.targetUsername);
    let activeStories: Api.TypeStoryItem[] = [];
    let pinnedStories: Api.TypeStoryItem[] = [];

    const { message_id } = await bot.telegram.sendMessage(
      task.chatId!,
      '⏳ Fetching Active stories...'
    );
    notifyAdmin({ task, status: 'start' });

    tempMessageSent(message_id);

    console.log('getting active stories');

    const active = await client.invoke(
      new Api.stories.GetPeerStories({ peer: entity })
    );

    if (active.stories.stories.length > 0) {
      activeStories = active.stories.stories;
    }

    if (message_id) {
      bot.telegram.editMessageText(
        task.chatId!,
        message_id,
        undefined,
        `${
          active.stories.stories.length > 0
            ? `⚡️ ${active.stories.stories.length} Active stories found!`
            : '🚫 Active stories not found!'
        }\n` + '⏳ Fetching pinned stories...'
      );
    }

    console.log('getting pinned stories');

    const pinned = await client.invoke(
      new Api.stories.GetPinnedStories({ peer: entity })
    );
    if (pinned.stories.length > 0)
      pinnedStories = pinned.stories.filter(
        (x) => !activeStories.some((y) => y.id === x.id)
      );

    if (message_id) {
      bot.telegram.editMessageText(
        task.chatId!,
        message_id,
        undefined,
        `
        ${
          active.stories.stories.length > 0
            ? `⚡️ ${active.stories.stories.length} Active stories found!`
            : '🚫 Active stories not found!'
        }\n${
          pinned.stories.length > 0
            ? `📌 ${pinned.stories.length} Pinned stories found!`
            : '🚫 Pinned stories not found!'
        }`
      );
    }

    if (activeStories.length > 0 || pinnedStories.length > 0) {
      notifyAdmin({
        status: 'info',
        baseInfo:
          `⚡️ ${activeStories.length} Active stories found!\n` +
          `📌 ${pinnedStories.length} Pinned stories found!`,
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
    activeStories,
    pinnedStories,
    task,
  }: {
    activeStories: Api.TypeStoryItem[];
    pinnedStories: Api.TypeStoryItem[];
    task: MessageInfo;
  }) => {
    if (activeStories.length > 0) {
      const mapped = mapStories(activeStories);

      try {
        if (task.tempMessageId) {
          bot.telegram.editMessageText(
            task.chatId!,
            task.tempMessageId,
            undefined,
            `⚡️ ${activeStories.length} Active stories found!\n` +
              `${
                pinnedStories.length > 0
                  ? `📌 ${pinnedStories.length} Pinned stories found!`
                  : '🚫 Pinned stories not found!'
              }\n` +
              '⏳ Downloading Active stories...'
          );
        }
        console.log(`downloading ${mapped.length} active stories`);

        await downloadStories(mapped, 'active');

        console.log(`active stories downloaded`);

        const uploadableStories = mapped.filter(
          (x) => x.buffer && x.buffer.byteLength <= 47 * 1024 * 1024 // max size = 50mb
        );

        if (task.tempMessageId) {
          bot.telegram.editMessageText(
            task.chatId,
            task.tempMessageId,
            undefined,
            `⚡️ ${activeStories.length} Active stories found!\n` +
              `${
                pinnedStories.length > 0
                  ? `📌 ${pinnedStories.length} Pinned stories found!`
                  : '🚫 Pinned stories not found!'
              }\n` +
              `📥 ${uploadableStories.length} Active stories downloaded successfully!\n` +
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
          errorInfo: { cause: error, targetUsername: task.targetUsername },
        });
        console.log('error occured on sending ACTIVE stories:', error);
      }
    }

    if (pinnedStories.length > 0) {
      const mapped = mapStories(pinnedStories)
        .sort((x, y) => {
          if (x.mediaType === 'photo') return -1;
          if (y.mediaType === 'photo') return 1;
          return 0;
        })
        .slice(0, 21);

      try {
        console.log(`downloading ${mapped.length} pinned stories`);
        if (task.tempMessageId) {
          bot.telegram.editMessageText(
            task.chatId!,
            task.tempMessageId!,
            undefined,
            `⚡️ ${activeStories.length} Active stories found!\n` +
              `📌 ${pinnedStories.length} Pinned stories found!\n` +
              '✅ Active stories processed!\n' +
              '⏳ Downloading Pinned stories...'
          );
        }

        await downloadStories(mapped, 'pinned');

        const uploadableStories = mapped.filter(
          (x) =>
            // max size = 50mb
            x.buffer && Math.floor(x.buffer.byteLength / (1024 * 1024)) <= 49
        );

        console.log(`pinned stories downloaded`);

        console.log(
          `sending ${uploadableStories.length} uploadable pinned stories`
        );
        if (task.tempMessageId) {
          bot.telegram.editMessageText(
            task.chatId!,
            task.tempMessageId,
            undefined,
            `⚡️ ${activeStories.length} Active stories found!\n` +
              `📌 ${pinnedStories.length} Pinned stories found!\n` +
              '✅ Active stories processed!\n' +
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
          errorInfo: { cause: error, targetUsername: task.targetUsername },
        });
        console.log('error occured on sending PINNED stories:', error);
      }
    }
  }
);

export const sendWaitMessageFx = createEffect(
  async ({ chatId }: MessageInfo) => {
    const { chatId: currentTaskChatId } = $currentTask.getState() ?? {};

    if (chatId === currentTaskChatId) {
      await bot.telegram.sendMessage(
        chatId,
        '⚠️ Only 1 link can be proceeded at once, please be patient'
      );
      return;
    }

    const queueLength = $tasksQueue.getState().length;

    await bot.telegram.sendMessage(
      chatId,
      `⏳ Please wait for your queue, there're ${queueLength} users before you!`
    );
  }
);

export const sendErrorMessageFx = createEffect(
  async ({ task, message }: { task: MessageInfo; message: string }) => {
    console.log('error occured:', message);
    notifyAdmin({
      status: 'error',
      errorInfo: { cause: message, targetUsername: task.targetUsername },
    });
    bot.telegram.sendMessage(task.chatId, message);
  }
);

export const cleanupTempMessages = createEffect((task: MessageInfo) => {
  if (task.tempMessageId) {
    bot.telegram.deleteMessage(task.chatId!, task.tempMessageId!);
  }
});
