"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { X, Check, ChevronDown, Circle } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseMultiParam, toggleMultiParam } from "@/lib/multi-select-params";
import { isYearPreset, isCustomRange } from "@/lib/year-filter";

interface SearchFiltersProps {
  regulationTypes: { id?: number; code: string; name_id: string }[];
  typeCounts?: Record<string, number>;
  currentType?: string;
  currentYear?: string;
  currentStatus?: string;
  currentQuery?: string;
}

function CheckboxPopover({
  options,
  selected,
  onToggle,
  placeholder,
  selectedLabel,
  ariaLabel,
  popoverClassName,
}: {
  options: { value: string; label: string; count?: number }[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder: string;
  selectedLabel: string;
  ariaLabel: string;
  popoverClassName?: string;
}) {
  const displayLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : selectedLabel;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${ariaLabel}: ${displayLabel}`}
          className={cn(
            "inline-flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 sm:py-2 text-sm text-left w-full sm:flex-1",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:outline-none hover:border-border/80 motion-safe:transition-colors",
            selected.length > 0 && "border-primary/40",
          )}
        >
          <span aria-hidden="true" className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
            {displayLabel}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-[var(--radix-popover-trigger-width)] min-w-56 max-h-[min(18rem,60vh)] overflow-y-auto overscroll-contain p-1", popoverClassName)}
      >
        <div role="group" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                onClick={() => onToggle(option.value)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2.5 sm:py-1.5 text-sm text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none motion-safe:transition-colors"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" aria-hidden="true" />}
                </span>
                <span className="min-w-0 break-words">{option.label}</span>
                {option.count != null && option.count > 0 && (
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                    {option.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function SearchFilters({
  regulationTypes,
  typeCounts,
  currentType,
  currentYear,
  currentStatus,
  currentQuery,
}: SearchFiltersProps) {
  const t = useTranslations("filters");
  const router = useRouter();
  const isPreset = isYearPreset(currentYear);
  const isRange = isCustomRange(currentYear);
  const isExactYear = !isPreset && !isRange && !!currentYear && /^\d{4}$/.test(currentYear);
  const rangeYear = isRange ? currentYear!.replace("from:", "") : "";

  type YearMode = "none" | "exact" | "range";
  const initialMode: YearMode = isExactYear ? "exact" : isRange ? "range" : "none";
  const [customMode, setCustomMode] = useState<YearMode>(initialMode);
  const [yearInput, setYearInput] = useState(isExactYear ? currentYear! : rangeYear);
  const [yearPopoverOpen, setYearPopoverOpen] = useState(false);
  const [prevYear, setPrevYear] = useState(currentYear);
  if (currentYear !== prevYear) {
    setPrevYear(currentYear);
    setCustomMode(isExactYear ? "exact" : isRange ? "range" : "none");
    setYearInput(isExactYear ? currentYear! : rangeYear);
    setYearPopoverOpen(false);
  }

  const hasFilters = currentType || currentYear || currentStatus;

  function pushParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (currentQuery) params.set("q", currentQuery);

    const merged = {
      type: currentType,
      year: currentYear,
      status: currentStatus,
      ...updates,
    };

    for (const [key, val] of Object.entries(merged)) {
      if (val) params.set(key, val);
    }

    // Reset to page 1 on filter change
    params.delete("page");

    router.push(`/search?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams();
    if (currentQuery) params.set("q", currentQuery);
    router.push(`/search?${params.toString()}`);
  }

  const typeOptions = (() => {
    const base = regulationTypes.map((rt) => ({
      value: rt.code,
      label: `${rt.code} — ${rt.name_id}`,
      count: typeCounts?.[rt.code] as number | undefined,
    }));

    if (!typeCounts) return base;

    const withCount = base.filter((o) => o.count && o.count > 0);
    const withoutCount = base.filter((o) => !o.count || o.count === 0);

    withCount.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    withoutCount.sort((a, b) => a.value.localeCompare(b.value));

    return [...withCount, ...withoutCount];
  })();

  const statusOptions = [
    { value: "berlaku", label: t("statusActive") },
    { value: "diubah", label: t("statusAmended") },
    { value: "dicabut", label: t("statusRevoked") },
    { value: "tidak_berlaku", label: t("statusNotInForce") },
  ];

  const selectedTypes = parseMultiParam(currentType);
  const selectedStatuses = parseMultiParam(currentStatus);

  const yearInputRef = useRef<HTMLInputElement>(null);
  const autoFocusDesktop = useCallback((el: HTMLInputElement | null) => {
    yearInputRef.current = el;
    if (el && window.matchMedia("(pointer: fine)").matches) el.focus();
  }, []);

  // Scroll year input into view when it appears (fixes mobile popover clipping)
  useEffect(() => {
    if (customMode !== "none") {
      requestAnimationFrame(() => {
        yearInputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
  }, [customMode]);

  const yearLabel = !currentYear
    ? t("allYears")
    : currentYear === "5y"
      ? t("last5Years")
      : currentYear === "10y"
        ? t("last10Years")
        : currentYear === "20y"
          ? t("last20Years")
          : isRange
            ? t("sinceYearDisplay", { year: rangeYear })
            : currentYear;

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
      {/* Type multi-select */}
      <CheckboxPopover
        options={typeOptions}
        selected={selectedTypes}
        onToggle={(code) =>
          pushParams({ type: toggleMultiParam(selectedTypes, code) })
        }
        placeholder={t("allTypes")}
        selectedLabel={t("typesSelected", { count: selectedTypes.length })}
        ariaLabel={t("typeLabel")}
        popoverClassName="sm:min-w-80"
      />

      {/* Year filter */}
      <Popover open={yearPopoverOpen} onOpenChange={setYearPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${t("yearLabel")}: ${yearLabel}`}
            className={cn(
              "inline-flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 sm:py-2 text-sm text-left w-full sm:flex-1",
              "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:outline-none hover:border-border/80 motion-safe:transition-colors",
              currentYear && "border-primary/40",
            )}
          >
            <span aria-hidden="true" className={cn("truncate", !currentYear && "text-muted-foreground")}>
              {yearLabel}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-56 max-h-[min(18rem,60vh)] overflow-y-auto p-1"
        >
          <div role="radiogroup" aria-label={t("yearLabel")}>
            {([
              { value: "", label: t("allYears") },
              { value: "5y", label: t("last5Years") },
              { value: "10y", label: t("last10Years") },
              { value: "20y", label: t("last20Years") },
              { value: "__since__", label: t("sinceYear") },
              { value: "__custom__", label: t("specificYear") },
            ] as const).map((option) => {
              const isSinceOption = option.value === "__since__";
              const isCustomOption = option.value === "__custom__";
              const isSelected = isSinceOption
                ? customMode === "range"
                : isCustomOption
                  ? customMode === "exact"
                  : option.value === ""
                    ? !currentYear && customMode === "none"
                    : currentYear === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    if (isSinceOption) {
                      setCustomMode("range");
                      setYearInput("");
                    } else if (isCustomOption) {
                      setCustomMode("exact");
                      setYearInput("");
                    } else {
                      setCustomMode("none");
                      setYearInput("");
                      pushParams({ year: option.value || undefined });
                      setYearPopoverOpen(false);
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2.5 sm:py-1.5 text-sm text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none motion-safe:transition-colors"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-primary"
                        : "border-border",
                    )}
                  >
                    {isSelected && <Circle className="h-2 w-2 fill-primary text-primary" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 break-words">{option.label}</span>
                </button>
              );
            })}
            {customMode !== "none" && (
              <div className="px-2 py-2.5 sm:py-1.5 flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  ref={autoFocusDesktop}
                  placeholder={t("yearPlaceholder")}
                  value={yearInput}
                  onChange={(e) => {
                    setYearInput(e.target.value.replace(/\D/g, ""));
                  }}
                  aria-label={t("yearPlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && yearInput.length === 4 && parseInt(yearInput) >= 1945 && parseInt(yearInput) <= new Date().getFullYear()) {
                      pushParams({
                        year: customMode === "range" ? `from:${yearInput}` : yearInput,
                      });
                      setYearPopoverOpen(false);
                    }
                  }}
                  name="year"
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-lg border bg-background px-2.5 py-1.5 text-base sm:text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={yearInput.length !== 4 || parseInt(yearInput) < 1945 || parseInt(yearInput) > new Date().getFullYear()}
                  onClick={() => {
                    pushParams({
                      year: customMode === "range" ? `from:${yearInput}` : yearInput,
                    });
                    setYearPopoverOpen(false);
                  }}
                  className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus:outline-none"
                >
                  {t("applyYear")}
                </button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Status multi-select */}
      <CheckboxPopover
        options={statusOptions}
        selected={selectedStatuses}
        onToggle={(status) =>
          pushParams({ status: toggleMultiParam(selectedStatuses, status) })
        }
        placeholder={t("allStatus")}
        selectedLabel={t("statusesSelected", { count: selectedStatuses.length })}
        ariaLabel={t("statusLabel")}
      />

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-2.5 sm:py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:outline-none motion-safe:transition-colors"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {t("clearFilters")}
        </button>
      )}
    </div>
  );
}
