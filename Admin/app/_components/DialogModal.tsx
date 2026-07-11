"use client";

import { memo, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

function DialogModal({
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) setInputValue(defaultValue);
  }, [isOpen, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === "prompt" && !inputValue.trim()) return;
    onConfirm(type === "prompt" ? inputValue : undefined);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                  isDestructive
                    ? "bg-danger-bg border-danger/20 text-danger"
                    : "bg-primary/10 border-primary/20 text-primary"
                }`}
              >
                {isDestructive ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <DialogTitle className="text-base font-bold truncate">{title}</DialogTitle>
                <DialogDescription className="mt-1 text-xs leading-relaxed">
                  {message}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {type === "prompt" && (
            <Textarea
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              rows={3}
              required
              className="mt-4 resize-none text-xs font-semibold"
            />
          )}

          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={isDestructive ? "destructive" : "default"}
              disabled={type === "prompt" && !inputValue.trim()}
            >
              {okLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default memo(DialogModal);
