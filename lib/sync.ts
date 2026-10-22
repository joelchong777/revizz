import { supabase } from './supabaseClient';
import { UserProfile } from '../types';
import { REVIEW_PILE_KEY, FIRST_TRY_CORRECT_KEY, getFirstTryCorrectIds } from './mastery';

export const LOCAL_DATA_OWNER_KEY = 'revizz_local_data_owner';

/**
 * Decides what to do with the local review pile and first-try ids when a user signs in.
 * - 'adopt': no owner recorded yet, keep the data and record the owner.
 * - 'keep': same owner, leave data alone.
 * - 'clear': a different account used this device, wipe the previous owner's data.
 */
export function decideLocalDataAction(
  storedOwner: string | null,
  userId: string
): 'adopt' | 'keep' | 'clear' {
  if (!storedOwner) return 'adopt';
  return storedOwner === userId ? 'keep' : 'clear';
}

export const syncGuestDataToUser = async (userId: string, currentProfile: UserProfile): Promise<UserProfile | null> => {
  try {
    // Guest XP is client-forgeable, so it no longer carries into an account; scores are server-side.
    localStorage.removeItem('revizz_guest_xp');

    const action = decideLocalDataAction(localStorage.getItem(LOCAL_DATA_OWNER_KEY), userId);
    if (action === 'clear') {
      localStorage.removeItem(REVIEW_PILE_KEY);
      localStorage.removeItem(FIRST_TRY_CORRECT_KEY);
      window.dispatchEvent(new CustomEvent('revizz_review_pile_changed'));
      window.dispatchEvent(new CustomEvent('revizz_mastery_updated'));
    }
    if (action !== 'keep') {
      localStorage.setItem(LOCAL_DATA_OWNER_KEY, userId);
    }

    // Cross-device mastery: union server-recorded first-try correct ids into the local list.
    try {
      const { data, error } = await supabase
        .from('user_attempts')
        .select('question_id')
        .eq('user_id', userId)
        .eq('first_attempt_correct', true);
      if (error) throw error;
      if (data && data.length > 0) {
        const local = getFirstTryCorrectIds();
        const merged = new Set(local);
        for (const row of data as { question_id: string }[]) {
          if (row.question_id) merged.add(row.question_id);
        }
        if (merged.size !== local.length) {
          localStorage.setItem(FIRST_TRY_CORRECT_KEY, JSON.stringify(Array.from(merged)));
          window.dispatchEvent(new CustomEvent('revizz_mastery_updated'));
        }
      }
    } catch (e) {
      console.error('Failed to hydrate first-try mastery:', e);
    }

    return currentProfile;
  } catch (error) {
    console.error('Error syncing guest data to user:', error);
    return currentProfile;
  }
};
