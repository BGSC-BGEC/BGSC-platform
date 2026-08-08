import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  width?: '400px' | '560px' | '720px';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  width = '560px',
  children,
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClass =
    width === '720px' ? 'max-w-[720px]' : width === '400px' ? 'max-w-[400px]' : 'max-w-[560px]';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop Scrim */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className={`w-screen ${widthClass} bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-250`}
        >
          {/* Drawer Header */}
          <div className="h-16 px-6 border-b border-slate-700/80 bg-slate-800/80 flex items-center justify-between shrink-0">
            <div className="min-w-0 flex-1 pr-4">
              <div className="text-base font-semibold text-slate-100 truncate">{title}</div>
              {subtitle && <div className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</div>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">{children}</div>

          {/* Drawer Footer */}
          {footer && (
            <div className="p-4 px-6 border-t border-slate-700/80 bg-slate-800/90 flex items-center justify-end gap-3 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
