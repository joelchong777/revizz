import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  prefix?: string;
  isActive?: boolean;
  compact?: boolean;
  direction?: 'up' | 'down';
  align?: 'left' | 'right';
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  triggerClassName = "",
  menuClassName = "",
  disabled = false,
  prefix,
  isActive,
  compact = false,
  direction = 'down',
  align = 'left',
  id,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const selectedOption = options.find((opt) => opt.value === value);

  // Active state: highlighted with peach accent when a specific filter is selected (not 'All')
  const isFilterActive = isActive !== undefined 
    ? isActive 
    : (value !== 'All' && value !== '' && value !== undefined);

  const displayLabel = useMemo(() => {
    if (!selectedOption) return placeholder;
    if (prefix) {
      if (selectedOption.label.startsWith(prefix)) {
        return selectedOption.label;
      }
      return `${prefix}${selectedOption.label}`;
    }
    return selectedOption.label;
  }, [selectedOption, prefix, placeholder]);

  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // Reset highlighted index when opening/closing
  useEffect(() => {
    if (isOpen) {
      const selectedIdx = options.findIndex((opt) => opt.value === value);
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, value, options]);

  // Click outside and Escape handling
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (highlightedIndex >= 0 && options[highlightedIndex]) {
          onChange(options[highlightedIndex].value);
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, options, highlightedIndex, onChange]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const springTransition = shouldReduceMotion
    ? { duration: 0.15 }
    : { type: "spring" as const, bounce: 0.3, duration: 0.3 };

  const motionVariants = {
    initial: shouldReduceMotion 
      ? { opacity: 0 } 
      : { opacity: 0, scale: 0.95, y: direction === 'up' ? 6 : -6 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: shouldReduceMotion 
      ? { opacity: 0 } 
      : { opacity: 0, scale: 0.95, y: direction === 'up' ? 6 : -6 },
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || displayLabel}
        title={displayLabel}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full rounded-full border-2 border-[#201e1d] font-bold shadow-[2px_2px_0_#201e1d] transition-all duration-100 cursor-pointer flex items-center justify-between select-none active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          compact ? 'px-2.5 py-1 text-xs' : 'px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm'
        } ${
          isFilterActive
            ? 'bg-[#ffe1d0] text-[#201e1d] hover:bg-[#fed6bf]'
            : 'bg-[#f9f4ed] text-[#201e1d] hover:bg-[#eee7db]'
        } ${triggerClassName}`}
      >
        <span className="truncate pr-1 text-left">{displayLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-1.5 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#201e1d]' : isFilterActive ? 'text-[#201e1d]' : 'text-[#645c50]'
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel || displayLabel}
            initial={motionVariants.initial}
            animate={motionVariants.animate}
            exit={motionVariants.exit}
            transition={springTransition}
            className={`absolute z-50 bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[4px_4px_0_#201e1d] rounded-2xl p-1.5 max-h-64 overflow-y-auto ${
              direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
            } ${align === 'right' ? 'right-0' : 'left-0'} ${
              compact ? 'min-w-[90px]' : 'min-w-[200px]'
            } ${menuClassName}`}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs sm:text-sm font-bold text-[#645c50] text-center">
                No options available
              </div>
            ) : (
              options.map((option, index) => {
                const isSelected = value === option.value;
                const isHighlighted = highlightedIndex === index;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      triggerRef.current?.focus();
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full text-left rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-[#201e1d] hover:bg-[#ffe1d0] cursor-pointer flex items-center justify-between transition-colors mb-0.5 last:mb-0 focus-visible:outline-none ${
                      isSelected
                        ? 'bg-[#ffe1d0]/70'
                        : isHighlighted
                        ? 'bg-[#ffe1d0]/40'
                        : ''
                    }`}
                  >
                    <span className="truncate pr-2">{option.label}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#c67139] flex-shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const NeobrutalistDropdown = Select;
export default Select;
