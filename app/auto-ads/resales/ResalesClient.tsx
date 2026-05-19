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
} from "@mui/material";
import RemoveIcon from "@mui/icons-material/Remove";
import {red} from "@mui/material/colors";
import {getResaleListing, getResaleListings} from "./actions";
import type {resaleListing} from "./actions";
import {deleteResaleListing} from "../components/actions";
import ResaleListingEditor from "../components/ResaleListingEditor";

// RESALES CLIENT PROPS
interface ResalesClientProps {
    existingListings: {id: number; makeAndModel: string; shortDescription: string; registration: string | null}[];
    lookupMap: Record<string, string[]>;
    ebayCategories: {code: string; value: string | null; description: string | null}[];
    canUseAiSellPrice: boolean;
}
/** Props received from the server component: existing listing summaries, lookup values, eBay category options, and whether AI sell price is allowed for this user's tier. */

// RESALES CLIENT
export default function ResalesClient({existingListings, lookupMap, ebayCategories, canUseAiSellPrice}: ResalesClientProps) {
    /**
     * Client shell for the Resales page. Provides a dropdown to select and
     * edit existing resale listings, and a delete button to remove them.
     * New listings are created externally (e.g. by the scraper) and cannot
     * be created manually from this page.
     */

    const [listings, setListings] = useState(existingListings);
    const [selectedId, setSelectedId] = useState<number | "">("");
    const [editorData, setEditorData] = useState<resaleListing | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // HANDLE SELECT LISTING
    const handleSelectListing = useCallback(async (id: number) => {
        /**
         * Loads the selected listing's full data into the editor form.
         */

        setSelectedId(id);
        const result = await getResaleListing(id);
        if (result.success && result.listing) {
            setEditorData(result.listing);
        } else {
            console.error("Failed to load listing:", result.error);
        }
    }, []);

    // HANDLE SAVED
    const handleSaved = useCallback(async (data: resaleListing) => {
        /**
         * Called by the editor after a successful save. Refreshes the listings
         * dropdown to pick up any changes to the short description or registration.
         */

        const refreshed = await getResaleListings();
        if (refreshed.success && refreshed.listings) {
            setListings(refreshed.listings);
        }

        if (data.id) {
            setSelectedId(data.id);
            setEditorData(data);
        }
    }, []);

    // HANDLE DELETE LISTING
    const handleDeleteListing = useCallback(async () => {
        /**
         * Deletes the currently selected resale listing and all of its images,
         * then removes it from the local dropdown list and resets the editor.
         */

        if (typeof selectedId !== "number") return;
        setDeleting(true);
        try {
            const result = await deleteResaleListing(selectedId);
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
                                {listing.registration ?? listing.makeAndModel} - {listing.shortDescription}
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
            </Box>

            {editorData && (
                <ResaleListingEditor
                    data={editorData}
                    lookupMap={lookupMap}
                    ebayCategories={ebayCategories}
                    onSaved={handleSaved}
                    canUseAiSellPrice={canUseAiSellPrice}
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
