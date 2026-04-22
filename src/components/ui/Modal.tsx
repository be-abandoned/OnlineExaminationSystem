import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  width?: string;
}

export default function Modal({ isOpen, onClose, title, children, className, footer, width = "max-w-2xl" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          "relative flex max-h-full w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl transition-all",
          width,
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 id="modal-title" className="text-lg font-semibold text-zinc-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="border-t border-zinc-100 bg-zinc-50 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
