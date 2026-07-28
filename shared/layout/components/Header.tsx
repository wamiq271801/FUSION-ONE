'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, AlertCircle, Lock } from 'lucide-react';
import { useFinancialYear } from '../providers/FinancialYearProvider';
import { cn } from '@/lib/utils';

function fyLabel(startDate: string, endDate: string) {
  const s = new Date(startDate).getFullYear();
  const e = new Date(endDate).getFullYear();
  return `FY ${s}–${e}`;
}

export default function Header() {
  const { financialYears, selectedYear, setSelectedYearId, isReadOnly, isLoading } =
    useFinancialYear();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const isEndDatePassed = selectedYear && new Date() > new Date(selectedYear.end_date);
  const label = selectedYear
    ? fyLabel(selectedYear.start_date, selectedYear.end_date)
    : isLoading
    ? 'Loading…'
    : 'No FY';

  return (
    <div className="flex flex-col shrink-0 z-20 w-full">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <div />

        <div className="flex items-center gap-3">
          {/* Read-only badge */}
          {isReadOnly && (
            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-600 px-2.5 py-1 rounded-full text-xs font-semibold border border-rose-100">
              <Lock className="h-3 w-3" />
              Read Only
            </div>
          )}

          {/* FY picker */}
          <div ref={ref} className="relative">
            <button
              onClick={() => !isLoading && financialYears.length > 0 && setOpen((v) => !v)}
              disabled={isLoading || financialYears.length === 0}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all select-none',
                'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                open && 'bg-indigo-100 border-indigo-200 ring-2 ring-indigo-100',
              )}
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="tracking-wide">{label}</span>
              {financialYears.length > 1 && (
                <ChevronDown
                  className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-150', open && 'rotate-180')}
                />
              )}
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 overflow-hidden">
                {financialYears.map((fy) => {
                  const isSelected = fy.id === selectedYear?.id;
                  const closed = fy.status === 'closed';
                  return (
                    <button
                      key={fy.id}
                      onClick={() => {
                        setSelectedYearId(fy.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs font-medium transition-colors',
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <span className="font-semibold tracking-wide">
                        {fyLabel(fy.start_date, fy.end_date)}
                      </span>
                      {closed ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <Lock className="h-2.5 w-2.5" /> Closed
                        </span>
                      ) : isSelected ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                          Active
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* FY ended warning banner */}
      {!isReadOnly && isEndDatePassed && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-amber-800 text-xs w-full">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p>
            <span className="font-semibold">Financial year ended.</span>{' '}
            Close it to carry forward stock to the next year.
          </p>
        </div>
      )}
    </div>
  );
}
