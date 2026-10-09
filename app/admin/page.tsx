import { redirect } from 'next/navigation';

interface AdminPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminPage(props: AdminPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const tab = searchParams?.tab || searchParams?.nav;
  
  if (tab && typeof tab === 'string') {
    redirect(`/portal?tab=${encodeURIComponent(tab)}`);
  }
  
  redirect('/portal?tab=assign');
}
