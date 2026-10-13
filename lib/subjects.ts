import { supabase } from '@/lib/supabaseClient';

export interface DbSubject {
  id: string;
  code: string;
  name: string;
  icon?: string | null;
}

export const FALLBACK_SUBJECTS: DbSubject[] = [
  {
    id: '9d8a0a9e-b790-4b7d-9871-82f85b379b44',
    code: '0455',
    name: 'Economics',
    icon: 'trending-up',
  },
  {
    id: '91144c2d-7feb-4d26-9614-0dda61e96c8d',
    code: '0625',
    name: 'Physics',
    icon: 'atom',
  },
];

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

    if (error || !data || data.length === 0) {
      if (error) {
        console.warn('Failed to fetch subjects from Supabase, using fallback:', error.message);
      }
      return FALLBACK_SUBJECTS;
    }

    return data as DbSubject[];
  } catch (err) {
    console.warn('Error fetching subjects from Supabase, using fallback:', err);
    return FALLBACK_SUBJECTS;
  }
}
