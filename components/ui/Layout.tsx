import React from 'react';
import { cn } from '@/shared/utils/utils';
import { SearchInput } from './Input';
import { Button } from './Button';
import { CheckCircle2 } from 'lucide-react';

export function PageHeader({ 
  title, 
  description, 
  action,
  className 
}: { 
  title: string; 
  description?: string; 
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

export function FormSection({ 
  title, 
  description, 
  children,
  className 
}: { 
  title: string; 
  description?: string; 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-8 py-8 border-b border-slate-200 last:border-0", className)}>
      <div className="md:col-span-1">
        <h3 className="text-lg font-medium leading-6 text-slate-900">{title}</h3>
        {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="md:col-span-2 space-y-6">
        {children}
      </div>
    </div>
  );
}

export function ActionBar({ 
  children,
  className 
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 mb-6 bg-slate-50 p-4 border border-slate-200 rounded-lg", className)}>
      {children}
    </div>
  );
}

export function SuccessScreenLayout({
  title,
  description,
  billNumber,
  actions,
  children,
}: {
  title: string;
  description: string;
  billNumber?: string;
  actions: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 max-w-2xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="text-slate-500">{description}</p>
        {billNumber && (
          <p className="text-lg font-medium text-slate-900 bg-slate-100 py-2 px-4 rounded-md inline-block mt-4">
            {billNumber}
          </p>
        )}
      </div>
      {children && (
        <div className="w-full bg-white border border-slate-200 rounded-xl p-6 text-left shadow-sm">
          {children}
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 w-full">
        {actions}
      </div>
    </div>
  );
}
