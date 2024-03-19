import { createEffect, createEvent, createStore, sample } from 'effector';
import { and, not } from 'patronum';
import {
  cleanupTempMessages,
  getAllStoriesFx,
  sendErrorMessageFx,
  sendStoriesFx,
  sendWaitMessageFx,
} from 'services';
import { User } from 'telegraf/typings/core/types/typegram';
import { Api } from 'telegram';

import { saveUser } from '@entities/storage-model';

export interface MessageInfo {
  chatId: string;
  targetUsername: string;
  locale: string;
  user?: User;
  tempMessageId?: number;
}

export const $currentTask = createStore<MessageInfo | null>(null);
export const $tasksQueue = createStore<MessageInfo[]>([]);
const $isTaskRunning = createStore(false);

const checkTasks = createEvent();
export const tempMessageSent = createEvent<number>();

$currentTask.on(tempMessageSent, (prev, messageId) => ({
  ...prev!,
  tempMessageId: messageId,
}));

$tasksQueue.watch((tasks) => console.log({ tasks }));

export const taskDone = createEvent();
export const newTaskReceived = createEvent<MessageInfo>();

const taskStarted = createEvent();

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
  target: taskStarted,
});

sample({
  clock: taskStarted,
  source: $tasksQueue,
  fn: (tasks) => tasks[0],
  target: [$currentTask, getAllStoriesFx],
});

sample({
  source: $currentTask,
  clock: getAllStoriesFx.doneData,
  filter: (task, result) =>
    typeof result === 'string' && task?.chatId !== undefined,
  fn: (task, result) => ({ task: task!, message: result as string }), // FIXME: as string won't be necessary in ts 5.5
  target: [sendErrorMessageFx, taskDone],
});

sample({
  source: $currentTask,
  clock: getAllStoriesFx.doneData,
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
  filter: (task): task is MessageInfo => task !== null,
  target: cleanupTempMessages,
});
