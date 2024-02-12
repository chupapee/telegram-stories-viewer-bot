import { createEffect, createEvent, createStore, sample } from 'effector';
import { bot } from 'index';
import { not } from 'patronum';
import { Api } from 'telegram';

import { StoriesBot, Userbot } from '@entities/userbot/model';

export interface MessageInfo {
  chatId: string;
  targetUsername: string;
  locale: string;
  links: string[];
}

export const $currentTask = createStore<MessageInfo | null>(null);
const $tasksQueue = createStore<MessageInfo[]>([]);
const $isTaskRunning = createStore(false);
const checkTasks = createEvent();

export const taskDone = createEvent();
export const newTaskReceived = createEvent<MessageInfo>();

const taskInitiated = createEvent();
const taskStarted = createEvent();
const fetchingTaskLinksStarted = createEvent();
const taskLinksReceived = createEvent<string[]>();

export const userbotMessagesListener = (event: any) => {
  try {
    const entities: { url?: string }[] | null = event?.message?.entities;

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

  const { targetUsername } = task;

  const client = await Userbot.getInstance();
  const entity = await StoriesBot.getEntity();
  client.invoke(
    new Api.messages.SendMessage({
      peer: entity,
      message: `/dlStories ${targetUsername}`,
    })
  );
});

const sendStoriesToUserFx = createEffect(async () => {
  console.log('sending stories to user');

  const { links = [], chatId = 0 } = $currentTask.getState() ?? {};

  if (links.length > 0) {
    const formattedLinks = links
      .map((link, i) => `<a href="${link}">${i + 1} ссылка</a>`)
      .join('\n');

    await bot.telegram.sendMessage(chatId, formattedLinks, {
      parse_mode: 'HTML',
    });
  } else {
    await bot.telegram.sendMessage(chatId, 'Oops.. Stories not found!');
  }

  taskDone();
});

const sendWaitMessageFx = createEffect(async (task: MessageInfo) => {
  const { chatId, locale } = task;

  const queueLength = $tasksQueue.getState().length;

  await bot.telegram.sendMessage(
    chatId,
    `Please wait for your queue, there're ${queueLength} users before you!`
  );
});

$tasksQueue.on(newTaskReceived, (tasks, newTask) => [...tasks, newTask]);
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

$isTaskRunning.watch((bool) => console.log({ running: bool }));

sample({
  clock: newTaskReceived,
  filter: $isTaskRunning,
  target: sendWaitMessageFx,
});

sample({
  clock: checkTasks,
  filter: not($isTaskRunning),
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

const taskAllLinksFetched = createEvent();

const delayedLinksFetchingStopped = createEffect(() => {
  setTimeout(taskAllLinksFetched, 10_000);
});

sample({
  clock: fetchingTaskLinksStarted,
  target: delayedLinksFetchingStopped,
});

sample({
  clock: taskAllLinksFetched,
  target: sendStoriesToUserFx,
});

// utils
function taskGuard(task: MessageInfo | null): task is MessageInfo {
  return task !== null;
}
