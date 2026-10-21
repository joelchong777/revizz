'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

export interface PaperDropdownOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface PaperDropdownProps {
  value: string;
  options: PaperDropdownOption[];
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** Shown when there is no selected option (e.g. loading / empty). */
  placeholder?: string;
  size?: 'md' | 'sm';
  className?: string;
}

interface PanelPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  above: boolean;
}

export function PaperDropdown({
  value,
  options,
  onChange,
  id,
  ariaLabel,
  disabled = false,
  placeholder = '',
  size = 'md',
  className = '',
}: PaperDropdownProps) {
  const reactId = useId();
  const listId = `${id ?? reactId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: '', t: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const isDisabled = disabled || options.length === 0;

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const above = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(288, above ? spaceAbove : spaceBelow));
    const width = Math.max(r.width, Math.min(280, window.innerWidth - 16));
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos({ top: above ? r.top - 6 : r.bottom + 6, left, width, maxHeight, above });
  }, []);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const openPanel = useCallback(() => {
    if (isDisabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    measure();
    setOpen(true);
  }, [isDisabled, measure, selectedIndex]);

  const choose = useCallback(
    (idx: number) => {
      const opt = options[idx];
      if (opt) onChange(opt.value);
      close();
    },
    [options, onChange, close],
  );

  // Close on outside pointer, reposition on scroll/resize.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onMove = () => measure();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, measure]);

  // Keep the active option in view.
  useLayoutEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, pos]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isDisabled) return;
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openPanel();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => Math.min(last, a + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(last);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          const now = Date.now();
          const ta = typeahead.current;
          ta.text = now - ta.t > 600 ? e.key.toLowerCase() : ta.text + e.key.toLowerCase();
          ta.t = now;
          const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(ta.text));
          if (hit >= 0) setActive(hit);
        }
    }
  };

  const pad = size === 'sm' ? 'px-2.5 py-1.5' : 'pl-3 pr-2.5 py-2';
  const triggerLabel = selected?.label ?? placeholder;

  const panel =
    open && pos ? (
      <motion.ul
        ref={panelRef}
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={-1}
        initial={{ opacity: 0, y: pos.above ? 4 : -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: pos.above ? 4 : -4 }}
        transition={{ duration: 0.12 }}
        style={{
          position: 'fixed',
          left: pos.left,
          width: pos.width,
          maxHeight: pos.maxHeight,
          ...(pos.above ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
        }}
        className="z-[1000] overflow-y-auto overscroll-contain bg-white border-2 border-[#201e1d] rounded-xl shadow-[2px_2px_0_0_#201e1d] p-1 space-y-0.5"
      >
        {options.map((o, i) => {
          const isSel = o.value === value;
          const isActive = i === active;
          return (
            <li
              key={o.value}
              id={`${listId}-opt-${i}`}
              data-idx={i}
              role="option"
              aria-selected={isSel}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs text-[#201e1d] ${
                isActive ? 'bg-[#ffe1d0]' : isSel ? 'bg-[#eee7db]' : ''
              }`}
            >
              <span className="flex-1 min-w-0">
                <span className="block font-heading font-bold truncate">{o.label}</span>
                {o.sublabel && <span className="block text-[11px] font-medium text-[#645c50] truncate">{o.sublabel}</span>}
              </span>
              {isSel && <Check className="w-4 h-4 shrink-0 text-[#201e1d]" aria-hidden="true" />}
            </li>
          );
        })}
      </motion.ul>
    ) : null;

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${listId}-opt-${active}` : undefined}
        disabled={isDisabled}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={onKeyDown}
        className={`w-full flex items-center justify-between gap-2 bg-white border-2 border-[#201e1d] rounded-xl ${pad} text-xs font-heading font-bold text-[#201e1d] text-left hover:bg-[#ffe1d0] focus:outline-none focus:ring-2 focus:ring-[#ffe1d0] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white`}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {mounted && createPortal(<AnimatePresence>{panel}</AnimatePresence>, document.body)}
    </div>
  );
}
