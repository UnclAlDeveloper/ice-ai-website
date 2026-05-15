import eBayApi from "ebay-api";
import {drizzle} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {and, eq, sql} from "drizzle-orm";
import * as schema from "../drizzle/auto-ads/schema";
import {getEbayApiClient} from "../app/auto-ads/lib/ebayClient";
import {loadEnv} from "./loadEnv";

// hydrate process.env from the shared .env plus the per-environment override
loadEnv();

const {lookups} = schema;

// LOOKUP TYPE
const LOOKUP_TYPE = "ebay_categories";
/** lookup_type value used for eBay taxonomy rows in aa.lookups. */

// VEHICLE EXTRA TAG
const VEHICLE_EXTRA_TAG = "vehicle";
/** Token written to lookups.extra so the publish path can detect vehicle categories. */

// VEHICLE ROOT NAME
const VEHICLE_ROOT_NAME = "cars, motorcycles & vehicles";
/**
 * Lower-cased name of the top-level eBay UK taxonomy node that contains all
 * vehicle categories. Any leaf with this node in its ancestry is flagged as
 * a vehicle category.
 */

// CATEGORY TREE NODE
type CategoryTreeNode = {
    category?: {categoryId?: string; categoryName?: string};
    childCategoryTreeNodes?: CategoryTreeNode[];
    leafCategoryTreeNode?: boolean;
};
/**
 * Minimal shape we consume from the eBay Taxonomy `getCategoryTree` response.
 * The eBay schema contains many more fields but we only need the recursive
 * structure plus each node's id/name.
 */

// LEAF
type Leaf = {
    code: string;
    value: string;
    description: string;
    extra: string | null;
};
/**
 * Materialised leaf row ready to be upserted into aa.lookups. `code` is the
 * eBay categoryId, `value` is the leaf's own name, `description` is the full
 * `>`-joined ancestor path and `extra` carries routing flags.
 */

// COLLECT LEAVES
function collectLeaves(
    node: CategoryTreeNode | undefined,
    ancestorNames: string[],
    leaves: Leaf[],
): void {
    /**
     * Walks the eBay category tree depth-first and appends one Leaf entry
     * for every node whose `leafCategoryTreeNode` flag is true. The leaf's
     * description is the full ancestor path (excluding the synthetic root
     * "Root" node that eBay returns) joined by " > ". Vehicle categories are
     * detected by checking whether any ancestor's name (case-insensitive)
     * matches the well-known top-level vehicle bucket.
     */

    if (!node) return;

    const name = node.category?.categoryName?.trim() ?? "";
    const id = node.category?.categoryId?.trim() ?? "";

    // build the path including this node; the root node has an empty name
    // and id so we skip it from the path while still recursing into its
    // children
    const nextAncestors = name ? [...ancestorNames, name] : ancestorNames;

    if (node.leafCategoryTreeNode === true && id) {
        // a leaf whose any ancestor (including itself) is the vehicle root
        // gets the vehicle routing tag; otherwise extra stays null
        const isVehicle = nextAncestors.some(
            (a) => a.toLowerCase() === VEHICLE_ROOT_NAME,
        );
        leaves.push({
            code: id,
            value: name,
            description: nextAncestors.join(" > "),
            extra: isVehicle ? VEHICLE_EXTRA_TAG : null,
        });
        return;
    }

    for (const child of node.childCategoryTreeNodes ?? []) {
        collectLeaves(child, nextAncestors, leaves);
    }
}

// FETCH CATEGORY TREE
async function fetchCategoryTree(): Promise<CategoryTreeNode> {
    /**
     * Calls the eBay Taxonomy API to resolve the default category tree id
     * for the configured marketplace (defaulting to EBAY_GB) and then
     * downloads the full tree. Returns the rootCategoryNode.
     */

    const ebay = await getEbayApiClient();
    const marketplaceId =
        process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() || eBayApi.MarketplaceId.EBAY_GB;

    // resolve the marketplace's default tree id (a small json document)
    const treeIdResp = await ebay.commerce.taxonomy.getDefaultCategoryTreeId(marketplaceId);
    const treeId = (treeIdResp as {categoryTreeId?: string}).categoryTreeId;
    if (!treeId) {
        throw new Error("eBay getDefaultCategoryTreeId did not return a categoryTreeId.");
    }
    console.log(`Resolved eBay category tree id ${treeId} for marketplace ${marketplaceId}.`);

    // download the full tree (multi-megabyte payload for major marketplaces)
    const tree = await ebay.commerce.taxonomy.getCategoryTree(treeId);
    const root = (tree as {rootCategoryNode?: CategoryTreeNode}).rootCategoryNode;
    if (!root) {
        throw new Error("eBay getCategoryTree did not return a rootCategoryNode.");
    }
    return root;
}

// MAIN
async function main(): Promise<void> {
    /**
     * Downloads the entire eBay UK category tree and upserts every leaf
     * category into aa.lookups under lookup_type='ebay_categories'. The
     * leaf's full path is stored in `description` and a routing tag of
     * 'vehicle' is written to `extra` for everything beneath the
     * "Cars, Motorcycles & Vehicles" root. Re-running the script is safe
     * because the upsert is keyed on (lookup_type, code).
     */

    const connectionString = process.env.AUTO_ADS_DATABASE_URL;
    if (!connectionString) {
        console.error("AUTO_ADS_DATABASE_URL is not set");
        process.exit(1);
    }

    // fetch the full category tree before opening the db connection so we
    // do not hold the connection open during the (potentially slow) http call
    const root = await fetchCategoryTree();

    // walk the tree and materialise the leaf rows we want to persist
    const leaves: Leaf[] = [];
    collectLeaves(root, [], leaves);
    console.log(`Collected ${leaves.length} leaf categories from the eBay taxonomy.`);

    const client = postgres(connectionString, {ssl: "require"});
    const db = drizzle(client, {schema});

    try {
        // back-fill any pre-existing rows that used the legacy convention
        // (description='vehicle' as a routing tag) so we move the marker
        // over to extra before overwriting description with the new path
        const legacyResult = await db
            .update(lookups)
            .set({extra: VEHICLE_EXTRA_TAG})
            .where(and(
                eq(lookups.lookupType, LOOKUP_TYPE),
                eq(lookups.description, VEHICLE_EXTRA_TAG),
            ))
            .returning({id: lookups.id});
        if (legacyResult.length > 0) {
            console.log(
                `Migrated ${legacyResult.length} legacy lookup rows: description='vehicle' -> extra='vehicle'.`,
            );
        }

        // snapshot the existing eBay category codes so we can report how
        // many leaves we inserted vs updated without paying for a per-row
        // select roundtrip during the upsert loop
        const existingRows = await db
            .select({code: lookups.code})
            .from(lookups)
            .where(eq(lookups.lookupType, LOOKUP_TYPE));
        const existingCodes = new Set(existingRows.map((r) => r.code));

        // batch the upserts so we only pay one round-trip per chunk instead
        // of one per leaf; 500 rows per insert keeps the parameter count
        // safely under postgres' 65k bind limit (5 columns * 500 = 2500)
        const BATCH_SIZE = 500;
        let processed = 0;
        for (let i = 0; i < leaves.length; i += BATCH_SIZE) {
            const batch = leaves.slice(i, i + BATCH_SIZE);
            await db
                .insert(lookups)
                .values(
                    batch.map((leaf) => ({
                        lookupType: LOOKUP_TYPE,
                        code: leaf.code,
                        value: leaf.value,
                        description: leaf.description,
                        extra: leaf.extra,
                    })),
                )
                .onConflictDoUpdate({
                    target: [lookups.lookupType, lookups.code],
                    set: {
                        value: sql.raw("excluded.value"),
                        description: sql.raw("excluded.description"),
                        extra: sql.raw("excluded.extra"),
                    },
                });

            processed += batch.length;
            console.log(`  upserted ${processed}/${leaves.length}…`);
        }

        const inserted = leaves.filter((l) => !existingCodes.has(l.code)).length;
        const updated = leaves.length - inserted;
        console.log(`Done. Inserted ${inserted}, updated ${updated}, total ${leaves.length}.`);
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
});
