'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Users,
  Send,
  FileText,
  BarChart3,
  Trophy,
  BookOpen,
  Flag,
  Building2,
  ExternalLink,
  Plus,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import {
  PortalNavItem,
  PortalNavSection,
  getPortalNavItems,
  getActivePortalMenuItems,
  togglePortalMenuItem,
  addPortalMenuItem,
  removePortalMenuItem,
  resetPortalNavToDefaults,
  PORTAL_NAV_CHANGE_EVENT,
} from '@/lib/portal/menuConfig';
import {
  PAGE_REGISTRY,
  setPageEnabled,
  resetPageVisibility,
  usePageVisibility,
} from '@/lib/pageVisibility';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutGrid,
  Users,
  Send,
  FileText,
  BarChart3,
  Trophy,
  BookOpen,
  Flag,
  Building2,
  ExternalLink,
  Link: LinkIcon,
  Sparkles,
};

const SECTION_LABELS: Record<PortalNavSection, string> = {
  teaching: 'Teaching Modules',
  analytics: 'Analytics & Insights',
  verification: 'Question Verification',
  school: 'School & Licence',
  custom: 'Custom School Resources',
};

const SECTION_COLORS: Record<PortalNavSection, { bg: string; text: string; border: string }> = {
  teaching: { bg: '#ffe1d0', text: '#201e1d', border: '#201e1d' },
  analytics: { bg: '#e8f4d9', text: '#2d4a1d', border: '#201e1d' },
  verification: { bg: '#fdf2d0', text: '#614800', border: '#201e1d' },
  school: { bg: '#dbeafe', text: '#1e3a8a', border: '#201e1d' },
  custom: { bg: '#fce7f3', text: '#831843', border: '#201e1d' },
};

export default function PortalMenuManager() {
  const [items, setItems] = useState<PortalNavItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const pageVisibility = usePageVisibility();
  // Optimistic overrides (id -> enabled) while a server write is in flight
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [resettingAll, setResettingAll] = useState(false);

  const isPageOn = (id: string) =>
    id in optimistic ? optimistic[id] : !pageVisibility.isHidden(id);
  const isOn = (item: PortalNavItem) => (item.isCustom ? item.enabled : isPageOn(item.id));

  const togglePage = async (id: string, label: string, audienceLabel: string) => {
    const next = !isPageOn(id);
    setOptimistic((prev) => ({ ...prev, [id]: next }));
    try {
      await setPageEnabled(id, next);
      await pageVisibility.refresh();
      showFeedback('success', `"${label}" is now ${next ? 'visible to' : 'hidden from'} ${audienceLabel}.`);
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to update page visibility');
    } finally {
      setOptimistic((prev) => {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleShowAll = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Show all student and teacher pages again?')) return;
    setResettingAll(true);
    try {
      await resetPageVisibility();
      await pageVisibility.refresh();
      showFeedback('success', 'All pages are visible again.');
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to reset page visibility');
    } finally {
      setResettingAll(false);
    }
  };

  // New item form state
  const [newLabel, setNewLabel] = useState('');
  const [newHref, setNewHref] = useState('');
  const [newSection, setNewSection] = useState<PortalNavSection>('custom');
  const [newIconName, setNewIconName] = useState('ExternalLink');

  // Load items on mount
  useEffect(() => {
    setMounted(true);
    setItems(getPortalNavItems());

    const handleConfigChange = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setItems(e.detail);
      } else {
        setItems(getPortalNavItems());
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(PORTAL_NAV_CHANGE_EVENT, handleConfigChange);
      return () => {
        window.removeEventListener(PORTAL_NAV_CHANGE_EVENT, handleConfigChange);
      };
    }
  }, []);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleToggle = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (target && !target.isCustom) {
      void togglePage(id, target.label, 'teachers');
      return;
    }
    try {
      const updated = togglePortalMenuItem(id);
      setItems(updated);
      const item = updated.find((i) => i.id === id);
      showFeedback(
        'success',
        `"${item?.label}" is now ${item?.enabled ? 'visible in' : 'hidden from'} the Educator Portal.`
      );
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to toggle menu item');
    }
  };

  const handleReset = () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Reset navigation to default settings? All custom links will be removed. Use "Show all pages" to re-enable hidden pages.'
      );
      if (!confirmed) return;
    }

    try {
      const defaults = resetPortalNavToDefaults();
      setItems(defaults);
      showFeedback('success', 'Educator Portal navigation reset to defaults (custom links removed).');
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to reset navigation.');
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      showFeedback('error', 'Please provide a display title for the menu item.');
      return;
    }

    // Generate unique slug id
    const baseId = newLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const uniqueId = `custom-${baseId || 'link'}-${Date.now().toString().slice(-4)}`;

    try {
      const updated = addPortalMenuItem({
        id: uniqueId,
        label: newLabel.trim(),
        section: newSection,
        iconName: newIconName,
        href: newHref.trim() || undefined,
        enabled: true,
      });

      setItems(updated);
      setNewLabel('');
      setNewHref('');
      setIsAdding(false);
      showFeedback('success', `Added custom menu item "${newLabel.trim()}".`);
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to add custom menu item');
    }
  };

  const handleRemove = (id: string, label: string) => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Permanently remove "${label}" from the Educator Portal?`);
      if (!confirmed) return;
    }

    try {
      const updated = removePortalMenuItem(id);
      setItems(updated);
      showFeedback('success', `Removed "${label}".`);
    } catch (err: any) {
      showFeedback('error', err?.message || 'Failed to remove menu item');
    }
  };

  if (!mounted) {
    return (
      <div className="p-8 text-center font-mono text-sm text-[#645c50]">
        Loading Educator Portal navigation configuration...
      </div>
    );
  }

  const activeCount = items.filter(isOn).length;
  const customCount = items.filter((i) => i.isCustom).length;

  const studentPages = PAGE_REGISTRY.filter((p) => p.audience === 'student');
  const sections: PortalNavSection[] = ['teaching', 'analytics', 'verification', 'school', 'custom'];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header Card */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#ffe1d0] border border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#201e1d]">
                PORTAL CONFIGURATION
              </span>
              <span className="text-xs font-mono font-bold text-[#645c50]">
                Page &amp; Navigation Manager
              </span>
            </div>
            <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
              Page Visibility &amp; Menu Management
            </h1>
            <p className="text-sm text-[#474238] mt-1 max-w-2xl font-medium">
              Control which teacher portal modules and student pages users can see. Hidden pages are
              blocked for everyone except admins. Custom links are stored on this device.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleShowAll}
              disabled={resettingAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#dbeafe] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#bfdbfe] text-xs font-bold text-[#201e1d] transition-transform active:translate-y-0.5 disabled:opacity-60"
              title="Make every student and teacher page visible again"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{resettingAll ? 'Resetting...' : 'Show all pages'}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] text-xs font-bold text-[#201e1d] transition-transform active:translate-y-0.5"
              title="Reset all menu items to initial defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#b8c99d] text-xs font-bold text-[#201e1d] transition-transform active:translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Link</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t-2 border-[#201e1d]/10">
          <div className="p-3 bg-[#f5ead8] rounded-xl border border-[#201e1d]/15">
            <span className="text-[10px] font-mono font-bold uppercase text-[#645c50] block">Total Modules</span>
            <span className="text-xl font-heading font-black text-[#201e1d]">{items.length}</span>
          </div>
          <div className="p-3 bg-[#f0fae1] rounded-xl border border-[#201e1d]/15">
            <span className="text-[10px] font-mono font-bold uppercase text-[#3d472b] block">Active / Visible</span>
            <span className="text-xl font-heading font-black text-emerald-800">{activeCount}</span>
          </div>
          <div className="p-3 bg-[#ffe1d0] rounded-xl border border-[#201e1d]/15">
            <span className="text-[10px] font-mono font-bold uppercase text-[#8c491a] block">Hidden / Disabled</span>
            <span className="text-xl font-heading font-black text-[#8c491a]">{items.length - activeCount}</span>
          </div>
          <div className="p-3 bg-[#fce7f3] rounded-xl border border-[#201e1d]/15">
            <span className="text-[10px] font-mono font-bold uppercase text-[#831843] block">Custom Links</span>
            <span className="text-xl font-heading font-black text-[#831843]">{customCount}</span>
          </div>
        </div>

        {/* Feedback Alert Pill */}
        {feedback && (
          <div
            className={`mt-4 p-3 rounded-xl border-2 border-[#201e1d] flex items-center gap-2.5 text-xs font-bold shadow-offset-2 ${
              feedback.type === 'success'
                ? 'bg-[#ccdbb2] text-[#201e1d]'
                : 'bg-[#ffc6a5] text-[#8c491a]'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-800 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-800 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Add Custom Item Modal / Accordion */}
      {isAdding && (
        <form
          onSubmit={handleAddItem}
          className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-3 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#201e1d]/10">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#ffe1d0] border border-[#201e1d] flex items-center justify-center text-xs">
                ✨
              </span>
              <h2 className="text-lg font-heading font-black text-[#201e1d]">Add Custom Navigation Item</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs font-bold text-[#645c50] hover:text-[#201e1d]"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#201e1d] mb-1 font-mono uppercase tracking-wide">
                Display Title *
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Department Syllabus, Cambridge Hub"
                className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#201e1d] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#ffe1d0]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#201e1d] mb-1 font-mono uppercase tracking-wide">
                Destination URL (Optional)
              </label>
              <input
                type="url"
                value={newHref}
                onChange={(e) => setNewHref(e.target.value)}
                placeholder="https://school.edu/syllabus or /portal/custom"
                className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#201e1d] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#ffe1d0]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#201e1d] mb-1 font-mono uppercase tracking-wide">
                Sidebar Section
              </label>
              <select
                value={newSection}
                onChange={(e) => setNewSection(e.target.value as PortalNavSection)}
                className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#201e1d] text-sm font-medium focus:outline-none"
              >
                <option value="custom">Custom School Resources</option>
                <option value="teaching">Teaching Modules</option>
                <option value="analytics">Analytics & Insights</option>
                <option value="verification">Question Verification</option>
                <option value="school">School & Licence</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#201e1d] mb-1 font-mono uppercase tracking-wide">
                Icon Style
              </label>
              <select
                value={newIconName}
                onChange={(e) => setNewIconName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#201e1d] text-sm font-medium focus:outline-none"
              >
                <option value="ExternalLink">External Link (Arrow)</option>
                <option value="Link">Standard Link (Chain)</option>
                <option value="BookOpen">Document / Book</option>
                <option value="FileText">Document / Page</option>
                <option value="Sparkles">Sparkles / AI</option>
                <option value="Building2">School / Building</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 rounded-xl border-2 border-transparent text-xs font-bold text-[#645c50] hover:text-[#201e1d]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] text-xs font-bold text-[#201e1d] transition-transform active:translate-y-0.5"
            >
              Save Menu Item
            </button>
          </div>
        </form>
      )}

      {/* Sections & Items List */}
      <div className="space-y-6">
        {sections.map((sectionKey) => {
          const sectionItems = items.filter((i) => i.section === sectionKey);
          if (sectionItems.length === 0 && sectionKey !== 'custom') return null;

          const color = SECTION_COLORS[sectionKey];

          return (
            <div
              key={sectionKey}
              className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-2 space-y-3"
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border border-[#201e1d]"
                    style={{ backgroundColor: color.bg, color: color.text }}
                  >
                    {SECTION_LABELS[sectionKey]}
                  </span>
                  <span className="text-xs font-mono text-[#645c50]">
                    ({sectionItems.filter(isOn).length}/{sectionItems.length} active)
                  </span>
                </div>
              </div>

              {sectionItems.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#f5ead8]/50 border border-dashed border-[#201e1d]/20 text-center text-xs text-[#645c50] font-medium">
                  No custom items in this section yet. Click &quot;Add Custom Link&quot; above to create one.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sectionItems.map((item) => {
                    const IconComponent = ICON_MAP[item.iconName] || LayoutGrid;
                    const on = isOn(item);

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border-2 border-[#201e1d] flex items-center justify-between gap-3 transition-all ${
                          on
                            ? 'bg-white shadow-offset-2'
                            : 'bg-[#f5ead8]/60 opacity-60 border-dashed'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-[#201e1d]/20 ${
                              on
                                ? 'bg-[#ffe1d0] text-[#201e1d]'
                                : 'bg-[#e5dcd1] text-[#78716c]'
                            }`}
                          >
                            <IconComponent className="w-4 h-4" />
                          </span>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[#201e1d] truncate">
                                {item.label}
                              </span>
                              {item.badge && (
                                <span className="px-1.5 py-0.2 rounded-md bg-[#ffe1d0] text-[#c67139] text-[9px] font-black uppercase tracking-wider">
                                  {item.badge}
                                </span>
                              )}
                              {item.isCustom && (
                                <span className="px-1.5 py-0.2 rounded-md bg-[#fce7f3] text-[#831843] text-[9px] font-mono font-bold uppercase tracking-wider">
                                  Custom
                                </span>
                              )}
                            </div>

                            {item.href ? (
                              <a
                                href={item.href}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-blue-700 hover:underline flex items-center gap-1 font-mono truncate"
                              >
                                <span>{item.href}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-[#645c50] font-mono">
                                Core Module · ID: {item.id}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleToggle(item.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-[#201e1d] font-bold text-xs transition-transform active:translate-y-0.5 ${
                              on
                                ? 'bg-[#ccdbb2] text-[#201e1d] hover:bg-[#b8c99d] shadow-offset-2'
                                : 'bg-[#f5ead8] text-[#645c50] hover:bg-[#ffe1d0]'
                            }`}
                            title={on ? 'Click to hide this module' : 'Click to show this module'}
                          >
                            {on ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-emerald-800" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-[#645c50]" />
                                <span>Hidden</span>
                              </>
                            )}
                          </button>

                          {/* Delete Button for Custom Items */}
                          {item.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleRemove(item.id, item.label)}
                              className="p-1.5 rounded-xl border-2 border-[#201e1d] bg-[#ffc6a5] text-[#8c491a] hover:bg-[#ffa07a] transition-transform active:translate-y-0.5"
                              title="Delete this custom item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Student pages */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-2 space-y-3" data-testid="student-pages-section">
        <div className="flex items-center gap-2 px-1">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border border-[#201e1d] bg-[#fef08a] text-[#201e1d]">
            Student pages
          </span>
          <span className="text-xs font-mono text-[#645c50]">
            {pageVisibility.loaded
              ? `(${studentPages.filter((p) => isPageOn(p.id)).length}/${studentPages.length} visible)`
              : '(loading...)'}
          </span>
        </div>

        {!pageVisibility.loaded ? (
          <div className="p-4 rounded-xl bg-[#f5ead8]/50 border border-dashed border-[#201e1d]/20 text-center text-xs text-[#645c50] font-medium">
            Loading page visibility...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {studentPages.map((page) => {
              const on = isPageOn(page.id);
              return (
                <div
                  key={page.id}
                  className={`p-3.5 rounded-2xl border-2 border-[#201e1d] flex items-center justify-between gap-3 transition-all ${
                    on ? 'bg-white shadow-offset-2' : 'bg-[#f5ead8]/60 opacity-60 border-dashed'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-[#201e1d] truncate">{page.label}</span>
                    <span className="text-[11px] text-[#645c50] font-mono truncate">{page.description}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePage(page.id, page.label, 'students')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-[#201e1d] font-bold text-xs shrink-0 transition-transform active:translate-y-0.5 ${
                      on
                        ? 'bg-[#ccdbb2] text-[#201e1d] hover:bg-[#b8c99d] shadow-offset-2'
                        : 'bg-[#f5ead8] text-[#645c50] hover:bg-[#ffe1d0]'
                    }`}
                    title={on ? 'Click to hide this page from students' : 'Click to show this page to students'}
                  >
                    {on ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-800" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-[#645c50]" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
