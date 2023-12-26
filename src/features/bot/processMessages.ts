import { IContextBot } from '@shared/config';

export const addMsgToRemoveList = (messageId: number, ctx: IContextBot) => {
  const user = ctx.from!;
  if (!ctx.session.usersList) {
    ctx.session.usersList = [{ ...user, messagesToRemove: [messageId] }];
    return;
  }

  const oldU = ctx.session.usersList.find((u) => u.id === user.id);
  if (oldU) {
    oldU.messagesToRemove.push(messageId);
  }
};

const getMsgToRemoveList = (ctx: IContextBot) => {
  const msgToRemoveList = ctx.session.usersList?.find(
    (u) => u.id === ctx.from?.id
  )?.messagesToRemove;
  return msgToRemoveList ?? [];
};

export const removeTempMessages = (ctx: IContextBot) => {
  const msgIdList = getMsgToRemoveList(ctx);
  const chatId = ctx.chat?.id;
  if (msgIdList.length > 0 && chatId) {
    for (const msgId of msgIdList) {
      ctx.telegram
        .deleteMessage(chatId, msgId)
        .catch((error) => console.error(error));
    }
  }
};
