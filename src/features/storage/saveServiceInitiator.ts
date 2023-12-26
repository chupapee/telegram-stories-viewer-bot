import { User } from 'typegram';

import {
  DatabaseUser,
  getUsers,
  saveUser,
  SocialMediaType,
} from '@entities/storage';

export const saveServiceInitiator = async (
  user: User,
  socialMediaType: SocialMediaType
) => {
  const newUser: DatabaseUser = {
    ...user,
    date: new Date().toLocaleString(),
    status: 'init',
  };

  try {
    const oldUsers = await getUsers(socialMediaType);
    if (oldUsers) await saveUser(oldUsers, newUser, socialMediaType);
  } catch (error) {
    console.error(error, 'ERROR saveServiceInitiator');
  }
};
