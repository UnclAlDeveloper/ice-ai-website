import type {resaleListing} from "@app/auto-ads/resales/actions";
import type {saleItems} from "@/drizzle/auto-ads/schema";

// VEHICLE PUBLISH ASPECTS
export type VehiclePublishAspects = {
    year?: number | null;
    mileage?: number | null;
    fuelType?: string | null;
    gearboxType?: string | null;
    colour?: string | null;
    bodyType?: string | null;
    engineSize?: string | null;
    seats?: number | null;
    numberOfOwners?: number | null;
    registration?: string | null;
    motExpiry?: string | null;
    motStatus?: string | null;
    emissionClass?: string | null;
};
/**
 * Optional vehicle-specific fields used to populate eBay item specifics and
 * Facebook description bullets. When this property is undefined on a
 * PublishableListing the helpers skip every vehicle-only block, which is
 * how non-vehicle (sale item) publishing ends up with no aspects.
 */

// PUBLISHABLE LISTING
export type PublishableListing = {
    id: number;
    listingTable: 'Resale' | 'SaleItem';
    title: string;
    body: string | null;
    specsAndFeatures: string | null;
    askingPrice: number | null;
    currencySymbol: string | null;
    location: string | null;
    ebayCategoryId: string | null;
    ebayItemId: string | null;
    eBayUrl: string | null;
    facebookUrl: string | null;
    vehicle?: VehiclePublishAspects;
};
/**
 * Common publish-time view of a resale listing or a sale item so the eBay
 * and Facebook helpers can be source-agnostic. `title` is what we show as
 * the listing headline (resale.shortDescription or saleItem.title) and
 * `body` is the longer-form description. `vehicle` is set only for resales
 * so the helpers can branch on the routing path with a single property
 * check instead of caring about which table the row came from.
 */

// LISTING SKU
export function listingSku(listing: PublishableListing): string {
    /**
     * Stable SKU used across eBay inventory item, offer, and listing calls.
     * Includes the listing table prefix so resales and sale items live in
     * separate SKU namespaces and cannot collide on numeric id alone.
     */

    const prefix = listing.listingTable === 'Resale' ? 'resale' : 'sale-item';
    return `${prefix}-${listing.id}`;
}

// SALE ITEM ROW
type SaleItemRow = typeof saleItems.$inferSelect;
/**
 * Local alias for the inferred select row shape of aa.sale_items, used by
 * the saleItemToPublishable adapter without re-exporting it from the
 * sale-items actions module to avoid a server-component circular import.
 */

// RESALE TO PUBLISHABLE
export function resaleToPublishable(listing: resaleListing): PublishableListing {
    /**
     * Adapts a resale listing into the shared PublishableListing shape used
     * by the eBay and Facebook helpers. The `vehicle` property is always
     * present so the helpers emit eBay item specifics and Facebook bullets
     * for every resale, even when individual sub-fields are null.
     */

    return {
        id: listing.id,
        listingTable: 'Resale',
        title: listing.shortDescription,
        body: listing.fullDescription,
        specsAndFeatures: listing.specsAndFeatures,
        askingPrice: listing.askingPrice,
        currencySymbol: listing.currencySymbol,
        location: listing.location,
        ebayCategoryId: listing.ebayCategoryId,
        ebayItemId: listing.ebayItemId,
        eBayUrl: listing.eBayUrl,
        facebookUrl: listing.facebookUrl,
        vehicle: {
            year: listing.year,
            mileage: listing.mileage,
            fuelType: listing.fuelType,
            gearboxType: listing.gearboxType,
            colour: listing.colour,
            bodyType: listing.bodyType,
            engineSize: listing.engineSize,
            seats: listing.seats,
            numberOfOwners: listing.numberOfOwners,
            registration: listing.registration,
            motExpiry: listing.motExpiry,
            motStatus: listing.motStatus,
            emissionClass: listing.emissionClass,
        },
    };
}

// SALE ITEM TO PUBLISHABLE
export function saleItemToPublishable(item: SaleItemRow): PublishableListing {
    /**
     * Adapts a sale item row into the shared PublishableListing shape. The
     * `vehicle` property is intentionally omitted so eBay aspects and the
     * vehicle-only Facebook lines are skipped for generic items.
     */

    return {
        id: item.id,
        listingTable: 'SaleItem',
        title: item.title,
        body: item.description,
        specsAndFeatures: null,
        askingPrice: item.askingPrice,
        currencySymbol: item.currencySymbol,
        location: item.location,
        ebayCategoryId: item.ebayCategoryId,
        ebayItemId: item.ebayItemId,
        eBayUrl: item.eBayUrl,
        facebookUrl: item.facebookUrl,
    };
}
