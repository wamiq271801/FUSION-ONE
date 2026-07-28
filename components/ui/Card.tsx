import React from 'react';
import { cn } from '@/shared/utils/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm", className)} {...props} />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-slate-500", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

// Specialized Cards
export function SummaryTile({ title, value, icon, className, trend }: { title: string, value: string | React.ReactNode, icon?: React.ReactNode, className?: string, trend?: { label: string, positive: boolean } }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
            {trend && (
              <p className={cn("text-xs font-medium", trend.positive ? "text-emerald-600" : "text-rose-600")}>
                {trend.positive ? "+" : "-"}{trend.label}
              </p>
            )}
          </div>
          {icon && (
            <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              {icon}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ReadOnlyDetail({ label, value, className }: { label: string, value: string | React.ReactNode, className?: string }) {
  return (
    <div className={cn("flex flex-col space-y-1 py-3 border-b border-slate-100 last:border-0", className)}>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-slate-900 font-medium">{value || '-'}</span>
    </div>
  );
}
