import { Userbot } from 'config/userbot';
import { timeout } from 'lib';
import { Api } from 'telegram';

export type StoriesModel = typeof mapStories;

export async function downloadStories(
  stories: ReturnType<StoriesModel>,
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
            if (buffer instanceof Buffer) {
              story.buffer = buffer;
              story.bufferSize = Math.floor(buffer.byteLength / (1024 * 1024));
            }
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

export function mapStories(stories: Api.TypeStoryItem[]) {
  const mappedStories: {
    caption?: string;
    media: Api.StoryItem['media'];
    mediaType: 'photo' | 'video';
    date: Date;
    buffer?: Buffer;
    bufferSize?: number;
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
