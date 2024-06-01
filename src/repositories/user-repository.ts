import { notifyAdmin } from 'controllers/send-message';
import { supabase } from 'index';
import { User } from 'telegraf/typings/core/types/typegram';

export const saveUser = async (user: User) => {
  try {
    const { data } = await supabase.from('users').select('*').eq('id', user.id);
    // save if not exist in db
    if (!data?.length) {
      notifyAdmin({
        status: 'info',
        baseInfo: `👤 New user added to DB`,
      });
      await supabase.from('users').insert([user]);
    }
  } catch (error) {
    notifyAdmin({
      status: 'error',
      baseInfo: `❌ error occured adding user to DB:\n${JSON.stringify(error)}`,
    });
    console.log('error on saving user:', error);
  }
};
