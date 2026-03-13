"use client";

import React, {useState, useCallback, useRef, useEffect} from "react";
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
import {deleteProspectListing, detectNumberplateFromFile} from "../components/actions";
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
     * Client shell for the Manual Entry page. For new listings the user must
     * first take a photo or upload an image of the vehicle. The numberplate is
     * detected via Gemini, and only then is the full editor form revealed with
     * the Registration field pre-populated. Existing listings open the editor
     * directly.
     */

    const [listings, setListings] = useState(existingListings);
    const [selectedId, setSelectedId] = useState<number | "">("");
    const [editorData, setEditorData] = useState<ProspectListingData | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [showCapture, setShowCapture] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [detectingPlate, setDetectingPlate] = useState(false);
    const [capturePreviewUrl, setCapturePreviewUrl] = useState<string | null>(null);
    const captureInputRef = useRef<HTMLInputElement>(null);
    const captureGenRef = useRef(0);

    // manage blob url lifecycle for the capture preview
    useEffect(() => {
        if (pendingFile && showCapture) {
            const url = URL.createObjectURL(pendingFile);
            setCapturePreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setCapturePreviewUrl(null);
    }, [pendingFile, showCapture]);

    // HANDLE SELECT LISTING
    const handleSelectListing = useCallback(async (id: number) => {
        /**
         * Loads the selected listing's full data into the editor form and
         * cancels any in-progress new-listing capture.
         */

        captureGenRef.current++;
        setShowCapture(false);
        setPendingFile(null);
        setDetectingPlate(false);
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
         * Enters photo-capture mode for a new listing. The editor form stays
         * hidden until the user takes a photo and the numberplate is detected.
         */

        captureGenRef.current++;
        setSelectedId("");
        setEditorData(null);
        setShowCapture(true);
        setPendingFile(null);
        setDetectingPlate(false);
    }, []);

    // HANDLE INITIAL CAPTURE
    const handleInitialCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        /**
         * Processes the photo or file the user selected in the capture step.
         * Sends the image to Gemini for numberplate detection, then reveals
         * the editor form with the Registration field pre-populated.
         */

        const files = e.target.files;
        if (!files?.length) return;

        const gen = captureGenRef.current;
        const file = files[0];
        setPendingFile(file);
        setDetectingPlate(true);

        const fd = new FormData();
        fd.append("file", file);
        const result = await detectNumberplateFromFile(fd);

        // discard result if the user navigated away during detection
        if (gen !== captureGenRef.current) return;

        setDetectingPlate(false);
        setShowCapture(false);
        setEditorData({
            ...NEW_LISTING_DEFAULTS,
            registration: result.success && result.numberplate ? result.numberplate : null,
        });

        // reset the input so the same file can be re-selected if needed
        if (captureInputRef.current) captureInputRef.current.value = "";
    }, []);

    // HANDLE SAVED
    const handleSaved = useCallback(async (data: ProspectListingData) => {
        /**
         * Called by the editor after a successful save. Refreshes the listings
         * dropdown and switches to the newly created record when applicable.
         */

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

            {showCapture && !editorData && (
                <Box sx={{display: "flex", flexDirection: "column", alignItems: "center", py: 6}}>
                    {capturePreviewUrl ? (
                        <>
                            <Box
                                component="img"
                                src={capturePreviewUrl}
                                alt="Captured"
                                sx={{maxWidth: 320, width: "100%", height: "auto", borderRadius: 1, mb: 2}}
                            />
                            <CircularProgress size={36} sx={{mb: 1}} />
                            <Typography color="text.secondary">
                                Detecting numberplate…
                            </Typography>
                        </>
                    ) : (
                        <Box
                            onClick={() => captureInputRef.current?.click()}
                            sx={{
                                width: 160,
                                height: 160,
                                borderRadius: 2,
                                border: "3px dashed",
                                borderColor: "divider",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                "&:hover": {borderColor: "primary.main", bgcolor: "action.hover"},
                            }}
                        >
                            <PhotoCameraIcon color="action" sx={{fontSize: 48, mb: 1}} />
                            <Typography variant="body2" color="text.secondary" sx={{display: {xs: "block", sm: "none"}}}>
                                Take photo
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{display: {xs: "none", sm: "block"}}}>
                                Upload photo
                            </Typography>
                        </Box>
                    )}
                    <input
                        ref={captureInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={handleInitialCapture}
                    />
                </Box>
            )}

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
