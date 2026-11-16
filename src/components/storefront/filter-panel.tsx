"use client";

import { useState } from "react";
import { Chip, Slider } from "@/components/ui/controls";
import { colourToHex } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type CatalogFilters, type FacetOption, type Facets, toggle } from "./catalog-state";

function Group({
  title,
  onClear,
  children,
  note,
}: {
  title: string;
  onClear?: () => void;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="grid gap-2.5">
      <div className="flex h-5 items-center justify-between">
        <h3 className="text-[13px] font-semibold leading-5">{title}</h3>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-sm text-xs font-medium text-brand-strong underline-offset-4 hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
      {children}
      {note ? <p className="text-xs leading-4 text-faint">{note}</p> : null}
    </section>
  );
}

function OptionChips<T extends string | number>({
  options,
  selected,
  onToggle,
  swatch,
  limit,
}: {
  options: FacetOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
  swatch?: (value: T) => string;
  /** Show only this many until "Show all" is pressed. */
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const overflow = limit !== undefined && options.length > limit;
  const visible =
    overflow && !expanded
      ? options.filter((option, index) => index < (limit ?? 0) || selected.includes(option.value))
      : options;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <Chip
            key={String(option.value)}
            selected={isSelected}
            disabled={option.count === 0 && !isSelected}
            onClick={() => onToggle(option.value)}
            className="h-8 px-3 text-[13px]"
          >
            {swatch ? (
              <span
                aria-hidden
                className="size-3 rounded-full ring-1 ring-black/15"
                style={{ backgroundColor: swatch(option.value) }}
              />
            ) : null}
            {option.label}
            <span className={cn("tnum text-xs font-normal", isSelected ? "opacity-70" : "text-faint")}>
              {option.count}
            </span>
          </Chip>
        );
      })}
      {overflow ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="h-8 rounded-full px-2.5 text-[13px] font-medium text-brand-strong underline-offset-4 hover:underline"
        >
          {expanded ? "Show fewer" : `Show all ${options.length}`}
        </button>
      ) : null}
    </div>
  );
}

function roundDown(value: number, step: number) {
  return Math.floor(value / step) * step;
}

function roundUp(value: number, step: number) {
  return Math.ceil(value / step) * step;
}

/** Every catalog filter. Rendered in the desktop sidebar and the mobile drawer. */
export function FilterPanel({
  filters,
  facets,
  onChange,
  className,
}: {
  filters: CatalogFilters;
  facets: Facets;
  onChange: (patch: Partial<CatalogFilters>) => void;
  className?: string;
}) {
  const step = 500;
  const bounds = facets.priceBounds
    ? ([roundDown(facets.priceBounds[0], step), roundUp(facets.priceBounds[1], step)] as const)
    : null;
  const priceValue: [number, number] | null = bounds
    ? [
        Math.min(Math.max(filters.priceMin ?? bounds[0], bounds[0]), bounds[1]),
        Math.max(Math.min(filters.priceMax ?? bounds[1], bounds[1]), bounds[0]),
      ]
    : null;
  const priceActive = filters.priceMin !== null || filters.priceMax !== null;

  return (
    <div className={cn("grid gap-6", className)}>
      {facets.statuses.length > 1 ? (
        <Group title="Availability" onClear={filters.statuses.length ? () => onChange({ statuses: [] }) : undefined}>
          <OptionChips
            options={facets.statuses}
            selected={filters.statuses}
            onToggle={(value) => onChange({ statuses: toggle(filters.statuses, value) })}
          />
        </Group>
      ) : null}

      {facets.brands.length > 1 ? (
        <Group
          title="Brand"
          onClear={filters.brands.length ? () => onChange({ brands: [], models: [] }) : undefined}
        >
          <OptionChips
            options={facets.brands}
            selected={filters.brands}
            onToggle={(value) => onChange({ brands: toggle(filters.brands, value) })}
          />
        </Group>
      ) : null}

      {facets.models.length > 1 ? (
        <Group title="Model" onClear={filters.models.length ? () => onChange({ models: [] }) : undefined}>
          <OptionChips
            options={facets.models}
            selected={filters.models}
            onToggle={(value) => onChange({ models: toggle(filters.models, value) })}
            limit={6}
          />
        </Group>
      ) : null}

      {facets.storages.length > 1 ? (
        <Group title="Storage" onClear={filters.storages.length ? () => onChange({ storages: [] }) : undefined}>
          <OptionChips
            options={facets.storages}
            selected={filters.storages}
            onToggle={(value) => onChange({ storages: toggle(filters.storages, value) })}
          />
        </Group>
      ) : null}

      {bounds && priceValue && bounds[1] > bounds[0] ? (
        <Group
          title="Price"
          onClear={priceActive ? () => onChange({ priceMin: null, priceMax: null }) : undefined}
          note={
            priceActive ? "Phones without a listed price are hidden while a price range is set." : undefined
          }
        >
          <div className="px-1 pt-1">
            <Slider
              min={bounds[0]}
              max={bounds[1]}
              step={step}
              minStepsBetweenThumbs={1}
              value={priceValue}
              thumbLabels={["Minimum price", "Maximum price"]}
              onValueChange={([min, max]) =>
                onChange({
                  priceMin: min <= bounds[0] ? null : min,
                  priceMax: max >= bounds[1] ? null : max,
                })
              }
            />
          </div>
          <div className="tnum flex items-center justify-between text-[13px] text-muted-foreground">
            <span>{formatPrice(priceValue[0])}</span>
            <span>{formatPrice(priceValue[1])}</span>
          </div>
        </Group>
      ) : null}

      {facets.hasBattery ? (
        <Group
          title="Battery health"
          onClear={filters.minBattery !== null ? () => onChange({ minBattery: null }) : undefined}
          note={
            filters.minBattery !== null
              ? "Only phones that list a battery health percentage are shown."
              : undefined
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {facets.battery.map((option) => {
              const isSelected = filters.minBattery === option.value;
              return (
                <Chip
                  key={option.value}
                  selected={isSelected}
                  disabled={option.count === 0 && !isSelected}
                  onClick={() => onChange({ minBattery: isSelected ? null : option.value })}
                  className="h-8 px-3 text-[13px]"
                >
                  {option.label}
                  <span className={cn("tnum text-xs font-normal", isSelected ? "opacity-70" : "text-faint")}>
                    {option.count}
                  </span>
                </Chip>
              );
            })}
          </div>
        </Group>
      ) : null}

      {facets.conditions.length > 1 ? (
        <Group
          title="Condition"
          onClear={filters.conditions.length ? () => onChange({ conditions: [] }) : undefined}
        >
          <OptionChips
            options={facets.conditions}
            selected={filters.conditions}
            onToggle={(value) => onChange({ conditions: toggle(filters.conditions, value) })}
          />
        </Group>
      ) : null}

      {facets.colours.length > 1 ? (
        <Group title="Colour" onClear={filters.colours.length ? () => onChange({ colours: [] }) : undefined}>
          <OptionChips
            options={facets.colours}
            selected={filters.colours}
            onToggle={(value) => onChange({ colours: toggle(filters.colours, value) })}
            swatch={(value) => colourToHex(value)}
            limit={8}
          />
        </Group>
      ) : null}
    </div>
  );
}
