'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, signInWithGoogle } from '@/lib/auth';
import { Menu, ArrowRight, GraduationCap, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import AppAdminNav from '@/components/admin/AppAdminNav';
import AppAdminHub from '@/components/admin/AppAdminHub';
import { useQuestions } from '@/lib/questions';

const TAB_TITLES: Record<string, string> = {
  ingestion: 'Ingestion Studio',
  history: 'Ingestion History',
  papers: 'Ingested Paper Viewer',
  diagnostics: 'Diagnostics Lab',
  bank: 'Question Bank',
  flagged: 'Flagged Reports',
  editor: 'Question Editor',
  settings: 'Settings',
  system: 'System Overview',
  school: 'School Licences',
  'portal-menu': 'Portal Menu Manager',
  ads: 'Ads & Monetization',
};

function AdminContent() {
  const { userProfile, loading } = useAuth();
  const searchParams = useSearchParams();
  const { questions, loading: questionsLoading } = useQuestions();

  const [activeTab, setActiveTab] = useState<string>('ingestion');
  const [subTab, setSubTab] = useState<string | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>(undefined);

  // Auth & error states
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showOAuthGuide, setShowOAuthGuide] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);

  // Dev & Guest overrides
  const isDev = process.env.NODE_ENV === 'development';
  const [devOverride, setDevOverride] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  // Sync with searchParams
  useEffect(() => {
    const guestParam = searchParams?.get('guest');
    const demoParam = searchParams?.get('demo');
    const modeParam = searchParams?.get('mode');
    const devParam = searchParams?.get('dev');

    if (guestParam === 'true' || demoParam === 'true' || modeParam === 'guest') {
      setGuestMode(true);
    }
    if (isDev && devParam === 'true') {
      setDevOverride(true);
    }

    const subParam = searchParams?.get('sub');
    if (subParam) {
      setSubTab(subParam);
    }

    const tab = searchParams?.get('tab') || searchParams?.get('nav');
    if (tab) {
      const normalized = tab.toLowerCase();
      if (normalized === 'importer') {
        setActiveTab('ingestion');
      } else if (normalized === 'ingestion-history') {
        setActiveTab('history');
      } else if (normalized === 'system') {
        setActiveTab('settings');
        setSubTab('system');
      } else if (normalized === 'school') {
        setActiveTab('settings');
        setSubTab('school');
      } else if (normalized === 'portal-menu') {
        setActiveTab('settings');
        setSubTab('portal-menu');
      } else if (['ingestion', 'history', 'papers', 'diagnostics', 'bank', 'flagged', 'editor', 'settings', 'ads'].includes(normalized)) {
        setActiveTab(normalized);
      }
    }

    const qid = searchParams?.get('qid') || searchParams?.get('questionId');
    if (qid) {
      setSelectedQuestionId(qid);
    }
  }, [searchParams, isDev]);

  const handleSelectTab = (tab: string, sub?: string) => {
    if (tab === 'system') {
      setActiveTab('settings');
      setSubTab('system');
    } else if (tab === 'school') {
      setActiveTab('settings');
      setSubTab('school');
    } else if (tab === 'portal-menu') {
      setActiveTab('settings');
      setSubTab('portal-menu');
    } else {
      setActiveTab(tab);
      if (sub) {
        setSubTab(sub);
      }
    }
    setMobileNavOpen(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab === 'system' || tab === 'school' || tab === 'portal-menu') {
        url.searchParams.set('tab', 'settings');
        url.searchParams.set('sub', tab);
      } else {
        url.searchParams.set('tab', tab);
        if (sub) {
          url.searchParams.set('sub', sub);
        } else if (tab !== 'settings') {
          url.searchParams.delete('sub');
        }
      }
      window.history.replaceState(null, '', url.toString());
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Admin Google Sign-In failed:', err);
      const rawMsg =
        err?.msg ||
        err?.message ||
        (typeof err === 'string' ? err : 'Google OAuth is not configured in Supabase');
      setAuthError(rawMsg);
    } finally {
      setIsSigningIn(false);
    }
  };

  // Loading state
  if (loading && !(isDev && devOverride) && !guestMode) {
    return (
      <div className="min-h-screen bg-[#f5ead8] flex items-center justify-center p-6 font-body">
        <div className="max-w-md w-full bg-[#f9f4ed] rounded-[28px] p-8 border-2 border-[#201e1d] shadow-offset-4 text-center space-y-6 animate-pulse">
          <div className="text-6xl">⚙️</div>
          <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight">
            Loading Admin Console
          </h1>
          <div className="h-3 bg-[#eee7db] rounded-full w-3/4 mx-auto"></div>
          <div className="h-3 bg-[#eee7db] rounded-full w-1/2 mx-auto"></div>
        </div>
      </div>
    );
  }

  const isAdmin = guestMode || (isDev && devOverride) || (userProfile && userProfile.role === 'admin');

  // Case 1: User is logged in as teacher or student (not an app admin)
  if (userProfile && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#f5ead8] p-4 sm:p-6 flex flex-col items-center justify-center font-body text-[#201e1d]">
        <div className="w-full max-w-lg bg-[#f9f4ed] rounded-[28px] p-6 sm:p-8 border-2 border-[#201e1d] shadow-offset-4 space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="w-14 h-14 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] shadow-offset-2 flex items-center justify-center text-2xl shrink-0">
              🔒
            </div>
            <div className="space-y-1 flex-1">
              <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] font-mono text-[10px] font-bold uppercase tracking-wider text-[#201e1d]">
                RESTRICTED ACCESS · APP OPS
              </span>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
                App Admin Operations Console
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#645c50] leading-relaxed">
                This operations deck is restricted to platform administrators for managing exam ingestion pipelines and system telemetry. For classroom assignments and test compilation, visit the Teacher Portal.
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#eee7db] text-[#474238] font-bold text-xs rounded-xl border border-[#201e1d] leading-relaxed text-center font-mono">
            Signed in as <span className="text-[#201e1d] font-bold">{userProfile.display_name}</span> ({userProfile.role || 'student'} account)
          </div>

          <div className="space-y-3 pt-2 border-t-2 border-[#dcd3c4]">
            <Link
              href="/portal"
              className="w-full py-3.5 px-4 bg-[#ffe1d0] text-[#201e1d] font-heading font-black text-sm sm:text-base rounded-2xl border-2 border-[#201e1d] shadow-offset-3 hover:bg-[#ffc6a5] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
            >
              <GraduationCap className="w-5 h-5" />
              <span>Teacher Portal 🎓</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <button
              type="button"
              onClick={() => {
                setGuestMode(true);
                setDevOverride(true);
              }}
              className="w-full py-2.5 bg-[#f0fae1] text-[#272e1b] font-bold text-xs rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#e1eecc] transition-all active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🛠️</span>
              <span>Preview as Demo App Admin</span>
            </button>

            <Link
              href="/"
              className="block w-full py-2.5 bg-[#eee7db] text-[#474238] font-bold text-xs rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#dcd3c4] transition-all active:translate-y-0.5 text-center"
            >
              Return to Student Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Not authenticated at all
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#f5ead8] p-4 sm:p-6 flex flex-col items-center justify-center font-body text-[#201e1d]">
        <div className={`w-full ${authError ? 'max-w-xl' : 'max-w-lg'} bg-[#f9f4ed] rounded-[28px] p-6 sm:p-8 border-2 border-[#201e1d] shadow-offset-4 space-y-6 transition-all duration-150`}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="w-14 h-14 rounded-2xl bg-[#ccdbb2] border-2 border-[#201e1d] shadow-offset-2 flex items-center justify-center text-2xl shrink-0">
              🛠️
            </div>

            <div className="space-y-1 flex-1">
              <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] font-mono text-[10px] font-bold uppercase tracking-wider text-[#201e1d]">
                SUPER ADMIN OPS · PLATFORM ENGINE
              </span>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
                Revizz App Administration Console
              </h1>
              <p className="text-[#645c50] font-medium text-xs sm:text-sm leading-relaxed">
                Platform operations dashboard for exam paper OCR ingestion, diagnostics verification, and database synchronization. Teachers managing classes should use the Teacher Portal.
              </p>
            </div>
          </div>

          {authError && (
            <div className="w-full bg-[#fff2eb] border-2 border-[#201e1d] rounded-2xl p-5 shadow-offset-3 text-left space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] shadow-offset-2 flex items-center justify-center text-xl shrink-0">
                  ⚠️
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-black text-[#201e1d] font-heading leading-snug">
                    Google Sign-In is not configured in Supabase
                  </h2>
                  <p className="text-xs font-medium text-[#645c50] leading-relaxed">
                    You can immediately preview all administration and ingestion tools using Demo Mode below.
                  </p>
                  {typeof authError === 'string' && (
                    <div className="mt-1.5 p-1.5 px-2 bg-[#eee7db] rounded-lg border border-[#dcd3c4] font-mono text-[11px] text-[#8c491a] break-words">
                      Error: {authError}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setGuestMode(true);
                  setDevOverride(true);
                  setAuthError(null);
                }}
                className="w-full py-3.5 px-4 bg-[#ffe1d0] text-[#201e1d] font-heading font-black text-sm rounded-2xl border-2 border-[#201e1d] shadow-offset-3 hover:bg-[#ffc6a5] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🛠️</span> Enter as Demo App Admin
              </button>

              <div className="pt-2 border-t-[1.5px] border-[#dcd3c4]">
                <button
                  type="button"
                  onClick={() => setShowOAuthGuide(!showOAuthGuide)}
                  className="w-full py-2 px-3 text-xs font-bold text-[#645c50] hover:text-[#201e1d] bg-[#f9f4ed] border-[1.5px] border-[#201e1d] rounded-xl flex items-center justify-between transition-colors cursor-pointer shadow-offset-2 active:translate-y-0.5"
                >
                  <span className="flex items-center gap-1.5">
                    <span>⚙️</span>
                    <span>How to enable Google OAuth</span>
                  </span>
                  {showOAuthGuide ? (
                    <ChevronUp className="w-4 h-4 text-[#201e1d]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#201e1d]" />
                  )}
                </button>

                {showOAuthGuide && (
                  <div className="mt-3 p-3.5 bg-[#f9f4ed] rounded-xl border-2 border-[#201e1d] space-y-3 font-body">
                    <div>
                      <div className="text-[11px] font-black text-[#645c50] uppercase tracking-wider mb-1">
                        Callback URL
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-[#eee7db] border border-[#201e1d] font-mono text-[11px] text-[#201e1d]">
                        <span className="flex-1 select-all break-all">
                          https://dmvahcaxixvhgxidmkqs.supabase.co/auth/v1/callback
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                              navigator.clipboard.writeText('https://dmvahcaxixvhgxidmkqs.supabase.co/auth/v1/callback');
                              setCopiedCallback(true);
                              setTimeout(() => setCopiedCallback(false), 2000);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-[#ffe1d0] border border-[#201e1d] hover:bg-[#ffc6a5] text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-offset-2 active:translate-y-0.5"
                          title="Copy callback URL"
                        >
                          {copiedCallback ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t-2 border-[#dcd3c4]">
            {!authError && (
              <button
                type="button"
                onClick={() => {
                  setGuestMode(true);
                  setDevOverride(true);
                }}
                className="w-full py-3.5 bg-[#ccdbb2] text-[#201e1d] font-heading font-black text-sm rounded-2xl border-2 border-[#201e1d] shadow-offset-3 hover:bg-[#b8c99d] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🛠️</span> Enter as Demo App Admin
              </button>
            )}

            <Link
              href="/portal"
              className="w-full py-3 bg-[#ffe1d0] text-[#201e1d] font-heading font-black text-sm rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Go to Teacher Portal 🎓</span>
            </Link>

            <button
              type="button"
              disabled={isSigningIn}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 bg-[#eee7db] text-[#201e1d] font-bold text-xs rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#dcd3c4] transition-all active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {isSigningIn ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In with Admin Account</span>
              )}
            </button>

            <Link
              href="/"
              className="block w-full py-2.5 bg-[#eee7db] text-[#474238] font-bold text-xs rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#dcd3c4] transition-all active:translate-y-0.5 text-center"
            >
              Return to Student Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Admin is authenticated (or in guest / dev preview)
  return (
    <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)] min-h-screen bg-[#f5ead8] text-[#201e1d] font-body">
      {/* Desktop Sidebar (sticky) */}
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto w-[264px] shrink-0">
        <AppAdminNav
          active={activeTab}
          onSelectTab={handleSelectTab}
          userDisplayName={userProfile?.display_name || (guestMode ? 'Demo App Admin' : 'Administrator')}
          questionCount={questions.length}
          questionsLoading={questionsLoading}
        />
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="fixed inset-y-0 left-0 w-[264px] max-w-[85vw] h-full shadow-2xl z-50">
            <AppAdminNav
              active={activeTab}
              onSelectTab={handleSelectTab}
              isOpen={true}
              onClose={() => setMobileNavOpen(false)}
              userDisplayName={userProfile?.display_name || (guestMode ? 'Demo App Admin' : 'Administrator')}
              questionCount={questions.length}
              questionsLoading={questionsLoading}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="min-w-0 flex flex-col min-h-screen">
        {/* Mobile Sticky Top Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#ebddc5] border-b-2 border-[#201e1d] px-4 py-2.5 flex items-center gap-2 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="p-1.5 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-colors active:translate-y-0.5"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-[#201e1d]" />
            </button>
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-heading text-sm font-black text-[#201e1d]">
                App Admin
              </span>
              <span className="text-[#645c50] text-xs font-mono">/</span>
              <span className="text-xs font-bold text-[#645c50] truncate">
                {TAB_TITLES[activeTab] || 'Ingestion Studio'}
              </span>
            </div>
          </div>
        </header>

        {/* Desktop Sticky Top Command Bar */}
        <header className="hidden lg:flex sticky top-0 z-20 bg-[#ebddc5]/95 backdrop-blur-xs border-b-2 border-[#201e1d] px-8 py-3 items-center shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-lg text-[#201e1d]">
              App Admin Console
            </span>
            <span className="text-[#645c50] font-mono text-base">/</span>
            <span className="font-heading font-bold text-base text-[#201e1d]">
              {TAB_TITLES[activeTab] || 'Ingestion Studio'}
            </span>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main
          className={
            activeTab === "ingestion" || activeTab === "papers"
              ? "p-3 sm:p-4 lg:p-6 max-w-[1800px] mx-auto w-full flex-1"
              : "p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1"
          }
        >
          {guestMode && !userProfile && (
            <div className="mb-6 p-3 px-4 rounded-2xl bg-[#fff2eb] border-2 border-[#201e1d] shadow-offset-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-bold text-[#201e1d]">
              <div className="flex items-center gap-2">
                <span className="text-base">🛠️</span>
                <span>Demo Admin Mode · Full interactive access to Ingestion Studio, KaTeX diagnostics, and Question Bank</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGuestMode(false)}
                  className="px-3 py-1 rounded-full bg-[#eee7db] border border-[#201e1d] hover:bg-[#dcd3c4] transition-colors cursor-pointer"
                >
                  Exit Demo
                </button>
              </div>
            </div>
          )}

          <AppAdminHub
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            selectedQuestionId={selectedQuestionId}
            onSelectQuestionId={setSelectedQuestionId}
            subTab={subTab}
          />
        </main>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5ead8] flex items-center justify-center p-6 font-body">
          <div className="max-w-md w-full bg-[#f9f4ed] rounded-[28px] p-8 border-2 border-[#201e1d] shadow-offset-4 text-center space-y-6 animate-pulse">
            <div className="text-6xl">⚙️</div>
            <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight">
              Loading Admin Console
            </h1>
            <div className="h-3 bg-[#eee7db] rounded-full w-3/4 mx-auto"></div>
            <div className="h-3 bg-[#eee7db] rounded-full w-1/2 mx-auto"></div>
          </div>
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
