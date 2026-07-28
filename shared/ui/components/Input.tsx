import React from 'react';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, type, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 transition-colors shadow-sm',
            icon && 'pl-10',
            error && 'border-rose-500 focus:ring-rose-500',
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = 'Input';

export const SearchInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'icon' | 'type'>>(
  (props, ref) => <Input type="search" icon={<Search className="h-4 w-4" />} ref={ref} {...props} />
);
SearchInput.displayName = 'SearchInput';

export const NumberInput = React.forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => <Input type="number" ref={ref} {...props} />
);
NumberInput.displayName = 'NumberInput';

export const DateInput = React.forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => <Input type="date" ref={ref} {...props} />
);
DateInput.displayName = 'DateInput';
