import { bot } from 'index';
import {
  cleanUpTempMessagesFired,
  tempMessageSent,
} from 'services/stories-service';
import { Api } from 'telegram';

import { downloadStories, mapStories } from './download-stories';
import { notifyAdmin } from './send-message';
import { SendStoriesArgs } from './types';

export async function sendPaginatedStories({
  stories,
  task,
}: Omit<SendStoriesArgs, 'stories'> & {
  stories: Api.TypeStoryItem[];
}) {
  const mapped = mapStories(stories);

  try {
    bot.telegram
      .sendMessage(task.chatId, '⏳ Downloading...')
      .then(({ message_id }) => tempMessageSent(message_id))
      .catch(() => null);

    await downloadStories(mapped, 'pinned');

    const uploadableStories = mapped.filter(
      (x) => x.buffer && x.bufferSize! <= 50 // skip too large file
    );

    if (uploadableStories.length > 0) {
      bot.telegram
        .sendMessage(task.chatId, '⏳ Uploading to Telegram...')
        .then(({ message_id }) => tempMessageSent(message_id))
        .catch(() => null);

      await bot.telegram.sendMediaGroup(
        task.chatId,
        uploadableStories.map((x) => ({
          media: { source: x.buffer! },
          type: x.mediaType,
          caption: x.caption ?? 'Active stories',
        }))
      );
    }

    notifyAdmin({
      status: 'info',
      baseInfo: `📥 Paginated stories uploaded to user!`,
    });
  } catch (error) {
    notifyAdmin({
      status: 'error',
      task,
      errorInfo: { cause: error },
    });
    console.log('error occured on sending PAGINATED stories:', error);
  }
  cleanUpTempMessagesFired();
}
