import { redirect } from 'next/navigation';

interface AdminPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminPage(props: AdminPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const rawTab = searchParams?.tab || searchParams?.nav;
  const tab = Array.isArray(rawTab) ? rawTab[0] : rawTab;
  
  if (tab && typeof tab === 'string') {
    const normalized = tab.toLowerCase();
    if (normalized === 'ingestion' || normalized === 'importer') {
      redirect('/portal?tab=ingestion');
    }
    redirect(`/portal?tab=${encodeURIComponent(tab)}`);
  }
  
  redirect('/portal?tab=assign');
}
