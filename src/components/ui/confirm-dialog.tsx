"use client";

import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "./button";
import { useLanguage } from "../LanguageProvider";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useLanguage();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-2xl day-box-shadow space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={
                variant === "danger"
                  ? "w-10 h-10 rounded-xl bg-red-500/12 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"
                  : "w-10 h-10 rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"
              }
            >
              {variant === "danger" ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-foreground leading-snug">
                {title || t("Confirm Action", "নিশ্চিত করুন")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {description ||
                  t(
                    "Are you sure you want to proceed with this action?",
                    "আপনি কি নিশ্চিতভাবে এটি সম্পন্ন করতে চান?"
                  )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="h-9 px-4 rounded-xl text-xs font-bold cursor-pointer"
          >
            {cancelLabel || t("Cancel", "বাতিল (Cancel)")}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={
              variant === "danger"
                ? "h-9 px-5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer"
                : "h-9 px-5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
            }
          >
            {loading
              ? t("Processing...", "অপেক্ষা করুন...")
              : confirmLabel || t("OK", "ওকে (OK)")}
          </Button>
        </div>
      </div>
    </div>
  );
}
