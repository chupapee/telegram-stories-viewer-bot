import { User } from 'typegram';

import { bot } from '../index';
import { BOT_ADMIN_ID } from './config';

interface NotifyAdminFullArgs {
	user?: User;
	originalLink?: string;
	text?: string;
}

export const notifyAdmin = ({
	user,
	originalLink,
	text,
}: NotifyAdminFullArgs) => {
	const formattedText = text ? `\n\n${text}` : '';
	const formattedLink = originalLink ? `\n\n${originalLink}` : '';

	if (user) {
		const formattedUser = JSON.stringify(user, null, 2);
		bot.telegram.sendMessage(
			BOT_ADMIN_ID,
			`From: ${formattedUser}${formattedText}${formattedLink}`
		);
		return;
	}

	bot.telegram.sendMessage(BOT_ADMIN_ID, formattedText);
};
