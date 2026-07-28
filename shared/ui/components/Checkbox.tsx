import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        <input
          type="checkbox"
          className={cn(
            'peer h-4 w-4 shrink-0 appearance-none rounded-[4px] border border-slate-300 bg-white checked:bg-indigo-600 checked:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:border-slate-200 transition-colors',
            className
          )}
          ref={ref}
          {...props}
        />
        <Check className="absolute left-0.5 top-0.5 h-3 w-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';
