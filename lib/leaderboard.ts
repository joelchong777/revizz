import { supabase } from './supabaseClient';
import { UserProfile } from '../types';

export interface LeaderboardEntry {
  display_name: string;
  total_xp: number;
  current_streak?: number;
  is_school_account: boolean;
  rank: number;
  is_me: boolean;
}

export const fetchWeeklyLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const { data, error } = await supabase.rpc('get_leaderboard', { p_limit: 10 });

  if (!error) {
    return (data || []) as LeaderboardEntry[];
  }

  // PGRST202: function missing (code deployed before the migration). Fall back to the old query.
  if (error.code === 'PGRST202') {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: rows, error: fbError } = await supabase
      .from('profiles')
      .select('id, display_name, total_xp, is_school_account, current_streak')
      .eq('opt_in_leaderboard', true)
      .order('total_xp', { ascending: false })
      .limit(10);
    if (fbError) {
      console.error('Error fetching leaderboard:', fbError);
      return [];
    }
    return (rows || []).map((row, index) => ({
      display_name: row.display_name,
      total_xp: row.total_xp,
      current_streak: row.current_streak,
      is_school_account: row.is_school_account,
      rank: index + 1,
      is_me: !!user && row.id === user.id,
    }));
  }

  console.error('Error fetching leaderboard:', error);
  return [];
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
