import {
  getAllStoriesFx,
  getParticularStory,
  sendErrorMessageFx,
  sendStoriesFx,
} from 'controllers';
import { createEffect, createEvent, createStore, sample } from 'effector';
import { bot } from 'index';
import { and, not } from 'patronum';
import { User } from 'telegraf/typings/core/types/typegram';
import { Api } from 'telegram';

import { saveUser } from '@entities/storage-model';

export interface UserInfo {
  chatId: string;
  link: string;
  linkType: 'username' | 'link';
  locale: string;
  user?: User;
  tempMessage?: {
    id: number;
    text?: string;
  };
}

export const $currentTask = createStore<UserInfo | null>(null);
export const $tasksQueue = createStore<UserInfo[]>([]);
const $isTaskRunning = createStore(false);

const checkTasks = createEvent();
export const tempMessageSent = createEvent<{
  id: number;
  text?: string;
}>();

$currentTask.on(tempMessageSent, (prev, msgInfo) => ({
  ...prev!,
  tempMessage: msgInfo,
}));

$tasksQueue.watch((tasks) => console.log({ tasks }));

export const taskDone = createEvent();
export const newTaskReceived = createEvent<UserInfo>();

const taskStarted = createEvent();

const saveUserFx = createEffect(saveUser);

export const cleanupTempMessages = createEffect((task: UserInfo) => {
  if (task.tempMessage?.id) {
    bot.telegram.deleteMessage(task.chatId!, task.tempMessage.id);
  }
});

export const sendWaitMessageFx = createEffect(async ({ chatId }: UserInfo) => {
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

const taskInitiated = createEvent();

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
  filter: (task): task is UserInfo => task !== null && task.linkType === 'link',
  target: getParticularStory,
});

sample({
  clock: taskStarted,
  source: $currentTask,
  filter: (task): task is UserInfo =>
    task !== null && task.linkType === 'username',
  target: getAllStoriesFx,
});

sample({
  clock: [getAllStoriesFx.doneData, getParticularStory.doneData],
  source: $currentTask,
  filter: (task, result) =>
    typeof result === 'string' && task?.chatId !== undefined,
  fn: (task, result) => ({ task: task!, message: result as string }), // FIXME: as string won't be necessary in ts 5.5
  target: [sendErrorMessageFx, taskDone],
});

sample({
  clock: [getAllStoriesFx.doneData, getParticularStory.doneData],
  source: $currentTask,
  filter: (task, result) => typeof result === 'object' && task !== null,
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

sample({
  clock: taskDone,
  source: $currentTask,
  filter: (task): task is UserInfo => task !== null,
  target: cleanupTempMessages,
});
