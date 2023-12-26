import { SocialMediaType } from '@entities/storage';
import { BOT_ADMIN_ID, IContextBot } from '@shared/config';
import { notifyAdmin } from '@shared/notifyAdmin';

import { saveServiceInitiator } from '../storage';

interface OnServiceInitArgs {
  ctx: IContextBot;
  socialMediaType: SocialMediaType;
  originalLink: string;
}

export const onServiceInit = ({
  ctx,
  originalLink,
  socialMediaType,
}: OnServiceInitArgs) => {
  if ('message' in ctx.update) {
    const user = ctx.update.message.from;
    if (user.id !== BOT_ADMIN_ID) {
      notifyAdmin({
        user,
        originalLink,
        text: `${socialMediaType} service initialized! 🚀`,
      });
      saveServiceInitiator(user, socialMediaType);
    }
  }
};
