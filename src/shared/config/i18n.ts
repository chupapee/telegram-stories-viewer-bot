import path from 'path';
import TelegrafI18n from 'telegraf-i18n';

export const i18n = new TelegrafI18n({
	defaultLanguage: 'en',
	allowMissing: false, // Default true
	useSession: true,
	sessionName: 'session',
	defaultLanguageOnMissing: true,
	directory: path.resolve(__dirname, './locales'),
});
