'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AdminPapersRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', 'papers');
    router.replace(`/admin?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#f9f4ed] flex items-center justify-center p-6 font-body">
      <div className="p-6 rounded-2xl bg-[#ebddc5] border-2 border-[#201e1d] shadow-[3px_3px_0_#201e1d] text-center font-heading font-black text-sm text-[#201e1d] flex items-center gap-3">
        <span className="w-5 h-5 rounded-full border-2 border-[#201e1d] border-t-transparent animate-spin" />
        Redirecting to Ingested Paper Viewer...
      </div>
    </div>
  );
}

export default function AdminPapersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f9f4ed] flex items-center justify-center p-6 font-body">
          <div className="p-6 rounded-2xl bg-[#ebddc5] border-2 border-[#201e1d] shadow-[3px_3px_0_#201e1d] text-center font-heading font-black text-sm text-[#201e1d] flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-2 border-[#201e1d] border-t-transparent animate-spin" />
            Loading Ingested Paper Viewer...
          </div>
        </div>
      }
    >
      <AdminPapersRedirect />
    </Suspense>
  );
}
