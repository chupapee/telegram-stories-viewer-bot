import { supabase } from 'index';
import { User } from 'telegraf/typings/core/types/typegram';

export const saveUser = async (user: User) => {
  try {
    const { data } = await supabase.from('users').select('*').eq('id', user.id);
    // save if not exist in db
    if (!data?.length) {
      await supabase.from('users').insert([user]);
    }
  } catch (error) {
    console.log('error on saving user:', error);
  }
};
