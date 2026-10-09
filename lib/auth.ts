import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { UserProfile } from '../types';

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
    },
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const formatDisplayName = (fullName: string | undefined | null, email: string) => {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return parts[0];
  }
  return email.split('@')[0];
};

export const checkIsSchoolAccount = (email: string) => {
  return email.toLowerCase().includes('frontier');
};

export const useAuth = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          if (mounted) setUserProfile(null);
        } else if (mounted) {
          setUserProfile(data as UserProfile);
        }
      } catch (e) {
        console.error('Exception fetching profile:', e);
        if (mounted) setUserProfile(null);
      }
    };

    const safetyTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 1500);

    const handleAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        const session = data?.session;
        
        if (session?.user) {
          // Sync/create profile
          const email = session.user.email || '';
          const name = session.user.user_metadata?.full_name || '';
          
          const isSchoolAccount = checkIsSchoolAccount(email);
          const displayName = formatDisplayName(name, email);

          try {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (!existingProfile) {
              const newProfile = {
                id: session.user.id,
                display_name: displayName,
                email: email,
                is_school_account: isSchoolAccount,
                total_xp: 0,
                current_streak: 0,
                opt_in_leaderboard: false,
              };
              
              await supabase.from('profiles').insert(newProfile);
              if (mounted) setUserProfile(newProfile as UserProfile);
            } else {
              // ensure school tag is up to date
              if (existingProfile.is_school_account !== isSchoolAccount) {
                await supabase.from('profiles').update({ is_school_account: isSchoolAccount }).eq('id', session.user.id);
                existingProfile.is_school_account = isSchoolAccount;
              }
              if (mounted) setUserProfile(existingProfile as UserProfile);
            }
          } catch (profileError) {
            console.error('Error syncing profile:', profileError);
            if (mounted) setUserProfile(null);
          }
        } else {
          if (mounted) setUserProfile(null);
        }
      } catch (sessionError) {
        console.error('Error fetching session:', sessionError);
        if (mounted) setUserProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    handleAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        handleAuth();
      } else {
        if (mounted) {
          setUserProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  return { userProfile, loading, setUserProfile };
};
