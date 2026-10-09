import { supabase } from './supabaseClient';
import { UserProfile } from '../types';

export const syncGuestDataToUser = async (userId: string, currentProfile: UserProfile): Promise<UserProfile | null> => {
  try {
    const guestXpStr = localStorage.getItem('revizz_guest_xp');
    const guestReviewPileStr = localStorage.getItem('revizz_guest_review_pile');
    
    let xpToAdd = 0;
    if (guestXpStr) {
      xpToAdd = parseInt(guestXpStr, 10) || 0;
    }

    let reviewPileItems: { question_id: string; mistakes_count: number }[] = [];
    if (guestReviewPileStr) {
      try {
        reviewPileItems = JSON.parse(guestReviewPileStr);
      } catch (e) {
        console.error('Failed to parse guest review pile', e);
      }
    }

    const guestFirstTryStr = localStorage.getItem('revizz_first_try_correct_ids');
    let firstTryCorrectIds: string[] = [];
    if (guestFirstTryStr) {
      try {
        const parsed = JSON.parse(guestFirstTryStr);
        if (Array.isArray(parsed)) {
          firstTryCorrectIds = parsed;
        }
      } catch (e) {
        console.error('Failed to parse guest first try correct ids', e);
      }
    }

    if (xpToAdd === 0 && reviewPileItems.length === 0 && firstTryCorrectIds.length === 0) {
      return currentProfile; // Nothing to sync
    }

    // Sync XP
    const newTotalXp = currentProfile.total_xp + xpToAdd;
    if (xpToAdd > 0) {
      const { error: xpError } = await supabase
        .from('profiles')
        .update({ total_xp: newTotalXp })
        .eq('id', userId);
      
      if (xpError) throw xpError;
    }

    // Sync review pile
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

    // Sync first-try attempts
    if (firstTryCorrectIds.length > 0) {
      const attemptUpserts = firstTryCorrectIds.map(qid => ({
        user_id: userId,
        question_id: qid,
        first_attempt_correct: true,
        retry_correct: false,
        xp_awarded: 10,
        time_spent_ms: 0
      }));
      const { error: attemptsError } = await supabase
        .from('user_attempts')
        .upsert(attemptUpserts, { onConflict: 'user_id, question_id' });
      if (attemptsError) console.error('Failed to sync first-try attempts:', attemptsError);
    }

    // Clear local storage
    localStorage.removeItem('revizz_guest_xp');
    localStorage.removeItem('revizz_guest_review_pile');
    localStorage.removeItem('revizz_first_try_correct_ids');

    // Return updated profile
    return { ...currentProfile, total_xp: newTotalXp };
  } catch (error) {
    console.error('Error syncing guest data to user:', error);
    return currentProfile;
  }
};
