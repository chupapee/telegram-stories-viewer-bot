import { createEffect, createEvent, createStore, sample } from 'effector';
import { bot } from 'index';
import { and, not } from 'patronum';
import { User } from 'telegraf/typings/core/types/typegram';
import { Api } from 'telegram';

import { saveUser } from '@entities/storage-model';
import { downloadLink } from '@entities/userbot';
import { StoriesBot, Userbot } from '@entities/userbot/model';
import { BOT_ADMIN_ID } from '@shared/config';

export interface MessageInfo {
  chatId: string;
  targetUsername: string;
  locale: string;
  links: string[];
  user?: User;
}

export const $currentTask = createStore<MessageInfo | null>(null);
const $tasksQueue = createStore<MessageInfo[]>([]);
const $isTaskRunning = createStore(false);
const checkTasks = createEvent();

$tasksQueue.watch((tasks) => console.log({ tasks }));

export const taskDone = createEvent();
export const newTaskReceived = createEvent<MessageInfo>();

const taskInitiated = createEvent();
const taskStarted = createEvent();
const fetchingTaskLinksStarted = createEvent();
const taskLinksReceived = createEvent<string[]>();
const taskAllLinksFetched = createEvent();

export const userbotMessagesListener = (event: any) => {
  try {
    const entities: { url?: string }[] | null = event?.message?.entities;

    if (event?.message?.message.includes('Total stories')) {
      setTimeout(taskAllLinksFetched, 5_000);
    }

    if (entities && entities.length > 0) {
      const links: string[] = [];

      for (const link of entities) {
        if (link.url) links.push(link.url);
      }

      if (links.length > 0) taskLinksReceived(links);
    }
  } catch (error) {
    console.error(error);
  }
};

const fetchLinksFromStoriesBot = createEffect(async (task: MessageInfo) => {
  console.log('sending username to stories-bot');

  fetchingTaskLinksStarted();

  try {
    await bot.telegram.sendMessage(
      task.chatId,
      '⏳ Searching the stories, please wait...'
    );

    notifyAdmin({ task, status: 'start' });

    const { targetUsername } = task;

    const client = await Userbot.getInstance();
    const entity = await StoriesBot.getEntity();
    client.invoke(
      new Api.messages.SendMessage({
        peer: entity,
        message: `/dlStories ${targetUsername}`,
      })
    );
  } catch (error) {
    await bot.telegram.sendMessage(
      task.chatId,
      '❌ Oops... something went wrong with service that fetches stories, please try again later!'
    );
  }
});

const sendStoriesToUserFx = createEffect(async () => {
  console.log('sending stories to user');

  const { links = [], chatId = 0 } = $currentTask.getState() ?? {};

  if (links.length > 0) {
    const keyboard = linksKeyboard(links);

    await bot.telegram.sendMessage(chatId, 'Links:', {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
    await bot.telegram.sendMessage(
      chatId,
      '📤 Uploading stories started, but you can use the links above to download them by yourself!'
    );

    notifyAdmin({
      task: $currentTask.getState() ?? ({} as MessageInfo),
      status: 'end',
    });

    const mediaGroup = await downloadLinks(links);
    if (mediaGroup.length > 0) {
      await bot.telegram.sendMediaGroup(chatId, mediaGroup);
      return;
    }
    return bot.telegram.sendMessage(chatId, '🚫 Stories cannot be downloaded!');
  }
  await bot.telegram.sendMessage(chatId, '🚫 Stories not found!');

  taskDone();
});

const sendWaitMessageFx = createEffect(async (task: MessageInfo) => {
  const { chatId, locale } = task;
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

const saveUserFx = createEffect(saveUser);

$tasksQueue.on(newTaskReceived, (tasks, newTask) => {
  const alreadyExist = tasks.some((x) => x.chatId === newTask.chatId);
  if (!alreadyExist) return [...tasks, newTask];
  return tasks;
});

$isTaskRunning.on(taskStarted, () => true);
$isTaskRunning.on(taskDone, () => false);
$tasksQueue.on(taskDone, (tasks) => tasks.slice(1));

$currentTask.on(taskLinksReceived, (task, links) => {
  if (!task) return null;
  return { ...task, links: [...task.links, ...links] };
});

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
  target: fetchLinksFromStoriesBot,
});

sample({
  clock: taskAllLinksFetched,
  target: sendStoriesToUserFx,
});

// utils
function taskGuard(task: MessageInfo | null): task is MessageInfo {
  return task !== null;
}

function linksKeyboard(links: string[]) {
  const result: Array<{ text: string; url: string }[]> = [[]];
  let innerArrayIndex = 0;

  for (const [i, link] of links.entries()) {
    if (result[innerArrayIndex].length === 3) {
      result.push([]);
      innerArrayIndex++;
    }

    result[innerArrayIndex].push({ text: `story #${i + 1}`, url: link });
  }

  return result;
}

async function downloadLinks(links: string[]) {
  const mediaGroup: {
    media: { source: Buffer };
    type: 'photo' | 'video';
    caption?: string;
  }[] = [];

  for (const link of links) {
    if (link) {
      const result = await downloadLink(link);

      if (result instanceof Buffer) {
        const type = link.includes('video') ? 'video' : 'photo';
        mediaGroup.push({ media: { source: result }, type });
        continue;
      }
      links.push(result);
    }
  }

  return mediaGroup;
}

async function notifyAdmin({
  task,
  status,
}: {
  task: MessageInfo;
  status: 'start' | 'end';
}) {
  if (status === 'end') {
    bot.telegram.sendMessage(BOT_ADMIN_ID, '✅ task done successfully!');
    return;
  }

  if (task.user) {
    const userInfo = JSON.stringify(task.user, null, 2);

    bot.telegram.sendMessage(BOT_ADMIN_ID, `👤 Task started by: ${userInfo}`, {
      parse_mode: 'HTML',
    });
  }
}
