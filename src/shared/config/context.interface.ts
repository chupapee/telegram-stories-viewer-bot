import { Context, Scenes } from 'telegraf';
import { User } from 'typegram';

export interface UserSession extends User {
  messagesToRemove: number[];
}

interface SceneSession extends Scenes.SceneSession {
  usersList: UserSession[] | undefined;
}

export interface IContextBot extends Context {
  scene: Scenes.SceneContextScene<IContextBot>;
  session: SceneSession;
  i18n: {
    locale: (lang?: string) => string; // get|set current locale
    t: (recourceKey: string, ctx?: unknown) => string; // Get resource value (context will be used by template engine)
  };
}
