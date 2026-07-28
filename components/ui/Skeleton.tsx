import React from 'react';
import { cn } from '@/shared/utils/utils';

/**
 * A single animated skeleton bar. Use directly or compose into
 * page-specific skeleton layouts.
 */
export function Sk({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded bg-slate-100', className)}
      {...props}
    />
  );
}
