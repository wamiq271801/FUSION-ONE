"use client";

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './Button';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, description, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center ">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div 
        className={cn(
          "relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl flex flex-col m-4 animate-in fade-in zoom-in-95 duration-200",
          className
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4 flex-1">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof window !== 'undefined') {
    return createPortal(content, document.body);
  }
  return null;
}

export interface ConfirmDialogProps extends Omit<ModalProps, 'children' | 'footer'> {
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({ 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onClose,
  ...props 
}: ConfirmDialogProps) {
  return (
    <Modal
      {...props}
      onClose={onClose}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>{cancelText}</Button>
          <Button 
            variant={isDestructive ? "danger" : "primary"} 
            onClick={onConfirm} 
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="py-2 text-slate-600">
        Are you sure you want to proceed? This action cannot be undone.
      </div>
    </Modal>
  );
}
