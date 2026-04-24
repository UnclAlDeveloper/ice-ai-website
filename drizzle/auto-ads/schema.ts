import {pgSchema, serial, varchar, boolean, timestamp, integer, index, unique, char, date, smallint, text} from "drizzle-orm/pg-core"

export const aa = pgSchema("aa");
export const listingSource = aa.enum(
	"listing_source",
	['Autotrader', 'Car&Classic', 'eBay', 'Facebook', 'Gumtree', 'ManualEntry', 'OnlyVans']
)
export const listingTable = aa.enum("listing_table", ['Prospect', 'Resale'])
export const prospectListingStatus = aa.enum(
	"prospect_listing_status",
	['New', 'Viewed', 'Not Interested', 'Interested', 'Bought', 'Sold']
)
export const resaleListingStatus = aa.enum(
	"resale_listing_status",
	['Bought', 'Sold']
)

export const lookups = aa.table("lookups", {
	id: serial().primaryKey().notNull(),
	lookupType: varchar("lookup_type").notNull(),
	code: varchar().notNull(),
	value: varchar(),
	description: varchar(),
}, (table) => [
	unique("lookups_type_code_unique").on(table.lookupType, table.code),
	index("idx_lookups_type_code_unique").on(table.lookupType, table.code),
]);

export const images = aa.table("images", {
	id: serial().primaryKey().notNull(),
	url: varchar().notNull(),
	isPrimary: boolean("is_primary"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	listingId: integer("listing_id").notNull(),
	listingTable: listingTable("listing_table").notNull(),
});

export const prospectListings = aa.table("prospect_listings", {
	id: serial().primaryKey().notNull(),
	hashCode: char("hash_code", { length: 16 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	listingSource: listingSource("listing_source").notNull(),
	status: prospectListingStatus().notNull(),
	makeAndModel: varchar("make_and_model").notNull(),
	shortDescription: varchar("short_description").notNull(),
	url: varchar().notNull(),
	fullDescription: varchar("full_description"),
	mileage: integer(),
	mileageUnit: varchar("mileage_unit"),
	year: integer(),
	registration: varchar(),
	currencySymbol: char("currency_symbol", { length: 1 }),
	askingPrice: integer("asking_price"),
	vatStatus: varchar("vat_status"),
	location: varchar(),
	driveConfiguration: varchar("drive_configuration"),
	bodyType: varchar("body_type"),
	cabType: varchar("cab_type"),
	fuelType: varchar("fuel_type"),
	gearboxType: varchar("gearbox_type"),
	wheelbase: varchar(),
	engineSize: varchar("engine_size"),
	colour: varchar(),
	seats: integer(),
	emissionClass: varchar("emission_class"),
	numberOfOwners: integer("number_of_owners"),
	serviceHistory: varchar("service_history"),
	basicHistoryCheck: varchar("basic_history_check"),
	motStatus: varchar("mot_status"),
	motExpiry: date("mot_expiry"),
	auctionCloses: timestamp("auction_closes", { withTimezone: true, mode: 'string' }),
	aiWorkAndRepairs: varchar("ai_work_and_repairs"),
	aiRepairCost: integer("ai_repair_cost"),
	aiSellPriceLow: integer("ai_sell_price_low"),
	aiSellPriceHigh: integer("ai_sell_price_high"),
	specsAndFeatures: varchar("specs_and_features"),
	interestLevel: smallint("interest_level"),
	aiListingSummary: varchar("ai_listing_summary"),
	aiResellOverview: varchar("ai_resell_overview"),
	aiResellNotes: varchar("ai_resell_notes"),
	aiBuyPriceLow: integer("ai_buy_price_low"),
	aiBuyPriceHigh: integer("ai_buy_price_high"),
	aiCampervanConversion: varchar("ai_campervan_conversion"),
	aiValueAddImprovements: varchar("ai_value_add_improvements"),
	aiTargetMarket: varchar("ai_target_market"),
	adsEstBuyPrice: integer("ads_est_buy_price"),
	adsEstSellPrice: integer("ads_est_sell_price"),
	taxStatus: varchar("tax_status"),
	taxDueDate: date("tax_due_date"),
	co2Emissions: integer("co2_emissions"),
	markedForExport: boolean("marked_for_export"),
	dateOfLastV5CIssued: date("date_of_last_v5c_issued"),
	monthOfFirstRegistration: varchar("month_of_first_registration"),
	typeApproval: varchar("type_approval"),
	revenueWeight: integer("revenue_weight"),
}, (table) => [
	index("idx_prospect_listings_hash_code").using("btree", table.hashCode.asc().nullsLast().op("bpchar_ops")),
	unique("prospect_listings_hash_code_unique").on(table.hashCode),
]);


export const resaleListings = aa.table("resale_listings", {
	id: serial().primaryKey().notNull(),
	prospectId: integer("prospect_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	listingSource: listingSource("listing_source").notNull(),
	status: resaleListingStatus().notNull(),
	makeAndModel: varchar("make_and_model").notNull(),
	shortDescription: varchar("short_description").notNull(),
	fullDescription: varchar("full_description"),
	mileage: integer(),
	mileageUnit: varchar("mileage_unit"),
	year: integer(),
	registration: varchar(),
	currencySymbol: char("currency_symbol", { length: 1 }),
	askingPrice: integer("asking_price"),
	vatStatus: varchar("vat_status"),
	location: varchar(),
	driveConfiguration: varchar("drive_configuration"),
	bodyType: varchar("body_type"),
	cabType: varchar("cab_type"),
	fuelType: varchar("fuel_type"),
	gearboxType: varchar("gearbox_type"),
	wheelbase: varchar(),
	engineSize: varchar("engine_size"),
	colour: varchar(),
	seats: integer(),
	emissionClass: varchar("emission_class"),
	numberOfOwners: integer("number_of_owners"),
	serviceHistory: varchar("service_history"),
	basicHistoryCheck: varchar("basic_history_check"),
	motStatus: varchar("mot_status"),
	motExpiry: date("mot_expiry"),
	auctionCloses: timestamp("auction_closes", { withTimezone: true, mode: 'string' }),
	specsAndFeatures: varchar("specs_and_features"),
	taxStatus: varchar("tax_status"),
	taxDueDate: date("tax_due_date"),
	co2Emissions: integer("co2_emissions"),
	markedForExport: boolean("marked_for_export"),
	dateOfLastV5CIssued: date("date_of_last_v5c_issued"),
	monthOfFirstRegistration: varchar("month_of_first_registration"),
	typeApproval: varchar("type_approval"),
	revenueWeight: integer("revenue_weight"),
	aiSellPriceLow: integer("ai_sell_price_low"),
	aiSellPriceHigh: integer("ai_sell_price_high"),
	adsPrice: integer("ads_price"),
	ebayCategoryId: varchar("ebay_category_id"),
	ebayItemId: varchar("ebay_item_id"),
	eBayUrl: varchar().notNull(),
	facebookUrl: varchar().notNull(),
});


// SAVED SEARCHES
export const savedSearches = aa.table("saved_searches", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	query: text("query").notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
	unique("saved_searches_user_id_query_unique").on(table.userId, table.query),
	index("idx_saved_searches_user_id_last_used_at").on(table.userId, table.lastUsedAt),
]);
