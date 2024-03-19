import { bot } from 'index';
import { MessageInfo } from 'model';
import { Api } from 'telegram';

import { Userbot } from '@entities/userbot/model';
import { BOT_ADMIN_ID } from '@shared/config';
import { timeout } from '@shared/lib';

export async function downloadStories(
  stories: ReturnType<typeof mapStories>,
  storiesType: 'active' | 'pinned'
) {
  const client = await Userbot.getInstance();

  for (const story of stories) {
    try {
      await Promise.race([
        new Promise((ok) => {
          // max pinned video-story downloading time = 30s
          // FIXME: possible memory leak: if media downloads faster than this promise resolvs (creating timeout too much times)
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

export function chunkMediafiles(files: ReturnType<typeof mapStories>) {
  return files.reduce(
    (acc: Array<ReturnType<typeof mapStories>>, curr) => {
      if (acc[acc.length - 1].length === 10) {
        acc.push([curr]);
        return acc;
      }
      acc[acc.length - 1].push(curr);
      return acc;
    },
    [[]]
  );
}

export function mapStories(stories: Api.TypeStoryItem[]) {
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
