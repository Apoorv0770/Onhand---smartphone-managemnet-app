import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InventoryList } from "@/components/dashboard/inventory-list";
import { PageHeader } from "@/components/dashboard/page-header";
import { InventorySkeleton } from "@/components/dashboard/skeletons";
import { Button } from "@/components/ui/button";
import { getBackend } from "@/server/backend";
import { requireBusiness } from "@/server/session";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Every phone is its own record. Mark one sold and your storefront updates straight away."
      >
        {/* The top bar already carries this action on wide screens. */}
        <Button asChild className="lg:hidden">
          <Link href="/dashboard/inventory/new">
            <Plus />
            Add device
          </Link>
        </Button>
      </PageHeader>
      <Suspense fallback={<InventorySkeleton />}>
        <Inventory />
      </Suspense>
    </>
  );
}

async function Inventory() {
  const { user, business } = await requireBusiness();
  const backend = await getBackend();
  const devices = await backend.listDevices(user.id, business.id);
  return <InventoryList devices={devices} shopSlug={business.slug} />;
}
