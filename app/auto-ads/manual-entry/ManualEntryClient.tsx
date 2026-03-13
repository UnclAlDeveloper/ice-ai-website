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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    Typography,
    CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import {green, red} from "@mui/material/colors";
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
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);


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

    // HANDLE PENDING IMAGE CONSUMED
    const handlePendingImageConsumed = useCallback(() => {
        /**
         * Called by the editor after it uploads the pending primary image to
         * S3 on first save, so the temp file reference can be released.
         */

        setPendingFile(null);
    }, []);

    // HANDLE DELETE LISTING
    const handleDeleteListing = useCallback(async () => {
        /**
         * Deletes the currently selected prospect listing and all of its images,
         * then removes it from the local dropdown list and resets the editor.
         */

        if (typeof selectedId !== "number") return;
        setDeleting(true);
        try {
            const result = await deleteProspectListing(selectedId);
            if (result.success) {
                setListings((prev) => prev.filter((l) => l.id !== selectedId));
                setSelectedId("");
                setEditorData(null);
            } else {
                console.error("Failed to delete listing:", result.error);
            }
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
        }
    }, [selectedId]);

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
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

                {selectedId !== "" && (
                    <Tooltip title="Delete listing">
                        <IconButton
                            onClick={() => setDeleteDialogOpen(true)}
                            sx={{
                                border: 2,
                                borderColor: red[900],
                                color: red[900],
                                "&:hover": {bgcolor: red[50]},
                            }}
                        >
                            <RemoveIcon />
                        </IconButton>
                    </Tooltip>
                )}

                <Tooltip title="New listing">
                    <IconButton
                        onClick={handleNewListing}
                        sx={{
                            border: 2,
                            borderColor: green[900],
                            color: green[900],
                            "&:hover": {bgcolor: green[50]},
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
                    pendingPrimaryImage={pendingFile}
                    onPendingImageConsumed={handlePendingImageConsumed}
                />
            )}

            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete Listing</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will permanently delete the listing and all of its images.
                        This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button onClick={handleDeleteListing} color="error" disabled={deleting}>
                        {deleting ? "Deleting…" : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
