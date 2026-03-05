"use client";

import React, {useState, useCallback} from "react";
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {getProspectListing, getManualEntryListings} from "./actions";
import type {ProspectListingData} from "./actions";
import ProspectListingEditor from "../components/ProspectListingEditor";

// NEW LISTING DEFAULTS
const NEW_LISTING_DEFAULTS: ProspectListingData = {
    status: "Bought",
    makeAndModel: "",
    shortDescription: "",
    fullDescription: null,
    mileage: null,
    mileageUnit: "miles",
    year: null,
    registration: null,
    currencySymbol: "£",
    askingPrice: null,
    vatStatus: "No VAT",
    location: null,
    bodyType: null,
    cabType: null,
    fuelType: null,
    gearboxType: null,
    wheelbase: null,
    engineSize: null,
    colour: null,
    seats: null,
    emissionClass: null,
    numberOfOwners: null,
    serviceHistory: null,
    basicHistoryCheck: null,
    motStatus: null,
    motExpiry: null,
    specsAndFeatures: null,
};
/** Default field values applied when creating a brand-new manual entry listing. */

// MANUAL ENTRY CLIENT PROPS
interface ManualEntryClientProps {
    existingListings: {id: number; makeAndModel: string; shortDescription: string}[];
    lookupMap: Record<string, string[]>;
}
/** Props received from the server component: existing listing summaries and lookup values. */

// MANUAL ENTRY CLIENT
export default function ManualEntryClient({existingListings, lookupMap}: ManualEntryClientProps) {
    /**
     * Client shell for the Manual Entry page. Provides a dropdown to select an
     * existing manual-entry listing for editing, a "+" button to start a new
     * listing, and hosts the ProspectListingEditor form.
     */

    const [listings, setListings] = useState(existingListings);
    const [selectedId, setSelectedId] = useState<number | "">("");
    const [editorData, setEditorData] = useState<ProspectListingData | null>(null);

    // HANDLE SELECT LISTING
    const handleSelectListing = useCallback(async (id: number) => {
        /**
         * Loads the selected listing's full data into the editor form.
         */

        setSelectedId(id);
        const result = await getProspectListing(id);
        if (result.success && result.listing) {
            setEditorData(result.listing);
        } else {
            console.error("Failed to load listing:", result.error);
        }
    }, []);

    // HANDLE NEW LISTING
    const handleNewListing = useCallback(() => {
        /**
         * Resets the editor to a blank form with default values for a new listing.
         */

        setSelectedId("");
        setEditorData({...NEW_LISTING_DEFAULTS});
    }, []);

    // HANDLE SAVED
    const handleSaved = useCallback(async (data: ProspectListingData) => {
        /**
         * Called by the editor after a successful save. Refreshes the listings
         * dropdown and switches to the newly created record when applicable.
         */

        // refresh the listings dropdown
        const refreshed = await getManualEntryListings();
        if (refreshed.success && refreshed.listings) {
            setListings(refreshed.listings);
        }

        if (data.id) {
            setSelectedId(data.id);
            setEditorData(data);
        }
    }, []);

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 3,
                }}
            >
                <FormControl size="small" sx={{minWidth: 280, flexGrow: {xs: 1, sm: 0}}}>
                    <InputLabel id="listing-selector-label">Select Listing</InputLabel>
                    <Select
                        labelId="listing-selector-label"
                        value={selectedId}
                        label="Select Listing"
                        onChange={(e) => {
                            const val = e.target.value;
                            if (typeof val === "number") {
                                handleSelectListing(val);
                            }
                        }}
                    >
                        {listings.map((listing) => (
                            <MenuItem key={listing.id} value={listing.id}>
                                {listing.makeAndModel} - {listing.shortDescription}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Tooltip title="New listing">
                    <IconButton
                        color="primary"
                        onClick={handleNewListing}
                        sx={{
                            border: 1,
                            borderColor: "primary.main",
                        }}
                    >
                        <AddIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {editorData && (
                <ProspectListingEditor
                    data={editorData}
                    lookupMap={lookupMap}
                    onSaved={handleSaved}
                />
            )}
        </Box>
    );
}
