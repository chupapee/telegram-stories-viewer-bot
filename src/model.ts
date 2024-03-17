import { createEffect, createEvent, createStore, sample } from 'effector';
import { bot } from 'index';
import { and, not } from 'patronum';
import { User } from 'telegraf/typings/core/types/typegram';
import { Api } from 'telegram';

import { saveUser } from '@entities/storage-model';
import { Userbot } from '@entities/userbot/model';
import { BOT_ADMIN_ID } from '@shared/config';
import { timeout } from '@shared/lib';

export interface MessageInfo {
  chatId: string;
  targetUsername: string;
  locale: string;
  user?: User;
  tempMessageId?: number;
}

const $currentTask = createStore<MessageInfo | null>(null);
const $tasksQueue = createStore<MessageInfo[]>([]);
const $isTaskRunning = createStore(false);
const tempMessageSent = createEvent<number>();
$currentTask.on(tempMessageSent, (prev, messageId) => ({
  ...prev!,
  tempMessageId: messageId,
}));

const checkTasks = createEvent();

$tasksQueue.watch((tasks) => console.log({ tasks }));

export const taskDone = createEvent();
export const newTaskReceived = createEvent<MessageInfo>();

const taskInitiated = createEvent();
const taskStarted = createEvent();

const getAllStoriesFx = createEffect(async (task: MessageInfo) => {
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

const sendStoriesFx = createEffect(
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

        const uploadableStories = mapped.filter((x) => x.buffer);

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

        const uploadableStories = mapped.filter((x) => x.buffer);

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

const sendWaitMessageFx = createEffect(async ({ chatId }: MessageInfo) => {
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
});

const sendErrorMessageFx = createEffect(
  async ({ task, message }: { task: MessageInfo; message: string }) => {
    console.log('error occured:', message);
    notifyAdmin({
      status: 'error',
      errorInfo: { cause: message, targetUsername: task.targetUsername },
    });
    bot.telegram.sendMessage(task.chatId, message);
  }
);

const saveUserFx = createEffect(saveUser);

$tasksQueue.on(newTaskReceived, (tasks, newTask) => {
  const alreadyExist = tasks.some((x) => x.chatId === newTask.chatId);
  if (!alreadyExist) return [...tasks, newTask];
  return tasks;
});

$isTaskRunning.on(taskStarted, () => true);
$isTaskRunning.on(taskDone, () => false);
$tasksQueue.on(taskDone, (tasks) => tasks.slice(1));

sample({
  clock: [newTaskReceived, taskDone],
  target: checkTasks,
});

sample({
  clock: newTaskReceived,
  fn: (task) => task.user!,
  target: saveUserFx,
});

sample({
  clock: newTaskReceived,
  filter: $isTaskRunning,
  target: sendWaitMessageFx,
});

sample({
  clock: checkTasks,
  filter: and(
    not($isTaskRunning),
    $tasksQueue.map((tasks) => tasks.length > 0)
  ),
  target: taskInitiated,
});

sample({
  clock: taskInitiated,
  source: $tasksQueue,
  fn: (tasks) => tasks[0],
  target: [$currentTask, taskStarted],
});

sample({
  clock: taskStarted,
  source: $currentTask,
  filter: taskGuard,
  target: getAllStoriesFx,
});

sample({
  source: $currentTask,
  clock: getAllStoriesFx.doneData,
  // FIXME: type-error hack
  filter: (task, result): result is '🚫 Stories not found!' =>
    typeof result === 'string' && task?.chatId !== undefined,
  fn: (task, result) => ({ task: task!, message: result as string }),
  target: [sendErrorMessageFx, taskDone],
});

sample({
  source: $currentTask,
  clock: getAllStoriesFx.doneData,
  // FIXME
  filter: (
    task,
    result
  ): result is {
    activeStories: Api.TypeStoryItem[];
    pinnedStories: Api.TypeStoryItem[];
  } => typeof result === 'object' && task !== null,
  fn: (task, result) => ({
    task: task!,
    ...(result as {
      activeStories: Api.TypeStoryItem[];
      pinnedStories: Api.TypeStoryItem[];
    }),
  }),
  target: sendStoriesFx,
});

sample({
  clock: sendStoriesFx.done,
  target: taskDone,
});

const cleanupTempMessages = createEffect((task: MessageInfo) => {
  if (task.tempMessageId) {
    bot.telegram.deleteMessage(task.chatId!, task.tempMessageId!);
  }
});

sample({
  clock: taskDone,
  source: $currentTask,
  filter: (task): task is MessageInfo => task !== null,
  target: cleanupTempMessages,
});

// utils
function taskGuard(task: MessageInfo | null): task is MessageInfo {
  return task !== null;
}

async function downloadStories(
  stories: ReturnType<typeof mapStories>,
  storiesType: 'active' | 'pinned'
) {
  const client = await Userbot.getInstance();

  for (const story of stories) {
    try {
      await Promise.race([
        new Promise((ok) => {
          // max pinned video-story downloading time = 30s
          // FIXME: possible memory leak if media downloads faster than this promise resolvs (creating timeout too much times)
          if (storiesType === 'pinned' && story.mediaType === 'video') {
            setTimeout(ok, 30_000);
          }
        }),
        new Promise((ok) => {
          client.downloadMedia(story.media).then((buffer) => {
            story.buffer = buffer as Buffer;
            ok(null);
          });
        }),
      ]);
      await timeout(1000);
    } catch (error) {
      continue;
    }
  }
}

function chunkMediafiles(files: ReturnType<typeof mapStories>) {
  return files.reduce(
    (acc, curr) => {
      if (acc[acc.length - 1].length === 10) {
        acc.push([curr]);
        return acc;
      }
      acc[acc.length - 1].push(curr);
      return acc;
    },
    [[]] as Array<ReturnType<typeof mapStories>>
  );
}

function mapStories(stories: Api.TypeStoryItem[]) {
  const mappedStories: {
    caption?: string;
    media: Api.StoryItem['media'];
    date: Date;
    buffer?: Buffer;
    mediaType: 'photo' | 'video';
  }[] = [];

  stories.forEach((x) => {
    if ('media' in x) {
      const data: (typeof mappedStories)[number] = {
        media: x.media,
        // unix timestamp to ms
        date: new Date(x.date * 1000),
        mediaType: 'photo' in x.media ? 'photo' : 'video',
      };
      if (x.caption) data.caption = x.caption;

      mappedStories.push(data);
    }
  });

  return mappedStories;
}

export async function notifyAdmin({
  task,
  status,
  errorInfo,
  baseInfo,
}: {
  task?: MessageInfo;
  status: 'start' | 'error' | 'info';
  errorInfo?: { targetUsername: string; cause: any };
  baseInfo?: string;
}) {
  const userInfo = JSON.stringify(task?.user, null, 2);

  if (status === 'error' && errorInfo) {
    bot.telegram.sendMessage(
      BOT_ADMIN_ID,
      '🛑 ERROR 🛑\n' +
        `👤 Target username: ${errorInfo.targetUsername}\n` +
        `reason: ${JSON.stringify(errorInfo.cause)}\n` +
        `author: ${userInfo}`
    );
    return;
  }

  if (status === 'info' && baseInfo) {
    bot.telegram.sendMessage(BOT_ADMIN_ID, baseInfo);
    return;
  }

  if (status === 'start') {
    bot.telegram.sendMessage(BOT_ADMIN_ID, `👤 Task started by: ${userInfo}`, {
      parse_mode: 'HTML',
    });
  }
}
