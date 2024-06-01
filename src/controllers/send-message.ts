import { BOT_ADMIN_ID } from 'config/env-config';
import { createEffect } from 'effector';
import { bot } from 'index';
import { UserInfo } from 'services/stories-service';

export async function notifyAdmin({
  task,
  status,
  errorInfo,
  baseInfo,
}: {
  task?: UserInfo;
  status: 'start' | 'error' | 'info';
  errorInfo?: { cause: unknown };
  baseInfo?: string;
}) {
  if (task?.chatId === BOT_ADMIN_ID.toString()) return;
  const userInfo = JSON.stringify(
    { ...(task?.user ?? {}), username: '@' + task?.user?.username },
    null,
    2
  );

  const msgOptions = { link_preview_options: { is_disabled: true } };

  if (status === 'error' && errorInfo) {
    bot.telegram.sendMessage(
      BOT_ADMIN_ID,
      '🛑 ERROR 🛑\n' +
        `🔗 Target link: ${task?.link}\n` +
        `reason: ${JSON.stringify(errorInfo.cause)}\n` +
        `author: ${userInfo}`,
      msgOptions
    );
    return;
  }

  if (status === 'info' && baseInfo) {
    let text = baseInfo;
    if (task?.user) {
      text += '\n👤 user: ' + userInfo;
    }
    bot.telegram.sendMessage(BOT_ADMIN_ID, text, msgOptions);
    return;
  }

  if (status === 'start') {
    bot.telegram.sendMessage(BOT_ADMIN_ID, `👤 Task started by: ${userInfo}`, {
      ...msgOptions,
      parse_mode: 'HTML',
    });
  }
}

export const sendErrorMessageFx = createEffect(
  async ({ task, message }: { task: UserInfo; message: string }) => {
    console.log('error occured:', message);
    notifyAdmin({
      task,
      status: 'error',
      errorInfo: { cause: message },
    });
    bot.telegram.sendMessage(task.chatId, message, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
    });
  }
);
