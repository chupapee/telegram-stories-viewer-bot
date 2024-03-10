/* eslint-disable @typescript-eslint/return-await */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import input from 'input';
// import { userbotMessagesListener } from 'model';
import { TelegramClient } from 'telegram';
import { Entity } from 'telegram/define';
import { StoreSession } from 'telegram/sessions';

import {
  STORIES_BOT_USERNAME,
  USERBOT_API_HASH,
  USERBOT_API_ID,
  USERBOT_PHONE_NUMBER,
} from '@shared/config';

export class Userbot {
  private static client: TelegramClient;

  public static async getInstance() {
    if (!Userbot.client) {
      // FIXME: RACE CONDITION ISSUE
      Userbot.client = await initClient();
    }
    return Userbot.client;
  }
}

export class StoriesBot {
  private static entity: Entity;

  public static async getEntity() {
    if (!StoriesBot.entity) {
      const client = await Userbot.getInstance();
      StoriesBot.entity = await client.getEntity(STORIES_BOT_USERNAME);
    }
    return StoriesBot.entity;
  }
}

async function initClient() {
  const storeSession = new StoreSession('folder_name');

  const client = new TelegramClient(
    storeSession,
    USERBOT_API_ID,
    USERBOT_API_HASH,
    {
      connectionRetries: 5,
    }
  );

  await client.start({
    phoneNumber: USERBOT_PHONE_NUMBER,
    password: async () => await input.text('Please enter your password: '),
    phoneCode: async () =>
      await input.text('Please enter the code you received: '),
    onError: (err) => console.log('error', err),
  });
  console.log('You should now be connected.');
  console.log(client.session.save()); // Save the session to avoid logging in again
  await client.sendMessage('me', { message: 'Hi!' });
  return client;
}

export async function initUserbot() {
  await Userbot.getInstance(); // init

  console.log('userbot initiated');
}
