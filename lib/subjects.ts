import { supabase } from '@/lib/supabaseClient';

export interface DbSubject {
  id: string;
  code: string;
  name: string;
  icon?: string | null;
}

export const FALLBACK_SUBJECTS: DbSubject[] = [];

export function getSubjectEmoji(subject: {
  code?: string;
  icon?: string | null;
  name?: string;
}): string {
  const code = subject.code?.toLowerCase();
  const icon = subject.icon?.toLowerCase();
  const name = subject.name?.toLowerCase();

  if (code === '0455' || icon === 'trending-up' || name === 'economics') {
    return '📊';
  }
  if (code === '0625' || icon === 'atom' || name === 'physics') {
    return '⚛️';
  }
  if (code === '0620' || icon === 'flask' || name === 'chemistry') {
    return '🧪';
  }
  if (code === '0610' || icon === 'dna' || name === 'biology') {
    return '🧬';
  }
  return '📚';
}

export async function fetchSubjectsFromDb(): Promise<DbSubject[]> {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, code, name, icon')
      .order('name');

    if (error) {
      console.warn('Failed to fetch subjects from Supabase:', error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data as DbSubject[];
  } catch (err) {
    console.warn('Error fetching subjects from Supabase:', err);
    return [];
  }
}
