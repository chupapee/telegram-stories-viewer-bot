import { getUsers } from '@entities/storage';
import { i18n } from '@shared/config';
import { timeout } from '@shared/utils';

import { bot } from '../index';
import { toggleBotUpFlag } from './storage/toggleBotUpFlag';

export const onBotUp = async () => {
	try {
		const dbUsers = await getUsers();
		await timeout(500);
		if (dbUsers && !dbUsers.socialBotUpFlag) {
			const users = [
				...dbUsers.insta,
				...dbUsers.twitter,
				...dbUsers.tiktok,
				...dbUsers.you,
			].filter((v, i, a) => a.findIndex((v2) => v2.id === v.id) === i); // unique users only;

			for (const user of users) {
				try {
					await bot.telegram.sendMessage(
						user.id as number,
						i18n.t(user.language_code ?? 'en', 'botUpText'),
						{ parse_mode: 'Markdown' }
					);
					await timeout(500);
				} catch (error) {
					console.error(error, 'onBotUp error');
				}
			}
			toggleBotUpFlag();
		}
	} catch (error) {
		console.error(error, 'onBotUp error');
	}
};
