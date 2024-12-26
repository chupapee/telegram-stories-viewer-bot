import { BOT_ADMIN_ID, isDevEnv } from 'config/env-config';
import { getAllStoriesFx, getParticularStoryFx } from 'controllers/get-stories';
import { sendErrorMessageFx } from 'controllers/send-message';
import { sendStoriesFx } from 'controllers/send-stories';
import { createEffect, createEvent, createStore, sample } from 'effector';
import { bot } from 'index';
import { and, delay, not, or } from 'patronum';
import { saveUser } from 'repositories/user-repository';
import { User } from 'telegraf/typings/core/types/typegram';
import { Api } from 'telegram';

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

const TIMEOUT_BETWEEN_REQUESTS = isDevEnv ? 0 : 300_000; // 60_000 * 5 = 5min;
export const $currentTask = createStore<UserInfo | null>(null);
export const $tasksQueue = createStore<UserInfo[]>([]);
const $isTaskRunning = createStore(false);
const $waitTime = createStore<Date | null>(null);

const checkTasks = createEvent();
export const tempMessageSent = createEvent<number>();

$currentTask.on(tempMessageSent, (prev, newMsgId) => ({
  ...prev!,
  tempMessages: [...(prev?.tempMessages ?? []), newMsgId],
}));

$tasksQueue.watch((tasks) => console.log({ tasks }));

export const taskDone = createEvent();
export const newTaskReceived = createEvent<UserInfo>();

const taskStarted = createEvent();

const saveUserFx = createEffect(saveUser);

export const cleanUpTempMessagesFired = createEvent();

const cleanupTempMessagesFx = createEffect((task: UserInfo) => {
  task.tempMessages?.forEach((id) => {
    bot.telegram.deleteMessage(task.chatId!, id);
  });
});

sample({
  clock: cleanUpTempMessagesFired,
  source: $currentTask,
  filter: (task): task is UserInfo => task !== null,
  target: cleanupTempMessagesFx,
});

$currentTask.on(cleanupTempMessagesFx.done, (prev) => ({
  ...prev!,
  tempMessages: [],
}));

interface SendWaitMessageFxArgs {
  multipleRequests: boolean;
  waitTime: Date | null;
  queueLength: number;
  newTask: UserInfo;
}

export const sendWaitMessageFx = createEffect(
  async ({
    multipleRequests,
    waitTime,
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
    if (waitTime instanceof Date) {
      const endTime = waitTime.getTime() + TIMEOUT_BETWEEN_REQUESTS;
      const currTime = new Date().getTime();

      const diff = Math.abs(currTime - endTime);

      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      const timeToWait =
        minutes > 0
          ? `${minutes} minute and ${remainingSeconds} seconds`
          : `${remainingSeconds} seconds`;

      await bot.telegram.sendMessage(
        newTask.chatId,
        `⏳ Please wait ***${timeToWait}*** and send link again\n\nYou can get ***unlimited access*** to our bot without waiting any minutes between requests\nRun the ***/premium*** command to get more info\n\n***Note:*** The timer resets each time ***any user*** sends a link to the bot ***(not just you)***. If someone uses the bot before your wait time expires, you'll need to wait for the timer to reset again.`,
        {
          parse_mode: 'Markdown',
        }
      );
      return;
    }
    if (queueLength) {
      await bot.telegram.sendMessage(
        newTask.chatId,
        `⏳ Please wait for your turn, there're ${queueLength} users before you!`
      );
    }
  }
);

$tasksQueue.on(newTaskReceived, (tasks, newTask) => {
  const alreadyExist = tasks.some((x) => x.chatId === newTask.chatId);
  const waitTime = $waitTime.getState();
  if (!alreadyExist && waitTime === null) return [...tasks, newTask];
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
  filter: (task) => !task.nextStoriesIds,
  fn: (task) => task.user!,
  target: saveUserFx,
});

sample({
  clock: newTaskReceived,
  source: {
    currentTask: $currentTask,
    waitTime: $waitTime,
    queue: $tasksQueue,
  },
  filter: or(
    $isTaskRunning,
    $waitTime.map((x) => x instanceof Date)
  ),
  fn: ({ currentTask, waitTime, queue }, newTask) => {
    return {
      multipleRequests: currentTask?.chatId === newTask.chatId,
      waitTime,
      queueLength: queue.length,
      newTask,
    };
  },
  target: sendWaitMessageFx,
});

const taskInitiated = createEvent();

sample({
  clock: checkTasks,
  filter: and(
    not($isTaskRunning),
    not($waitTime),
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
  clock: taskInitiated,
  fn: () => new Date(),
  target: $waitTime,
});

sample({
  clock: delay(taskInitiated, TIMEOUT_BETWEEN_REQUESTS),
  fn: () => null,
  target: [$waitTime, checkTasks],
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

$currentTask.on(taskDone, () => null);

/**
 * checking task processing time
 * restart bot if it takes more than 7 minutes
 * Reason: downloading some stories leads to "file lives in another DC" error
 * TODO: have to find better way to handle this issue
 */
const MAX_WAIT_TIME = 7;
const intervalHasPassed = createEvent();
const checkTaskForRestart = createEffect(async (task: UserInfo | null) => {
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
});
sample({
  clock: intervalHasPassed,
  source: $currentTask,
  target: checkTaskForRestart,
});
setInterval(intervalHasPassed, 30_000);
