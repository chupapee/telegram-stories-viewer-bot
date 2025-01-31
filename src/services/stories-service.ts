import { BOT_ADMIN_ID, isDevEnv } from 'config/env-config';
import { getAllStoriesFx, getParticularStoryFx } from 'controllers/get-stories';
import { sendErrorMessageFx } from 'controllers/send-message';
import { sendStoriesFx } from 'controllers/send-stories';
import { createEffect, createEvent, createStore, sample } from 'effector';
import { bot } from 'index';
import { getRandomArrayItem } from 'lib';
import { and, not, or } from 'patronum';
import { saveUser } from 'repositories/user-repository';
import { User } from 'telegraf/typings/core/types/typegram';
import { Api } from 'telegram';

// stores
export interface UserInfo {
  chatId: string;
  link: string;
  // TODO: replace `username` with `linkEntityLike`
  linkType: 'username' | 'link';
  nextStoriesIds?: number[];
  locale: string;
  user?: User;
  tempMessages?: number[];
  initTime: number;
}
export const $currentTask = createStore<UserInfo | null>(null);
export const $tasksQueue = createStore<UserInfo[]>([]);
const $isTaskRunning = createStore(false);
const $taskStartTime = createStore<Date | null>(null);
const clearTimeout = createEvent<number>();
const $taskTimeout = createStore(isDevEnv ? 20_000 : 240_000);

// events
export const newTaskReceived = createEvent<UserInfo>();
const taskInitiated = createEvent();
const taskStarted = createEvent();
export const tempMessageSent = createEvent<number>();
export const taskDone = createEvent();
const checkTasks = createEvent();
export const cleanUpTempMessagesFired = createEvent();

// effects
const timeoutList = isDevEnv
  ? [10_000, 15_000, 20_000]
  : [240_000, 300_000, 360_000]; // 4,5,6 mins
export const clearTimeoutWithDelayFx = createEffect(
  (currentTimeout: number) => {
    const nextTimeout = getRandomArrayItem(timeoutList, currentTimeout);

    setTimeout(() => {
      clearTimeout(nextTimeout);
    }, currentTimeout);
  }
);
const MAX_WAIT_TIME = 7;
export const checkTaskForRestart = createEffect(
  async (task: UserInfo | null) => {
    if (task) {
      const minsFromStart = Math.floor((Date.now() - task.initTime) / 60_000);
      console.log('minsFromStart', minsFromStart);

      if (minsFromStart === MAX_WAIT_TIME) {
        console.log(
          "Bot stopped manually, it's took too long to download stories"
        );
        await bot.telegram.sendMessage(
          BOT_ADMIN_ID,
          "❌ Bot stopped manually, it's took too long to download stories\n\n" +
            JSON.stringify(task, null, 2)
        );
        process.exit();
      }
    }
  }
);
interface SendWaitMessageFxArgs {
  multipleRequests: boolean;
  taskStartTime: Date | null;
  taskTimeout: number;
  queueLength: number;
  newTask: UserInfo;
}
export const sendWaitMessageFx = createEffect(
  async ({
    multipleRequests,
    taskStartTime,
    taskTimeout,
    queueLength,
    newTask,
  }: SendWaitMessageFxArgs) => {
    if (multipleRequests) {
      await bot.telegram.sendMessage(
        newTask.chatId,
        '⚠️ Only 1 link can be proceeded at once, please be patient'
      );
      return;
    }
    if (queueLength) {
      await bot.telegram.sendMessage(
        newTask.chatId,
        `⏳ Please wait for your turn, there're ${queueLength} users before you!`
      );
      return;
    }
    if (taskStartTime instanceof Date) {
      const currTimeMs = Date.now(); // 10_000
      const endTimeMs = taskStartTime.getTime() + taskTimeout; // 15_000
      const remainingMs = endTimeMs - currTimeMs; // 15 - 10 = 5000
      console.log({ remainingMs });

      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);

      const timeToWait =
        minutes > 0
          ? `${minutes} minute and ${seconds} seconds`
          : `${seconds} seconds`;

      await bot.telegram.sendMessage(
        newTask.chatId,
        `⏳ Please wait ***${timeToWait}*** and send link again\n\nYou can get ***unlimited access*** to our bot without waiting any minutes between requests\nRun the ***/premium*** command to get more info\n\n***Note:*** The timer resets each time ***any user*** sends a link to the bot ***(not just you)***. If someone uses the bot before your wait time expires, you'll need to wait for the timer to reset again.`,
        {
          parse_mode: 'Markdown',
        }
      );
    }
  }
);
export const cleanupTempMessagesFx = createEffect((task: UserInfo) => {
  task.tempMessages?.forEach((id) => {
    bot.telegram.deleteMessage(task.chatId!, id);
  });
});
const saveUserFx = createEffect(saveUser);

// Flow
$tasksQueue.on(newTaskReceived, (tasks, newTask) => {
  const alreadyExist = tasks.some((x) => x.chatId === newTask.chatId);
  const taskStartTime = $taskStartTime.getState();
  if (!alreadyExist && taskStartTime === null) return [...tasks, newTask];
  return tasks;
});

$isTaskRunning.on(taskStarted, () => true);
$isTaskRunning.on(taskDone, () => false);
$tasksQueue.on(taskDone, (tasks) => tasks.slice(1));

sample({
  clock: newTaskReceived,
  filter: (task) => !task.nextStoriesIds,
  fn: (task) => task.user!,
  target: saveUserFx,
});

sample({
  clock: newTaskReceived,
  source: {
    currentTask: $currentTask,
    taskStartTime: $taskStartTime,
    taskTimeout: $taskTimeout,
    queue: $tasksQueue,
  },
  filter: or(
    $isTaskRunning,
    $taskStartTime.map((x) => x instanceof Date)
  ),
  fn: ({ currentTask, taskStartTime, taskTimeout, queue }, newTask) => {
    return {
      multipleRequests: currentTask?.chatId === newTask.chatId,
      taskStartTime,
      taskTimeout,
      queueLength: queue.length,
      newTask,
    };
  },
  target: sendWaitMessageFx,
});

sample({
  clock: checkTasks,
  filter: and(
    not($isTaskRunning),
    not($taskStartTime),
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
  clock: taskInitiated,
  fn: () => new Date(),
  target: $taskStartTime,
});

sample({
  clock: taskInitiated,
  source: $taskTimeout,
  target: clearTimeoutWithDelayFx,
});

$taskTimeout.on(clearTimeout, (prev, newTimeout) => newTimeout);

sample({
  clock: clearTimeout,
  fn: () => null,
  target: [$taskStartTime, checkTasks],
});

sample({
  clock: taskStarted,
  source: $currentTask,
  filter: (task): task is UserInfo => task !== null && task.linkType === 'link',
  target: getParticularStoryFx,
});

sample({
  clock: taskStarted,
  source: $currentTask,
  filter: (task): task is UserInfo =>
    task !== null && task.linkType === 'username',
  target: getAllStoriesFx,
});

sample({
  clock: [getAllStoriesFx.doneData, getParticularStoryFx.doneData],
  source: $currentTask,
  filter: (task, result) =>
    typeof result === 'string' && task?.chatId !== undefined,
  fn: (task, result) => ({ task: task!, message: result as string }), // FIXME: as string won't be necessary in ts 5.5
  target: [sendErrorMessageFx, taskDone],
});

sample({
  clock: [getAllStoriesFx.doneData, getParticularStoryFx.doneData],
  source: $currentTask,
  filter: (task, result) => typeof result === 'object' && task !== null,
  fn: (task, result) => ({
    task: task!,
    ...(result as {
      activeStories: Api.TypeStoryItem[];
      pinnedStories: Api.TypeStoryItem[];
      paginatedStories?: Api.TypeStoryItem[];
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
  target: cleanupTempMessagesFx,
});

sample({
  clock: [newTaskReceived, taskDone],
  target: checkTasks,
});

$tasksQueue.watch((tasks) => console.log({ tasks }));

$currentTask.on(tempMessageSent, (prev, newMsgId) => ({
  ...prev!,
  tempMessages: [...(prev?.tempMessages ?? []), newMsgId],
}));

$currentTask.on(cleanupTempMessagesFx.done, (prev) => ({
  ...prev!,
  tempMessages: [],
}));

sample({
  clock: cleanUpTempMessagesFired,
  source: $currentTask,
  filter: (task): task is UserInfo => task !== null,
  target: cleanupTempMessagesFx,
});

$currentTask.on(taskDone, () => null);

/**
 * checking task processing time
 * restart bot if it takes more than 7 minutes
 * Reason: downloading some stories leads to "file lives in another DC" error
 * TODO: have to find better way to handle this issue
 */
const intervalHasPassed = createEvent();

sample({
  clock: intervalHasPassed,
  source: $currentTask,
  target: checkTaskForRestart,
});
setInterval(intervalHasPassed, 30_000);
