import { supabase } from './supabaseClient';
import { UserProfile } from '../types';

export const syncGuestDataToUser = async (userId: string, currentProfile: UserProfile): Promise<UserProfile | null> => {
  try {
    // Guest XP is client-forgeable, so it no longer carries into an account; scores are server-side.
    localStorage.removeItem('revizz_guest_xp');
    // First-try attempts are recorded by the server (/api/quiz/answer); nothing to sync.
    localStorage.removeItem('revizz_first_try_correct_ids');

    const guestReviewPileStr = localStorage.getItem('revizz_guest_review_pile');
    let reviewPileItems: { question_id: string; mistakes_count: number }[] = [];
    if (guestReviewPileStr) {
      try {
        const parsed = JSON.parse(guestReviewPileStr);
        if (Array.isArray(parsed)) reviewPileItems = parsed;
      } catch (e) {
        console.error('Failed to parse guest review pile', e);
      }
    }

    if (reviewPileItems.length > 0) {
      const upserts = reviewPileItems.map(item => ({
        user_id: userId,
        question_id: item.question_id,
        mistakes_count: item.mistakes_count
      }));

      const { error: reviewError } = await supabase
        .from('review_pile')
        .upsert(upserts, { onConflict: 'user_id, question_id' });

      if (reviewError) throw reviewError;
    }
    localStorage.removeItem('revizz_guest_review_pile');

    return currentProfile;
  } catch (error) {
    console.error('Error syncing guest data to user:', error);
    return currentProfile;
  }
};
