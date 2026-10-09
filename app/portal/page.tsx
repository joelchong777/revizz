'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth, signInWithGoogle } from '../../lib/auth';
import { useRouter } from 'next/navigation';
import AdminCMS from "@/components/portal/AdminCMS";

export default function PortalPage() {
  const { userProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'analytics' | 'content'>('analytics');
  const router = useRouter();

  // Mock Developer override to quickly test UI
  const [devOverride, setDevOverride] = useState(false);

  if (loading) {
    return <div className="p-8 text-center font-bold text-gray-500">Loading Portal...</div>;
  }

  const isEducator = devOverride || (userProfile && (userProfile.role === 'teacher' || userProfile.role === 'admin'));

  if (!isEducator) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border-2 border-slate-200 text-center space-y-6">
          <div className="text-6xl">🎓</div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Educator Access Only</h1>
          <p className="text-slate-600 font-medium">
            This area is restricted to teachers and administrators.
          </p>
          
          <div className="space-y-3 pt-4 border-t-2 border-slate-100">
            {!userProfile ? (
              <button
                onClick={() => signInWithGoogle()}
                className="w-full py-3 bg-blue-50 text-blue-700 font-bold rounded-xl border-2 border-blue-200 hover:bg-blue-100 transition-colors"
              >
                Sign In with Google
              </button>
            ) : null}
            
            <button
              onClick={() => setDevOverride(true)}
              className="w-full py-3 bg-amber-50 text-amber-700 font-bold rounded-xl border-2 border-amber-200 hover:bg-amber-100 transition-colors"
            >
              Preview as Teacher / Admin (Dev)
            </button>
            
            <Link href="/" className="block w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl border-2 border-slate-200 hover:bg-slate-200 transition-colors">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <span className="text-lg">🔙</span>
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">Unified Educator Portal</h1>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {userProfile?.display_name || 'Guest Educator'} • {userProfile?.role || 'Admin'}
              </div>
            </div>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-2xl border-2 border-slate-200">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'analytics' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Teacher Analytics 📊
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'content' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Content Management 📝
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'analytics' ? <AnalyticsTab /> : <ContentTab />}
      </main>
    </div>
  );
}

import TeacherAnalytics from '../../components/portal/TeacherAnalytics';

function AnalyticsTab() {
  return <TeacherAnalytics />;
}

function ContentTab() {
  return <AdminCMS />;
}
