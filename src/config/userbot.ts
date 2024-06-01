import input from 'input';
import { TelegramClient } from 'telegram';
import { StoreSession } from 'telegram/sessions';

import {
  USERBOT_API_HASH,
  USERBOT_API_ID,
  USERBOT_PHONE_NUMBER,
} from './env-config';

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

async function initClient() {
  const storeSession = new StoreSession('userbot-session');

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
    password: () => input.text('Please enter your password: '),
    phoneCode: () => input.text('Please enter the code you received: '),
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
