'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/shared/utils/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

/**
 * Fully custom dropdown — same interaction pattern as the Header FY picker.
 * Uses a div + button + portal-free absolute list so the options are styled
 * consistently with the rest of the app instead of using the OS native popup.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  error = false,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected ? selected.label : placeholder;
  const isPlaceholder = !selected;

  return (
    <div ref={ref} className={cn('relative w-full', className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-xs transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open
            ? 'border-indigo-400 ring-2 ring-indigo-500 ring-offset-0'
            : error
            ? 'border-rose-400 hover:border-rose-500'
            : 'border-slate-200 hover:border-slate-300',
        )}
      >
        <span className={cn('truncate', isPlaceholder ? 'text-slate-400' : 'text-slate-900 font-medium')}>
          {displayLabel}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="max-h-52 overflow-y-auto py-1">
            {options.map(opt => {
              const isSelected = opt.value === value;
              const isEmpty = opt.value === '';
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors',
                    isSelected
                      ? 'bg-indigo-50 text-indigo-700'
                      : isEmpty
                      ? 'text-slate-400 hover:bg-slate-50'
                      : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <span className={cn('truncate', isSelected && 'font-semibold')}>
                    {opt.label}
                  </span>
                  {isSelected && !isEmpty && (
                    <Check className="h-3 w-3 shrink-0 text-indigo-600" />
                  )}
                </button>
              );
            })}
            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">No options available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
