"use client";

import {
  CircleCheck,
  CirclePause,
  ExternalLink,
  Eye,
  EyeOff,
  MoreHorizontal,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  SearchX,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { startTransition, useMemo, useOptimistic, useState } from "react";
import { toast } from "sonner";
import { BatteryBadge, StatusBadge } from "@/components/device/badges";
import { DeviceVisual } from "@/components/device/device-visual";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Hint } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AVAILABILITY_LABEL, CONDITION_LABEL } from "@/lib/catalog";
import { deviceLabel, deviceSlug, deviceSpecLine, deviceTitle } from "@/lib/device";
import { formatPrice, formatShortDate, formatStorage } from "@/lib/format";
import type { AvailabilityStatus, Device } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteDeviceAction, setAvailabilityAction, setPriceVisibilityAction } from "@/server/actions/devices";

const PAGE_SIZE = 20;

type StatusFilter = "all" | AvailabilityStatus;
type SortKey = "newest" | "oldest" | "price-desc" | "price-asc" | "model" | "battery";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "model", label: "Model: A to Z" },
  { value: "battery", label: "Battery health" },
];

type Patch =
  | { type: "status"; id: string; status: AvailabilityStatus }
  | { type: "price"; id: string; showPrice: boolean }
  | { type: "delete"; id: string };

function applyPatch(devices: Device[], patch: Patch): Device[] {
  if (patch.type === "delete") return devices.filter((device) => device.id !== patch.id);
  return devices.map((device) => {
    if (device.id !== patch.id) return device;
    return patch.type === "status"
      ? { ...device, availabilityStatus: patch.status }
      : { ...device, showPrice: patch.showPrice };
  });
}

function matchesSearch(device: Device, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const text = [
    device.brand,
    deviceTitle(device),
    formatStorage(device.storageGb),
    formatStorage(device.storageGb).replace(" ", ""),
    device.colour,
    device.inventoryReference,
    device.notes,
  ]
    .join(" ")
    .toLowerCase();
  return tokens.every((token) => text.includes(token));
}

function nullsLast(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

function sortInventory(devices: Device[], sort: SortKey): Device[] {
  const sorted = [...devices];
  sorted.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      case "price-desc":
        return nullsLast(a.price, b.price, -1) || b.createdAt.localeCompare(a.createdAt);
      case "price-asc":
        return nullsLast(a.price, b.price, 1) || b.createdAt.localeCompare(a.createdAt);
      case "model":
        return deviceTitle(a).localeCompare(deviceTitle(b), "en", { numeric: true });
      case "battery":
        return nullsLast(a.batteryHealth, b.batteryHealth, -1) || b.createdAt.localeCompare(a.createdAt);
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });
  return sorted;
}

/* ------------------------------- Row actions ------------------------------ */

interface RowActions {
  shopSlug: string;
  changeStatus: (device: Device, status: AvailabilityStatus) => void;
  togglePrice: (device: Device) => void;
  askDelete: (device: Device) => void;
}

function PrimaryAction({ device, actions, className }: { device: Device; actions: RowActions; className?: string }) {
  const sold = device.availabilityStatus === "sold";
  return (
    <Button
      variant="secondary"
      size="sm"
      className={className}
      onClick={() => actions.changeStatus(device, sold ? "available" : "sold")}
    >
      {sold ? "Mark available" : "Mark sold"}
    </Button>
  );
}

function RowMenu({ device, actions }: { device: Device; actions: RowActions }) {
  const status = device.availabilityStatus;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${deviceLabel(device)}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/inventory/${device.id}`}>
            <Pencil />
            Edit details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`/shop/${actions.shopSlug}/${deviceSlug({ ...device, id: device.shortId })}?preview=1`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink />
            View on storefront
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {status !== "available" ? (
          <DropdownMenuItem onSelect={() => actions.changeStatus(device, "available")}>
            <CircleCheck />
            Mark available
          </DropdownMenuItem>
        ) : null}
        {status !== "reserved" ? (
          <DropdownMenuItem onSelect={() => actions.changeStatus(device, "reserved")}>
            <CirclePause />
            Mark reserved
          </DropdownMenuItem>
        ) : null}
        {status !== "sold" ? (
          <DropdownMenuItem onSelect={() => actions.changeStatus(device, "sold")}>
            <Tag />
            Mark sold
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => actions.togglePrice(device)} disabled={device.price === null}>
          {device.showPrice ? <EyeOff /> : <Eye />}
          {device.showPrice ? "Hide price publicly" : "Show price publicly"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={() => actions.askDelete(device)}>
          <Trash2 />
          Delete device
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PriceCell({ device }: { device: Device }) {
  if (device.price === null) return <span className="text-[13px] text-faint">No price</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tnum font-medium">{formatPrice(device.price)}</span>
      <Hint label={device.showPrice ? "Price is shown on your storefront" : "Price is hidden from customers"}>
        <span
          tabIndex={0}
          className={cn("rounded-sm", device.showPrice ? "text-muted-foreground" : "text-faint")}
          aria-label={device.showPrice ? "Shown publicly" : "Hidden publicly"}
        >
          {device.showPrice ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </span>
      </Hint>
    </span>
  );
}

/* ---------------------------------- List ---------------------------------- */

export function InventoryList({ devices: serverDevices, shopSlug }: { devices: Device[]; shopSlug: string }) {
  const [devices, patch] = useOptimistic(serverDevices, applyPatch);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [brand, setBrand] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);

  const counts = useMemo(() => {
    const result = { all: devices.length, available: 0, reserved: 0, sold: 0 };
    for (const device of devices) result[device.availabilityStatus] += 1;
    return result;
  }, [devices]);

  const brands = useMemo(() => [...new Set(devices.map((device) => device.brand))].sort(), [devices]);

  const visible = useMemo(() => {
    const filtered = devices.filter(
      (device) =>
        (status === "all" || device.availabilityStatus === status) &&
        (brand === "all" || device.brand === brand) &&
        matchesSearch(device, query),
    );
    return sortInventory(filtered, sort);
  }, [devices, status, brand, query, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtered = status !== "all" || brand !== "all" || query.trim() !== "";

  function resetFilters() {
    setStatus("all");
    setBrand("all");
    setQuery("");
    setPage(1);
  }

  function changeStatus(device: Device, next: AvailabilityStatus, isUndo = false) {
    const previous = device.availabilityStatus;
    if (previous === next) return;
    startTransition(async () => {
      patch({ type: "status", id: device.id, status: next });
      const result = await setAvailabilityAction(device.id, next);
      if (!result.ok) {
        toast.error("Could not update the device", { description: result.error });
        return;
      }
      const label = deviceLabel(device);
      const message =
        next === "sold"
          ? "Marked as sold"
          : next === "reserved"
            ? "Marked as reserved"
            : "Marked as available";
      toast.success(message, {
        description:
          next === "sold"
            ? `${label} now shows as sold on your storefront.`
            : `${label} is ${AVAILABILITY_LABEL[next].toLowerCase()} on your storefront.`,
        action: isUndo
          ? undefined
          : { label: "Undo", onClick: () => changeStatus({ ...device, availabilityStatus: next }, previous, true) },
      });
    });
  }

  function togglePrice(device: Device) {
    const next = !device.showPrice;
    startTransition(async () => {
      patch({ type: "price", id: device.id, showPrice: next });
      const result = await setPriceVisibilityAction(device.id, next);
      if (!result.ok) {
        toast.error("Could not change price visibility", { description: result.error });
        return;
      }
      toast.success(next ? "Price is now public" : "Price hidden from customers", {
        description: next
          ? `${deviceLabel(device)} shows its price on your storefront.`
          : `${deviceLabel(device)} now shows "Price on request".`,
      });
    });
  }

  function confirmDelete() {
    const device = pendingDelete;
    if (!device) return;
    setDeleting(true);
    startTransition(async () => {
      const result = await deleteDeviceAction(device.id);
      setDeleting(false);
      setPendingDelete(null);
      if (!result.ok) {
        toast.error("Could not delete the device", { description: result.error });
        return;
      }
      patch({ type: "delete", id: device.id });
      toast.success("Device deleted", { description: `${deviceLabel(device)} was removed from your inventory.` });
    });
  }

  const actions: RowActions = { shopSlug, changeStatus, togglePrice, askDelete: setPendingDelete };

  if (devices.length === 0) {
    return (
      <EmptyState
        icon={<PackagePlus />}
        title="No devices yet"
        description="Add your first phone to bring your storefront to life. It takes about a minute."
      >
        <Button asChild>
          <Link href="/dashboard/inventory/new">
            <Plus />
            Add your first device
          </Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented
            label="Filter by status"
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All", meta: counts.all },
              { value: "available", label: "Available", meta: counts.available },
              { value: "reserved", label: "Reserved", meta: counts.reserved },
              { value: "sold", label: "Sold", meta: counts.sold },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input
              type="search"
              aria-label="Search inventory"
              placeholder="Search model, colour, reference or notes"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-md border border-border-strong/80 bg-surface pl-9 pr-9 text-base shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-faint hover:border-border-strong focus-visible:border-foreground/45 focus-visible:ring-4 focus-visible:ring-ring/15 md:h-10 md:text-sm"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {brands.length > 1 ? (
              <Select
                value={brand}
                onValueChange={(value) => {
                  setBrand(value);
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Filter by brand" className="sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All brands</SelectItem>
                  {brands.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger aria-label="Sort inventory" className={cn("sm:w-48", brands.length <= 1 && "col-span-2")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {SORTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-4"
          compact
          icon={<SearchX />}
          title="No devices match"
          description="Nothing in your inventory fits this search and these filters."
        >
          <Button variant="secondary" onClick={resetFilters}>
            Clear search and filters
          </Button>
        </EmptyState>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-4 hidden overflow-hidden rounded-xl border bg-surface shadow-xs md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-surface-2 text-left">
                  <th scope="col" className="eyebrow h-10 px-4 font-medium text-faint">
                    Device
                  </th>
                  <th scope="col" className="eyebrow hidden h-10 px-3 font-medium text-faint lg:table-cell">
                    Reference
                  </th>
                  <th scope="col" className="eyebrow hidden h-10 px-3 font-medium text-faint xl:table-cell">
                    Condition
                  </th>
                  <th scope="col" className="eyebrow h-10 px-3 font-medium text-faint">
                    Price
                  </th>
                  <th scope="col" className="eyebrow h-10 px-3 font-medium text-faint">
                    Status
                  </th>
                  <th scope="col" className="eyebrow hidden h-10 px-3 font-medium text-faint xl:table-cell">
                    Added
                  </th>
                  <th scope="col" className="h-10 px-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((device) => {
                  const sold = device.availabilityStatus === "sold";
                  return (
                    <tr key={device.id} className="group transition-colors hover:bg-surface-2/70">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/dashboard/inventory/${device.id}`}
                          className="flex min-w-0 items-center gap-3 rounded-md outline-offset-4"
                        >
                          <DeviceVisual
                            brand={device.brand}
                            model={device.model}
                            colour={device.colour}
                            imageUrl={device.images.find((image) => image.isPrimary)?.url ?? device.images[0]?.url}
                            alt=""
                            inset="p-[10%]"
                            className={cn("size-12 shrink-0 rounded-lg border", sold && "opacity-60 saturate-[0.15]")}
                          />
                          <span className="min-w-0">
                            <span className={cn("block truncate font-medium", sold && "text-muted-foreground")}>
                              {deviceTitle(device)}
                            </span>
                            <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                              <span className="truncate">{deviceSpecLine(device)}</span>
                              {device.batteryHealth !== null ? (
                                <BatteryBadge health={device.batteryHealth} className="text-foreground" />
                              ) : null}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                        {device.inventoryReference}
                      </td>
                      <td className="hidden px-3 py-2.5 text-[13px] text-muted-foreground xl:table-cell">
                        {CONDITION_LABEL[device.condition]}
                      </td>
                      <td className="px-3 py-2.5">
                        <PriceCell device={device} />
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={device.availabilityStatus} />
                      </td>
                      <td className="tnum hidden whitespace-nowrap px-3 py-2.5 text-[13px] text-muted-foreground xl:table-cell">
                        {formatShortDate(device.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <PrimaryAction device={device} actions={actions} className="w-[7.25rem]" />
                          <RowMenu device={device} actions={actions} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-4 grid gap-3 md:hidden">
            {rows.map((device) => {
              const sold = device.availabilityStatus === "sold";
              return (
                <li key={device.id} className="rounded-xl border bg-surface p-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <Link href={`/dashboard/inventory/${device.id}`} className="flex min-w-0 flex-1 items-start gap-3 rounded-md outline-offset-4">
                      <DeviceVisual
                        brand={device.brand}
                        model={device.model}
                        colour={device.colour}
                        imageUrl={device.images.find((image) => image.isPrimary)?.url ?? device.images[0]?.url}
                        alt=""
                        inset="p-[10%]"
                        className={cn("size-16 shrink-0 rounded-lg border", sold && "opacity-60 saturate-[0.15]")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-[15px] font-semibold leading-5", sold && "text-muted-foreground")}>
                          {deviceTitle(device)}
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                          {deviceSpecLine(device)}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
                          <PriceCell device={device} />
                          {device.batteryHealth !== null ? <BatteryBadge health={device.batteryHealth} /> : null}
                        </span>
                      </span>
                    </Link>
                    <StatusBadge status={device.availabilityStatus} size="sm" />
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t pt-3">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-faint">{device.inventoryReference}</span>
                    <PrimaryAction device={device} actions={actions} className="h-9 px-3.5" />
                    <RowMenu device={device} actions={actions} />
                  </div>
                </li>
              );
            })}
          </ul>

          <Pagination
            className="mt-4"
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            summary={
              filtered
                ? `${visible.length} of ${devices.length} devices`
                : `${visible.length} ${visible.length === 1 ? "device" : "devices"}`
            }
          />
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}
        title="Delete this device?"
        description={
          pendingDelete ? (
            <>
              <span className="font-medium text-foreground">{deviceLabel(pendingDelete)}</span> (
              {pendingDelete.inventoryReference}) will be removed from your inventory and your storefront, along with its
              photos. This cannot be undone. If it was sold, mark it as sold instead to keep the record.
            </>
          ) : null
        }
        confirmLabel="Delete device"
        tone="danger"
        pending={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
