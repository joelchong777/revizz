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
  const [group, setGroup] = useState<'teacher' | 'student' | 'custom'>('teacher');
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

  const teacherItems = items.filter((i) => !i.isCustom);
  const customItems = items.filter((i) => i.isCustom);
  const studentPages = PAGE_REGISTRY.filter((p) => p.audience === 'student');

  const teacherOn = teacherItems.filter(isOn).length;
  const studentOn = studentPages.filter((p) => isPageOn(p.id)).length;
  const customOn = customItems.filter(isOn).length;
  const totalCount = teacherItems.length + studentPages.length + customItems.length;
  const visibleCount = teacherOn + studentOn + customOn;

  const GROUPS: Array<{ key: 'teacher' | 'student' | 'custom'; label: string; on: number; total: number }> = [
    { key: 'teacher', label: 'Teacher', on: teacherOn, total: teacherItems.length },
    { key: 'student', label: 'Student', on: studentOn, total: studentPages.length },
    { key: 'custom', label: 'Custom links', on: customOn, total: customItems.length },
  ];

  const chipBase =
    'flex items-center justify-between gap-2 w-full min-h-[44px] sm:min-h-[36px] px-2.5 py-1 rounded-xl border-2 border-[#201e1d] text-left transition-transform active:translate-y-0.5';

  const renderSwitch = (on: boolean) => (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-[#201e1d] transition-colors ${
        on ? 'bg-[#ccdbb2]' : 'bg-[#e5dcd1]'
      }`}
    >
      <span
        className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#201e1d] transition-all ${
          on ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </span>
  );

  const renderChip = (opts: {
    id: string;
    label: string;
    description: string;
    on: boolean;
    onToggle: () => void;
    Icon?: React.ElementType;
    custom?: boolean;
  }) => {
    const { id, label, description, on, onToggle, Icon, custom } = opts;
    return (
      <div key={id} className="flex items-stretch gap-1.5">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`${label}: ${on ? 'visible' : 'hidden'}`}
          title={description}
          onClick={onToggle}
          className={`${chipBase} ${
            on ? 'bg-white shadow-offset-2 hover:bg-[#f0fae1]' : 'bg-[#f5ead8]/70 border-dashed text-[#645c50] hover:bg-[#ffe1d0]'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0 text-[#645c50]" />}
            <span className="min-w-0 flex flex-col leading-tight">
              <span className="text-xs font-bold text-[#201e1d] truncate">{label}</span>
              <span className="text-[10px] font-mono text-[#645c50] truncate">{description}</span>
            </span>
          </span>
          {renderSwitch(on)}
        </button>
        {custom && (
          <button
            type="button"
            onClick={() => handleRemove(id, label)}
            aria-label={`Delete custom link ${label}`}
            title="Delete this custom item"
            className="min-w-[44px] sm:min-w-[36px] flex items-center justify-center rounded-xl border-2 border-[#201e1d] bg-[#ffc6a5] text-[#8c491a] hover:bg-[#ffa07a] transition-transform active:translate-y-0.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 w-full">
      {/* Compact toolbar */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl px-3 py-2 shadow-offset-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base font-black text-[#201e1d] font-heading tracking-tight truncate">
              Page Visibility &amp; Menus
            </h1>
            <span
              className="px-2 py-0.5 rounded-full bg-[#ffe1d0] border border-[#201e1d] text-[10px] font-mono font-bold text-[#201e1d] whitespace-nowrap"
              data-testid="visible-count"
            >
              {visibleCount} of {totalCount} visible
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleShowAll}
              disabled={resettingAll}
              className="flex items-center gap-1.5 px-2.5 min-h-[44px] sm:min-h-[32px] rounded-xl bg-[#dbeafe] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#bfdbfe] text-xs font-bold text-[#201e1d] transition-transform active:translate-y-0.5 disabled:opacity-60"
              title="Make every student and teacher page visible again"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{resettingAll ? 'Resetting...' : 'Show all pages'}</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-2.5 min-h-[44px] sm:min-h-[32px] rounded-xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] text-xs font-bold text-[#201e1d] transition-transform active:translate-y-0.5"
              title="Remove all custom links"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset custom links</span>
            </button>
          </div>
        </div>

        {/* Segmented control */}
        <div role="tablist" aria-label="Page groups" className="grid grid-cols-3 gap-1.5">
          {GROUPS.map((g) => {
            const active = group === g.key;
            return (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setGroup(g.key)}
                className={`min-h-[44px] sm:min-h-[32px] px-2 rounded-xl border-2 border-[#201e1d] text-xs font-bold truncate transition-transform active:translate-y-0.5 ${
                  active ? 'bg-[#ffe1d0] shadow-offset-2 text-[#201e1d]' : 'bg-transparent text-[#645c50] hover:bg-[#f5ead8]'
                }`}
              >
                {g.label}{' '}
                <span className="font-mono text-[10px]">
                  {g.on}/{g.total}
                </span>
              </button>
            );
          })}
        </div>

        {feedback && (
          <div
            role="status"
            className={`p-2 rounded-xl border-2 border-[#201e1d] flex items-center gap-2 text-xs font-bold shadow-offset-2 ${
              feedback.type === 'success' ? 'bg-[#ccdbb2] text-[#201e1d]' : 'bg-[#ffc6a5] text-[#8c491a]'
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

      {/* Active group */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-2.5 shadow-offset-2" role="tabpanel">
        {group === 'teacher' && (
          !pageVisibility.loaded ? (
            <div className="p-3 text-center text-xs text-[#645c50] font-medium">Loading page visibility...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {teacherItems.map((item) =>
                renderChip({
                  id: item.id,
                  label: item.label,
                  description: SECTION_LABELS[item.section] + (item.href ? ` · ${item.href}` : ''),
                  on: isOn(item),
                  onToggle: () => handleToggle(item.id),
                  Icon: ICON_MAP[item.iconName] || LayoutGrid,
                })
              )}
            </div>
          )
        )}

        {group === 'student' && (
          !pageVisibility.loaded ? (
            <div className="p-3 text-center text-xs text-[#645c50] font-medium">Loading page visibility...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="student-pages-section">
              {studentPages.map((page) =>
                renderChip({
                  id: page.id,
                  label: page.label,
                  description: page.description,
                  on: isPageOn(page.id),
                  onToggle: () => togglePage(page.id, page.label, 'students'),
                })
              )}
            </div>
          )
        )}

        {group === 'custom' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-[#645c50]">Custom links are stored on this device.</span>
              <button
                type="button"
                onClick={() => setIsAdding(!isAdding)}
                aria-expanded={isAdding}
                className="flex items-center gap-1.5 px-2.5 min-h-[44px] sm:min-h-[32px] rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#b8c99d] text-xs font-bold text-[#201e1d] transition-transform active:translate-y-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAdding ? 'Close' : 'Add link'}</span>
              </button>
            </div>

            {isAdding && (
              <form
                onSubmit={handleAddItem}
                className="border-2 border-[#201e1d] rounded-xl bg-white p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2"
              >
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Display title *"
                  aria-label="Display title"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border-2 border-[#201e1d] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#ffe1d0]"
                  required
                />
                <input
                  type="url"
                  value={newHref}
                  onChange={(e) => setNewHref(e.target.value)}
                  placeholder="https://... (optional)"
                  aria-label="Destination URL"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border-2 border-[#201e1d] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#ffe1d0]"
                />
                <select
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value as PortalNavSection)}
                  aria-label="Sidebar section"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border-2 border-[#201e1d] text-xs font-medium focus:outline-none"
                >
                  <option value="custom">Custom School Resources</option>
                  <option value="teaching">Teaching Modules</option>
                  <option value="analytics">Analytics & Insights</option>
                  <option value="verification">Question Verification</option>
                  <option value="school">School & Licence</option>
                </select>
                <select
                  value={newIconName}
                  onChange={(e) => setNewIconName(e.target.value)}
                  aria-label="Icon style"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border-2 border-[#201e1d] text-xs font-medium focus:outline-none"
                >
                  <option value="ExternalLink">External Link</option>
                  <option value="Link">Standard Link</option>
                  <option value="BookOpen">Document / Book</option>
                  <option value="FileText">Document / Page</option>
                  <option value="Sparkles">Sparkles / AI</option>
                  <option value="Building2">School / Building</option>
                </select>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 min-h-[44px] sm:min-h-[32px] rounded-xl text-xs font-bold text-[#645c50] hover:text-[#201e1d]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 min-h-[44px] sm:min-h-[32px] rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] text-xs font-bold text-[#201e1d] transition-transform active:translate-y-0.5"
                  >
                    Save link
                  </button>
                </div>
              </form>
            )}

            {customItems.length === 0 ? (
              <div className="p-3 rounded-xl border border-dashed border-[#201e1d]/20 text-center text-xs text-[#645c50] font-medium">
                No custom links yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {customItems.map((item) =>
                  renderChip({
                    id: item.id,
                    label: item.label,
                    description: item.href || 'No destination URL',
                    on: item.enabled,
                    onToggle: () => handleToggle(item.id),
                    Icon: ICON_MAP[item.iconName] || ExternalLink,
                    custom: true,
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
