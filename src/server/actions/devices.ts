"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { deviceFormSchema } from "@/lib/schemas";
import type { ActionResult, AvailabilityStatus, DeviceInput } from "@/lib/types";
import { getBackend } from "@/server/backend";
import { requireBusiness } from "@/server/session";
import { parse, run } from "./run";

/* ---------------------------------------------------------------------------
   Inventory mutations.
   Every action resolves the business from the signed-in session. The only
   identifier a client supplies is a device id, and the backend only resolves
   it inside that business, so another retailer's device is simply not found.
--------------------------------------------------------------------------- */

const idSchema = z.string().min(1).max(64);
const statusSchema = z.enum(["available", "reserved", "sold"]);

interface DeviceSummary {
  id: string;
  shortId: string;
  reference: string;
  availabilityStatus: AvailabilityStatus;
  showPrice: boolean;
}

export async function createDeviceAction(
  values: unknown,
): Promise<ActionResult<DeviceSummary & { nextReference: string }>> {
  return run(async () => {
    const { user, business } = await requireBusiness();
    const input: DeviceInput = parse(deviceFormSchema, values);
    const backend = await getBackend();
    const device = await backend.createDevice(user.id, business.id, input);
    const nextReference = await backend.suggestReference(user.id, business.id);
    refresh();
    return {
      id: device.id,
      shortId: device.shortId,
      reference: device.inventoryReference,
      availabilityStatus: device.availabilityStatus,
      showPrice: device.showPrice,
      nextReference,
    };
  });
}

export async function updateDeviceAction(deviceId: string, values: unknown): Promise<ActionResult<DeviceSummary>> {
  return run(async () => {
    const { user, business } = await requireBusiness();
    const id = parse(idSchema, deviceId);
    const input: DeviceInput = parse(deviceFormSchema, values);
    const backend = await getBackend();
    const device = await backend.updateDevice(user.id, business.id, id, input);
    refresh();
    return {
      id: device.id,
      shortId: device.shortId,
      reference: device.inventoryReference,
      availabilityStatus: device.availabilityStatus,
      showPrice: device.showPrice,
    };
  });
}

/** One-tap status change from the inventory list. */
export async function setAvailabilityAction(
  deviceId: string,
  status: AvailabilityStatus,
): Promise<ActionResult<DeviceSummary>> {
  return run(async () => {
    const { user, business } = await requireBusiness();
    const id = parse(idSchema, deviceId);
    const next = parse(statusSchema, status);
    const backend = await getBackend();
    const device = await backend.setAvailability(user.id, business.id, id, next);
    refresh();
    return {
      id: device.id,
      shortId: device.shortId,
      reference: device.inventoryReference,
      availabilityStatus: device.availabilityStatus,
      showPrice: device.showPrice,
    };
  });
}

export async function setPriceVisibilityAction(
  deviceId: string,
  showPrice: boolean,
): Promise<ActionResult<DeviceSummary>> {
  return run(async () => {
    const { user, business } = await requireBusiness();
    const id = parse(idSchema, deviceId);
    const show = parse(z.boolean(), showPrice);
    const backend = await getBackend();
    const device = await backend.setPriceVisibility(user.id, business.id, id, show);
    refresh();
    return {
      id: device.id,
      shortId: device.shortId,
      reference: device.inventoryReference,
      availabilityStatus: device.availabilityStatus,
      showPrice: device.showPrice,
    };
  });
}

export async function deleteDeviceAction(deviceId: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const { user, business } = await requireBusiness();
    const id = parse(idSchema, deviceId);
    const backend = await getBackend();
    await backend.deleteDevice(user.id, business.id, id);
    refresh();
    return { id };
  });
}
