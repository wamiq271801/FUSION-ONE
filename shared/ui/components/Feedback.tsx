import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, Loader2, FileX2 } from 'lucide-react';

export function InlineError({ message, className }: { message?: string, className?: string }) {
  if (!message) return null;
  return (
    <div className={cn("flex items-center gap-2 text-rose-600 text-sm mt-1", className)}>
      <AlertCircle className="h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

export function LoadingState({ message = "Loading...", className }: { message?: string, className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-slate-500 space-y-4", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

export function EmptyState({ 
  title = "No results found", 
  description = "There are no items to display at this time.", 
  icon = <FileX2 className="h-12 w-12 text-slate-300" />,
  action,
  className 
}: { 
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50", className)}>
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-sm">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
