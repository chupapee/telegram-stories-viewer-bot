import { doc, getDoc, updateDoc } from '@firebase/firestore';
import { BOT_ADMIN_ID, db } from '@shared/config';

import {
  DatabaseEntities,
  DatabaseUser,
  SocialMediaType,
} from '../model/types';

export async function getUsers(): Promise<DatabaseEntities | undefined>;
export async function getUsers(
  appType: SocialMediaType
): Promise<DatabaseUser[] | undefined>;

export async function getUsers(
  appType?: SocialMediaType
): Promise<DatabaseUser[] | DatabaseEntities | undefined> {
  const usersRef = doc(db, 'users', 'list');
  try {
    const response = (await getDoc(usersRef)).data() as DatabaseEntities;
    if (appType) return response[appType];
    return response;
  } catch (error) {
    console.error(error, 'GETTING DB USERS FAILED');
  }
}

/** Some symbols aren't allowed in the database
 * so they should be stringified first
 */
const updatable = (object: unknown) => JSON.parse(JSON.stringify(object));

export async function saveUser(
  oldUsers: DatabaseUser[],
  newUser: DatabaseUser,
  appType: SocialMediaType
) {
  if (newUser.id !== BOT_ADMIN_ID) {
    const usersRef = doc(db, 'users', 'list');
    const updatedUsers = [...oldUsers, updatable(newUser)];
    try {
      await updateDoc(usersRef, {
        [appType]: updatedUsers,
      });
      console.log('USER SAVED SUCCESSFULLY');
    } catch (error) {
      console.error(error, 'SAVING USER IN DB FAILED');
    }
  }
}
