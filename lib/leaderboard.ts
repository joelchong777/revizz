import { supabase } from './supabaseClient';
import { UserProfile } from '../types';

export interface LeaderboardEntry {
  id: string;
  display_name: string;
  total_xp: number;
  is_school_account: boolean;
  rank?: number;
}

export const fetchWeeklyLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  // Queries top 10 users with opt_in_leaderboard = true, ordered by total_xp desc
  // Fallback to total_xp as per requirement: "Calculate weekly XP (or total XP of opt-in users as fallback if attempts are fresh)"
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, total_xp, is_school_account')
    .eq('opt_in_leaderboard', true)
    .order('total_xp', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return (data || []).map((user, index) => ({
    ...user,
    rank: index + 1
  }));
};

export const toggleLeaderboardOptIn = async (userId: string, currentOptIn: boolean): Promise<boolean> => {
  const { error } = await supabase
    .from('profiles')
    .update({ opt_in_leaderboard: !currentOptIn })
    .eq('id', userId);

  if (error) {
    console.error('Error toggling leaderboard opt-in:', error);
    return currentOptIn;
  }
  return !currentOptIn;
};
