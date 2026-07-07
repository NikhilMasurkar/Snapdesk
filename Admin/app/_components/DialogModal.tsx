"use client";

import { useEffect, useRef, useState } from "react";

type DialogModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  type: "confirm" | "prompt";
  placeholder?: string;
  defaultValue?: string;
  okLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
};

export default function DialogModal({
  isOpen,
  title,
  message,
  type,
  placeholder = "Enter reason...",
  defaultValue = "",
  okLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}: DialogModalProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus input on mount/open
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputValue(defaultValue);
      // Give a tiny timeout for transition to complete before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, defaultValue]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === "prompt" && !inputValue.trim()) {
      return; // prevent empty prompt confirmations
    }
    onConfirm(type === "prompt" ? inputValue : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-300">
      {/* Click outside to cancel */}
      <div className="absolute inset-0" onClick={onCancel} />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all duration-300 transform scale-100 max-h-[90vh] overflow-y-auto z-10">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                isDestructive
                  ? "bg-danger-bg border-danger/20 text-danger"
                  : "bg-primary/10 border-primary/20 text-primary"
              }`}
            >
              {isDestructive ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="size-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-foreground truncate">
                {title}
              </h3>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          {/* Form field for prompt */}
          {type === "prompt" && (
            <div className="mb-5">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={placeholder}
                rows={3}
                required
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground placeholder:text-muted/50 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              />
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-border bg-card hover:bg-muted-bg px-4 py-2.5 text-xs font-bold text-foreground transition-all cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={type === "prompt" && !inputValue.trim()}
              className={`rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
                isDestructive
                  ? "bg-danger hover:bg-danger/90 hover:shadow-danger/20"
                  : "bg-primary hover:bg-primary-hover hover:shadow-primary/20"
              }`}
            >
              {okLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
