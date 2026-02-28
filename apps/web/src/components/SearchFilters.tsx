"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { X, Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseMultiParam, toggleMultiParam } from "@/lib/multi-select-params";

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
}: {
  options: { value: string; label: string; count?: number }[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder: string;
  selectedLabel: string;
  ariaLabel: string;
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
        className="w-[var(--radix-popover-trigger-width)] min-w-56 max-h-72 overflow-y-auto overscroll-contain p-1"
      >
        <div role="group" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={isSelected}
                onClick={() => onToggle(option.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none motion-safe:transition-colors"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" aria-hidden="true" />}
                </span>
                <span className="truncate">{option.label}</span>
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
  const [yearInput, setYearInput] = useState(currentYear || "");
  const [prevYear, setPrevYear] = useState(currentYear);
  if (currentYear !== prevYear) {
    setPrevYear(currentYear);
    setYearInput(currentYear || "");
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
      />

      {/* Year input */}
      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder={t("yearPlaceholder")}
        value={yearInput}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, "");
          setYearInput(val);
          if (val.length === 4 || val === "") {
            pushParams({ year: val || undefined });
          }
        }}
        onBlur={() => {
          if (yearInput.length === 4) {
            pushParams({ year: yearInput });
          } else {
            setYearInput(currentYear || "");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && yearInput.length === 4) {
            pushParams({ year: yearInput });
          }
        }}
        aria-label={t("yearLabel")}
        name="year"
        autoComplete="off"
        className="w-full sm:w-24 rounded-lg border bg-card px-3 py-2.5 sm:py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:outline-none hover:border-border/80 motion-safe:transition-colors"
      />

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
