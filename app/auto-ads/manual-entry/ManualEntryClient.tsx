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
    Alert,
    Snackbar,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {getProspectListing, getManualEntryListings, saveProspectListing} from "./actions";
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
    existingListings: {id: number; makeAndModel: string}[];
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
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: "success" | "error"}>({
        open: false,
        message: "",
        severity: "success",
    });

    // HANDLE SELECT LISTING
    const handleSelectListing = useCallback(async (id: number) => {
        /**
         * Loads the selected listing's full data into the editor form.
         */

        setSelectedId(id);
        setLoading(true);
        try {
            const result = await getProspectListing(id);
            if (result.success && result.listing) {
                setEditorData(result.listing);
            } else {
                setSnackbar({open: true, message: result.error || "Failed to load listing", severity: "error"});
            }
        } finally {
            setLoading(false);
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

    // HANDLE SAVE
    const handleSave = useCallback(async (data: ProspectListingData) => {
        /**
         * Persists the editor form data via the server action, then refreshes
         * the listings dropdown to reflect any changes.
         */

        setLoading(true);
        try {
            const result = await saveProspectListing(data);
            if (result.success) {
                setSnackbar({open: true, message: "Listing saved successfully", severity: "success"});

                // refresh the listings dropdown
                const refreshed = await getManualEntryListings();
                if (refreshed.success && refreshed.listings) {
                    setListings(refreshed.listings);
                }

                // if this was a new listing, switch to editing the inserted record
                if (!data.id && result.id) {
                    setSelectedId(result.id);
                    setEditorData({...data, id: result.id});
                }
            } else {
                setSnackbar({open: true, message: result.error || "Failed to save listing", severity: "error"});
            }
        } finally {
            setLoading(false);
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
                                {listing.makeAndModel}
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
                    onSave={handleSave}
                    saving={loading}
                />
            )}

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((prev) => ({...prev, open: false}))}
                anchorOrigin={{vertical: "bottom", horizontal: "center"}}
            >
                <Alert
                    onClose={() => setSnackbar((prev) => ({...prev, open: false}))}
                    severity={snackbar.severity}
                    variant="filled"
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
