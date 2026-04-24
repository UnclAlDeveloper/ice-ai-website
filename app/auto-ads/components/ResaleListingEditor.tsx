"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    Box,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Autocomplete,
    Typography,
    CircularProgress,
    Collapse,
    Alert,
    IconButton,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import SaveIcon from "@mui/icons-material/Save";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import PhotoIcon from "@mui/icons-material/Photo";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DownloadIcon from "@mui/icons-material/Download";
import { saveResaleListing } from "../resales/actions";
import type { resaleListing } from "../resales/actions";
import { fetchListingImages, uploadListingImage, deleteListingImage, detectNumberplate, lookupRegistration, generateResaleDescription, generateResaleSellPrice, createEbayListingAction, cancelEbayListingAction, buildFacebookListingPayloadAction, saveResaleFacebookUrl } from "./actions";
import type { DvlaVehicleData } from "./actions";
import { deriveShortDescription } from "../lib/deriveShortDescription";

// STATUS OPTIONS
const STATUS_OPTIONS = ["Bought", "Sold"] as const;
/** Resale listing statuses matching the resale_listing_status database enum. */

// AUTOCOMPLETE FIELD CONFIG
const AUTOCOMPLETE_FIELDS: { key: keyof resaleListing; label: string; lookupType: string }[] = [
    { key: "makeAndModel", label: "Make & Model", lookupType: "make_and_model" },
    { key: "location", label: "Location", lookupType: "location" },
    { key: "bodyType", label: "Body Type", lookupType: "body_type" },
    { key: "cabType", label: "Cab Type", lookupType: "cab_type" },
    { key: "fuelType", label: "Fuel Type", lookupType: "fuel_type" },
    { key: "gearboxType", label: "Gearbox Type", lookupType: "gearbox_type" },
    { key: "wheelbase", label: "Wheelbase", lookupType: "wheelbase" },
    { key: "engineSize", label: "Engine Size", lookupType: "engine_size" },
    { key: "colour", label: "Colour", lookupType: "colour" },
    { key: "emissionClass", label: "Emission Class", lookupType: "emission_class" },
];
/** Maps each autocomplete-enabled field to its display label and lookups table key. */

// RESALE LISTING EDITOR PROPS
interface ResaleListingEditorProps {
    data: resaleListing;
    lookupMap: Record<string, string[]>;
    ebayCategories: { code: string; value: string | null }[];
    onSaved?: (data: resaleListing) => void;
    pendingPrimaryImage?: File | null;
    onPendingImageConsumed?: () => void;
    canUseAiSellPrice: boolean;
}
/**
 * Props accepted by the editor: current listing data, lookup options, an
 * optional callback fired after a successful save, an optional pending
 * primary image file captured before the listing was created, a callback
 * to clear that pending file once it has been uploaded to S3, eBay category
 * lookup options (code stored as ebayCategoryId, value shown in the UI), and whether
 * the user may use AI suggested sell price (AdvancedTier or higher).
 */

// RESALE LISTING EDITOR
export default function ResaleListingEditor({
    data,
    lookupMap,
    ebayCategories,
    onSaved,
    pendingPrimaryImage,
    onPendingImageConsumed,
    canUseAiSellPrice,
}: ResaleListingEditorProps) {
    /**
     * Form for editing resale listing fields. Calls the saveResaleListing
     * server action directly so the record is always flushed and committed,
     * returning the database id for new inserts. Includes the resale-specific
     * fields (eBayUrl, facebookUrl, adsPrice, aiSellPriceLow/High) and uses
     * the narrower 'Bought'/'Sold' status enum.
     */

    const [formData, setFormData] = useState<resaleListing>(data);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
        open: false,
        message: "",
        severity: "success",
    });
    const [imageList, setImageList] = useState<{ id: number; url: string; isPrimary: boolean | null }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadingPrimary, setUploadingPrimary] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const primaryFileInputRef = useRef<HTMLInputElement>(null);

    const primaryImage = imageList.find((img) => img.isPrimary === true) ?? null;
    const secondaryImages = imageList.filter((img) => !img.isPrimary);

    // create a blob url for previewing the pending image before it is uploaded
    const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
    useEffect(() => {
        if (pendingPrimaryImage) {
            const url = URL.createObjectURL(pendingPrimaryImage);
            setPendingPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setPendingPreviewUrl(null);
    }, [pendingPrimaryImage]);

    // reset form when the parent switches listing
    useEffect(() => {
        setFormData(data);
    }, [data]);

    // load images when the listing id is available or changes
    useEffect(() => {
        if (formData.id) {
            fetchListingImages("Resale", formData.id).then((result) => {
                if (result.success && result.images) {
                    setImageList(result.images);
                }
            });
        } else {
            setImageList([]);
        }
    }, [formData.id]);

    const [lookingUp, setLookingUp] = useState(false);
    const [generatingDescription, setGeneratingDescription] = useState(false);
    const [generatingPrice, setGeneratingPrice] = useState(false);
    const [ebayCreating, setEbayCreating] = useState(false);
    const [ebayCancelling, setEbayCancelling] = useState(false);
    const [facebookWorking, setFacebookWorking] = useState(false);
    const [facebookUrlInput, setFacebookUrlInput] = useState<string>(data.facebookUrl ?? "");
    const [facebookUrlSaving, setFacebookUrlSaving] = useState(false);

    // keep the facebook url input in sync when the parent switches listing
    useEffect(() => {
        setFacebookUrlInput(data.facebookUrl ?? "");
    }, [data.facebookUrl, data.id]);

    // auto-close success notifications; keep errors open until manually closed
    useEffect(() => {
        if (!snackbar.open || snackbar.severity !== "success") return;
        const timeoutId = setTimeout(() => {
            setSnackbar((prev) => (prev.open && prev.severity === "success" ? {...prev, open: false} : prev));
        }, 4000);
        return () => clearTimeout(timeoutId);
    }, [snackbar.open, snackbar.severity, snackbar.message]);

    // SET FIELD
    const setField = (key: keyof resaleListing, value: string | number | boolean | null) => {
        /**
         * Updates a single field in the local form state.
         */

        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    // APPLY DVLA DATA
    const applyDvlaData = (dvla: DvlaVehicleData) => {
        /**
         * Merges DVLA lookup results into the form, only populating fields
         * that are currently empty or null so user-entered data is preserved.
         * After merging, derives a short description from the filled fields
         * if shortDescription was previously empty. Returns a count of how
         * many DVLA fields were filled.
         */

        let filled = 0;
        setFormData((prev) => {
            const next = { ...prev };
            const keys = Object.keys(dvla) as (keyof DvlaVehicleData)[];
            for (const key of keys) {
                const dvlaValue = dvla[key];
                if (dvlaValue == null) continue;
                const current = prev[key as keyof resaleListing];
                const isEmpty = current === null || current === undefined || current === "" || current === 0;
                if (isEmpty) {
                    (next as Record<string, unknown>)[key] = dvlaValue;
                    filled++;
                }
            }

            // derive a short description from the merged fields if not already set
            if (!prev.shortDescription) {
                const derived = deriveShortDescription(next);
                if (derived) next.shortDescription = derived;
            }

            return next as resaleListing;
        });
        return filled;
    };

    // HANDLE DVLA LOOKUP
    const handleDvlaLookup = async () => {
        /**
         * Calls the DVLA Vehicle Enquiry Service for the current registration
         * and merges the returned data into empty form fields.
         */

        if (!formData.registration) return;
        setLookingUp(true);
        try {
            const result = await lookupRegistration(formData.registration);
            if (result.success && result.data) {
                const filled = applyDvlaData(result.data);
                setSnackbar({ open: true, message: `DVLA lookup complete — ${filled} field${filled !== 1 ? "s" : ""} populated`, severity: "success" });
            } else {
                setSnackbar({ open: true, message: result.error || "DVLA lookup failed", severity: "error" });
            }
        } catch (err) {
            setSnackbar({ open: true, message: err instanceof Error ? err.message : "DVLA lookup failed", severity: "error" });
        } finally {
            setLookingUp(false);
        }
    };

    // HANDLE GENERATE DESCRIPTION
    const handleGenerateDescription = async () => {
        /**
         * Calls the Gemini API via the server action, passing the current form
         * data and any uploaded images, then populates both the Full Description
         * and Specs & Features fields with the returned sections.
         */

        setGeneratingDescription(true);
        try {
            const result = await generateResaleDescription(formData);
            if (result.success && result.description) {
                setFormData((prev) => ({
                    ...prev,
                    fullDescription: result.description!,
                    specsAndFeatures: result.specsAndFeatures ?? prev.specsAndFeatures,
                }));
                setSnackbar({ open: true, message: "Description and specs generated successfully", severity: "success" });
            } else {
                setSnackbar({ open: true, message: result.error || "Failed to generate description", severity: "error" });
            }
        } catch (err) {
            setSnackbar({ open: true, message: err instanceof Error ? err.message : "Unexpected error", severity: "error" });
        } finally {
            setGeneratingDescription(false);
        }
    };

    // HANDLE GENERATE SELL PRICE
    const handleGenerateSellPrice = async () => {
        /**
         * Calls the Gemini API via the server action to produce a suggested
         * retail selling price range, then writes the returned low and high
         * values into the aiSellPriceLow and aiSellPriceHigh form fields.
         */

        setGeneratingPrice(true);
        try {
            const result = await generateResaleSellPrice(formData);
            if (result.success && result.low !== undefined && result.high !== undefined) {
                setFormData((prev) => ({ ...prev, aiSellPriceLow: result.low!, aiSellPriceHigh: result.high! }));
                setSnackbar({
                    open: true,
                    message: `AI suggested sell price: £${result.low.toLocaleString()} – £${result.high.toLocaleString()}`,
                    severity: "success",
                });
            } else {
                setSnackbar({ open: true, message: result.error || "Failed to generate sell price", severity: "error" });
            }
        } catch (err) {
            setSnackbar({ open: true, message: err instanceof Error ? err.message : "Unexpected error", severity: "error" });
        } finally {
            setGeneratingPrice(false);
        }
    };

    // HANDLE SUBMIT
    const handleSubmit = async (e: React.FormEvent) => {
        /**
         * Inserts or updates the resale listing via the server action. On a
         * successful insert the pending primary image (if any) is uploaded to
         * S3 and linked to the new listing before notifying the parent.
         */

        e.preventDefault();
        setSaving(true);
        try {
            const result = await saveResaleListing(formData);
            if (result.success && result.id) {
                // upload the pending primary image now that the listing has an id
                if (pendingPrimaryImage) {
                    const fd = new FormData();
                    fd.append("file", pendingPrimaryImage);
                    fd.append("listingId", String(result.id));
                    fd.append("listingTable", "Resale");
                    fd.append("isPrimary", "true");
                    const uploadResult = await uploadListingImage(fd);
                    if (uploadResult.success && uploadResult.image) {
                        setImageList((prev) => [...prev, uploadResult.image!]);
                    }
                    onPendingImageConsumed?.();
                }

                const persisted = { ...formData, id: result.id };
                setFormData(persisted);
                setSnackbar({ open: true, message: "Listing saved successfully", severity: "success" });
                onSaved?.(persisted);
            } else {
                setSnackbar({ open: true, message: result.error || "Failed to save listing", severity: "error" });
            }
        } catch (err) {
            setSnackbar({ open: true, message: err instanceof Error ? err.message : "Unexpected error", severity: "error" });
        } finally {
            setSaving(false);
        }
    };

    // HANDLE FILE SELECT
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        /**
         * Iterates over files chosen by the user, uploads each to S3 as a
         * non-primary image and appends the returned record to the local list.
         */

        const files = e.target.files;
        if (!files?.length || !formData.id) return;

        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("listingId", String(formData.id));
                fd.append("listingTable", "Resale");
                fd.append("isPrimary", "false");

                const result = await uploadListingImage(fd);
                if (result.success && result.image) {
                    setImageList((prev) => [...prev, result.image!]);
                } else {
                    setSnackbar({ open: true, message: result.error || "Failed to upload image", severity: "error" });
                }
            }
        } catch (err) {
            setSnackbar({ open: true, message: err instanceof Error ? err.message : "Upload failed", severity: "error" });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // HANDLE PRIMARY FILE SELECT
    const handlePrimaryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        /**
         * Uploads a single file as the primary image, then sends the uploaded
         * image to Gemini to read the numberplate. If the Registration field is
         * empty and a plate is detected, it is auto-populated.
         */

        const files = e.target.files;
        if (!files?.length || !formData.id) return;

        setUploadingPrimary(true);
        try {
            const fd = new FormData();
            fd.append("file", files[0]);
            fd.append("listingId", String(formData.id));
            fd.append("listingTable", "Resale");
            fd.append("isPrimary", "true");

            const result = await uploadListingImage(fd);
            if (result.success && result.image) {
                setImageList((prev) => [...prev, result.image!]);

                // auto-detect the numberplate and chain DVLA lookup if registration is empty
                if (!formData.registration) {
                    detectNumberplate(result.image.url).then(async (plateResult) => {
                        if (plateResult.success && plateResult.numberplate) {
                            setField("registration", plateResult.numberplate);
                            const dvlaResult = await lookupRegistration(plateResult.numberplate);
                            if (dvlaResult.success && dvlaResult.data) {
                                const filled = applyDvlaData(dvlaResult.data);
                                setSnackbar({ open: true, message: `Plate ${plateResult.numberplate} detected — ${filled} field${filled !== 1 ? "s" : ""} populated via DVLA`, severity: "success" });
                            } else {
                                setSnackbar({ open: true, message: `Numberplate detected: ${plateResult.numberplate}`, severity: "success" });
                            }
                        }
                    });
                }
            } else {
                setSnackbar({ open: true, message: result.error || "Failed to upload primary image", severity: "error" });
            }
        } catch (err) {
            setSnackbar({ open: true, message: err instanceof Error ? err.message : "Upload failed", severity: "error" });
        } finally {
            setUploadingPrimary(false);
            if (primaryFileInputRef.current) primaryFileInputRef.current.value = "";
        }
    };

    // HANDLE EBAY PUBLISH
    const handleEbayPublish = async () => {
        /**
         * Publishes or updates the resale listing on eBay and stores the returned URL.
         */

        if (!formData.id || !canUseAiSellPrice) return;
        setEbayCreating(true);
        try {
            const result = await createEbayListingAction(formData.id);
            if (result.success && result.ebayUrl) {
                setFormData((prev) => ({ ...prev, eBayUrl: result.ebayUrl! }));
                setSnackbar({ open: true, message: "eBay listing published successfully", severity: "success" });
            } else {
                setSnackbar({ open: true, message: result.error || "eBay publish failed", severity: "error" });
            }
        } catch (err) {
            setSnackbar({ open: true, message: err instanceof Error ? err.message : "eBay publish failed", severity: "error" });
        } finally {
            setEbayCreating(false);
        }
    };

    // HANDLE EBAY CANCEL
    const handleEbayCancel = async () => {
        /**
         * Cancels the currently published eBay listing and clears the stored URL.
         */

        if (!formData.id || !formData.eBayUrl || !canUseAiSellPrice) return;
        setEbayCancelling(true);
        try {
            const result = await cancelEbayListingAction(formData.id);
            if (result.success) {
                setFormData((prev) => ({ ...prev, eBayUrl: null, ebayItemId: null }));
                setSnackbar({ open: true, message: "eBay listing cancelled successfully", severity: "success" });
            } else {
                setSnackbar({ open: true, message: result.error || "eBay cancellation failed", severity: "error" });
            }
        } catch (err) {
            setSnackbar({ open: true, message: err instanceof Error ? err.message : "eBay cancellation failed", severity: "error" });
        } finally {
            setEbayCancelling(false);
        }
    };

    const ebayPublishDisabled =
        !formData.id ||
        !canUseAiSellPrice ||
        !formData.ebayCategoryId?.trim() ||
        formData.askingPrice == null ||
        formData.askingPrice < 0 ||
        imageList.length === 0 ||
        ebayCreating;

    // HANDLE FACEBOOK ASSIST
    const handleFacebookAssist = async () => {
        /**
         * Builds the pre-fill payload for Facebook Marketplace, copies the
         * description text to the clipboard, and opens Marketplace in a new
         * tab. In create mode the wizard URL is opened; in edit mode the
         * existing item page is opened so the user can use Facebook's own
         * edit flow. Photos are handled separately by handleFacebookPhotos.
         */

        if (!formData.id) return;
        setFacebookWorking(true);
        try {
            const result = await buildFacebookListingPayloadAction(formData.id);
            if (!result.success || !result.payload) {
                setSnackbar({ open: true, message: result.error || "Failed to prepare Facebook listing", severity: "error" });
                return;
            }

            // copy the title + description to the clipboard so the user can
            // paste it into Facebook's description field in one keystroke
            try {
                await navigator.clipboard.writeText(result.payload.copyText);
            } catch (err) {
                console.warn("Clipboard write failed:", err);
                setSnackbar({ open: true, message: "Could not copy text — please copy it manually after opening Facebook.", severity: "error" });
            }

            // open marketplace in a new tab (create wizard or existing item)
            window.open(result.payload.marketplaceUrl, "_blank", "noopener,noreferrer");

            const actionLabel = result.payload.mode === "edit" ? "Edit" : "New listing";
            setSnackbar({
                open: true,
                message: `Description copied to clipboard. Opened Facebook Marketplace (${actionLabel}). Remember to download photos and paste the text into the description field.`,
                severity: "success",
            });
        } catch (err) {
            setSnackbar({ open: true, message: err instanceof Error ? err.message : "Facebook assist failed", severity: "error" });
        } finally {
            setFacebookWorking(false);
        }
    };

    // HANDLE FACEBOOK PHOTOS
    const handleFacebookPhotos = () => {
        /**
         * Triggers a browser download of every photo attached to the resale
         * listing, zipped server-side. When updating an existing listing the
         * user has to delete the current photos on Facebook manually before
         * dragging the new ZIP contents in, because Marketplace appends
         * uploads instead of replacing them.
         */

        if (!formData.id || imageList.length === 0) return;

        // use a plain anchor click so the browser handles the streamed
        // response's Content-Disposition header and saves the ZIP to disk
        const a = document.createElement("a");
        a.href = `/api/auto-ads/resales/${formData.id}/photos.zip`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    // HANDLE SAVE FACEBOOK URL
    const handleSaveFacebookUrl = async () => {
        /**
         * Persists the Facebook Marketplace URL the user pasted back after
         * publishing the listing manually. An empty value clears the stored
         * URL so future assist clicks go back into create mode.
         */

        if (!formData.id) return;
        setFacebookUrlSaving(true);
        try {
            const trimmed = facebookUrlInput.trim();
            const toSave = trimmed.length > 0 ? trimmed : null;
            const result = await saveResaleFacebookUrl(formData.id, toSave);
            if (result.success) {
                setFormData((prev) => ({ ...prev, facebookUrl: toSave }));
                setSnackbar({
                    open: true,
                    message: toSave ? "Facebook URL saved" : "Facebook URL cleared",
                    severity: "success",
                });
            } else {
                setSnackbar({ open: true, message: result.error || "Failed to save Facebook URL", severity: "error" });
            }
        } catch (err) {
            setSnackbar({ open: true, message: err instanceof Error ? err.message : "Failed to save Facebook URL", severity: "error" });
        } finally {
            setFacebookUrlSaving(false);
        }
    };

    const facebookAssistDisabled =
        !formData.id ||
        !formData.shortDescription?.trim() ||
        facebookWorking;

    const facebookPhotosDisabled =
        !formData.id ||
        imageList.length === 0;

    const facebookUrlDirty = (facebookUrlInput.trim() || null) !== (formData.facebookUrl ?? null);

    // HANDLE DELETE IMAGE
    const handleDeleteImage = async (imageId: number) => {
        /**
         * Removes an image record from the database and drops it from the
         * local list so the UI updates immediately.
         */

        const result = await deleteListingImage(imageId);
        if (result.success) {
            setImageList((prev) => prev.filter((img) => img.id !== imageId));
        } else {
            setSnackbar({ open: true, message: result.error || "Failed to delete image", severity: "error" });
        }
    };

    // column spans: xs=12 (full), sm=6 (half), md=4 (third)
    const fieldSize = { xs: 12, sm: 6, md: 4 };
    const wideFieldSize = { xs: 12 };

    return (
        <Box component="form" onSubmit={handleSubmit} noValidate>
            {/* --- primary image (floated so content wraps around it) --- */}
            {formData.id ? (
                <Box sx={{ float: { sm: "left" }, mr: { sm: 3 }, mb: 2, textAlign: { xs: "center", sm: "left" } }}>
                    {primaryImage ? (
                        <Box
                            sx={{
                                position: "relative",
                                maxWidth: 320,
                                mx: { xs: "auto", sm: 0 },
                                borderRadius: 1,
                                overflow: "hidden",
                                border: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Box
                                component="img"
                                src={primaryImage.url}
                                alt="Primary"
                                sx={{ maxWidth: 320, width: "100%", height: "auto", display: "block" }}
                            />
                            <IconButton
                                size="small"
                                onClick={() => handleDeleteImage(primaryImage.id)}
                                sx={{
                                    position: "absolute",
                                    top: 2,
                                    right: 2,
                                    bgcolor: "rgba(0,0,0,0.5)",
                                    color: "white",
                                    "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                                }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    ) : (
                        <Box
                            onClick={() => primaryFileInputRef.current?.click()}
                            sx={{
                                width: 120,
                                height: 120,
                                mx: { xs: "auto", sm: 0 },
                                borderRadius: 1,
                                border: "2px dashed",
                                borderColor: "divider",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: uploadingPrimary ? "default" : "pointer",
                                "&:hover": uploadingPrimary ? {} : { borderColor: "primary.main", bgcolor: "action.hover" },
                            }}
                        >
                            {uploadingPrimary ? <CircularProgress size={24} /> : <PhotoIcon color="action" sx={{ fontSize: 36 }} />}
                        </Box>
                    )}
                    <input
                        ref={primaryFileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={handlePrimaryFileSelect}
                    />
                </Box>
            ) : pendingPreviewUrl ? (
                <Box sx={{ float: { sm: "left" }, mr: { sm: 3 }, mb: 2, textAlign: { xs: "center", sm: "left" } }}>
                    <Box
                        sx={{
                            maxWidth: 320,
                            mx: { xs: "auto", sm: 0 },
                            borderRadius: 1,
                            overflow: "hidden",
                            border: "1px solid",
                            borderColor: "divider",
                        }}
                    >
                        <Box
                            component="img"
                            src={pendingPreviewUrl}
                            alt="Primary (pending upload)"
                            sx={{ maxWidth: 320, width: "100%", height: "auto", display: "block" }}
                        />
                    </Box>
                </Box>
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Save the listing first to add a primary image.
                </Typography>
            )}

            {/* --- vehicle identity --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Vehicle Identity
            </Typography>
            <Grid container spacing={2}>
                <Grid size={fieldSize}>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <TextField
                            label="Registration"
                            size="small"
                            fullWidth
                            value={formData.registration ?? ""}
                            onChange={(e) => setField("registration", e.target.value || null)}
                        />
                        <Button
                            variant="outlined"
                            size="small"
                            disabled={!formData.registration || lookingUp}
                            onClick={handleDvlaLookup}
                            sx={{ minWidth: 0, px: 1.5, whiteSpace: "nowrap" }}
                            startIcon={lookingUp ? <CircularProgress size={16} /> : <SearchIcon />}
                        >
                            DVLA
                        </Button>
                    </Box>
                </Grid>

                {AUTOCOMPLETE_FIELDS.filter((f) =>
                    f.key === "makeAndModel"
                ).map((field) => (
                    <Grid key={field.key} size={fieldSize}>
                        <Autocomplete
                            freeSolo
                            options={lookupMap[field.lookupType] || []}
                            value={String(formData[field.key] ?? "")}
                            onInputChange={(_e, newValue) => setField(field.key, newValue || null)}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={field.label}
                                    size="small"
                                    fullWidth
                                    required={field.key === "makeAndModel"}
                                />
                            )}
                        />
                    </Grid>
                ))}

                <Grid size={fieldSize}>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="status-label">Status</InputLabel>
                        <Select
                            labelId="status-label"
                            label="Status"
                            value={formData.status}
                            onChange={(e) => setField("status", e.target.value)}
                        >
                            {STATUS_OPTIONS.map((s) => (
                                <MenuItem key={s} value={s}>{s}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid size={wideFieldSize}>
                    <TextField
                        label="Short Description"
                        size="small"
                        fullWidth
                        required
                        value={formData.shortDescription}
                        onChange={(e) => setField("shortDescription", e.target.value)}
                    />
                </Grid>
            </Grid>


            {/* --- vehicle details --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
                Vehicle Details
            </Typography>
            <Grid container spacing={2}>
                <Grid size={fieldSize}>
                    <TextField
                        label="Year"
                        size="small"
                        fullWidth
                        type="number"
                        value={formData.year ?? ""}
                        onChange={(e) => setField("year", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                </Grid>

                {AUTOCOMPLETE_FIELDS.filter((f) =>
                    ["bodyType", "cabType", "fuelType", "gearboxType", "wheelbase", "engineSize", "colour", "emissionClass", "location"].includes(f.key)
                ).map((field) => (
                    <Grid key={field.key} size={fieldSize}>
                        <Autocomplete
                            freeSolo
                            options={lookupMap[field.lookupType] || []}
                            value={String(formData[field.key] ?? "")}
                            onInputChange={(_e, newValue) => setField(field.key, newValue || null)}
                            renderInput={(params) => (
                                <TextField {...params} label={field.label} size="small" fullWidth />
                            )}
                        />
                    </Grid>
                ))}

                <Grid size={fieldSize}>
                    <TextField
                        label="Seats"
                        size="small"
                        fullWidth
                        type="number"
                        value={formData.seats ?? ""}
                        onChange={(e) => setField("seats", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                </Grid>
            </Grid>


            {/* --- mileage --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
                Mileage
            </Typography>
            <Grid container spacing={2}>
                <Grid size={fieldSize}>
                    <TextField
                        label="Mileage"
                        size="small"
                        fullWidth
                        type="number"
                        value={formData.mileage ?? ""}
                        onChange={(e) => setField("mileage", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="Mileage Unit"
                        size="small"
                        fullWidth
                        value={formData.mileageUnit ?? ""}
                        onChange={(e) => setField("mileageUnit", e.target.value || null)}
                    />
                </Grid>
            </Grid>


            {/* --- history and condition --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
                History &amp; Condition
            </Typography>
            <Grid container spacing={2}>
                <Grid size={fieldSize}>
                    <TextField
                        label="Number of Owners"
                        size="small"
                        fullWidth
                        type="number"
                        value={formData.numberOfOwners ?? ""}
                        onChange={(e) => setField("numberOfOwners", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="Service History"
                        size="small"
                        fullWidth
                        value={formData.serviceHistory ?? ""}
                        onChange={(e) => setField("serviceHistory", e.target.value || null)}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="Basic History Check"
                        size="small"
                        fullWidth
                        value={formData.basicHistoryCheck ?? ""}
                        onChange={(e) => setField("basicHistoryCheck", e.target.value || null)}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="MOT Status"
                        size="small"
                        fullWidth
                        value={formData.motStatus ?? ""}
                        onChange={(e) => setField("motStatus", e.target.value || null)}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="MOT Expiry"
                        size="small"
                        fullWidth
                        type="date"
                        value={formData.motExpiry ?? ""}
                        onChange={(e) => setField("motExpiry", e.target.value || null)}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                </Grid>
            </Grid>


            {/* --- tax and emissions --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
                Tax &amp; Emissions
            </Typography>
            <Grid container spacing={2}>
                <Grid size={fieldSize}>
                    <TextField
                        label="Tax Status"
                        size="small"
                        fullWidth
                        value={formData.taxStatus ?? ""}
                        onChange={(e) => setField("taxStatus", e.target.value || null)}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="Tax Due Date"
                        size="small"
                        fullWidth
                        type="date"
                        value={formData.taxDueDate ?? ""}
                        onChange={(e) => setField("taxDueDate", e.target.value || null)}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="CO2 Emissions (g/km)"
                        size="small"
                        fullWidth
                        type="number"
                        value={formData.co2Emissions ?? ""}
                        onChange={(e) => setField("co2Emissions", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="Type Approval"
                        size="small"
                        fullWidth
                        value={formData.typeApproval ?? ""}
                        onChange={(e) => setField("typeApproval", e.target.value || null)}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="Revenue Weight (kg)"
                        size="small"
                        fullWidth
                        type="number"
                        value={formData.revenueWeight ?? ""}
                        onChange={(e) => setField("revenueWeight", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="First Registration"
                        size="small"
                        fullWidth
                        value={formData.monthOfFirstRegistration ?? ""}
                        onChange={(e) => setField("monthOfFirstRegistration", e.target.value || null)}
                        placeholder="YYYY-MM"
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="Last V5C Issued"
                        size="small"
                        fullWidth
                        type="date"
                        value={formData.dateOfLastV5CIssued ?? ""}
                        onChange={(e) => setField("dateOfLastV5CIssued", e.target.value || null)}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="marked-for-export-label">Marked for Export</InputLabel>
                        <Select
                            labelId="marked-for-export-label"
                            label="Marked for Export"
                            value={formData.markedForExport === true ? "Yes" : formData.markedForExport === false ? "No" : ""}
                            onChange={(e) => {
                                const val = e.target.value;
                                setField("markedForExport", val === "Yes" ? true : val === "No" ? false : null);
                            }}
                        >
                            <MenuItem value="">Unknown</MenuItem>
                            <MenuItem value="No">No</MenuItem>
                            <MenuItem value="Yes">Yes</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>


            {/* --- descriptions --- */}
            <Box sx={{ mt: 3, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                    Descriptions
                </Typography>
                <Button
                    size="small"
                    variant="outlined"
                    disabled={generatingDescription || !formData.makeAndModel}
                    onClick={handleGenerateDescription}
                    startIcon={generatingDescription ? <CircularProgress size={14} /> : <AutoFixHighIcon />}
                    sx={{ ml: "auto" }}
                >
                    {generatingDescription ? "Generating…" : "AI Generate"}
                </Button>
            </Box>
            <Grid container spacing={2}>
                <Grid size={wideFieldSize}>
                    <TextField
                        label="Full Description"
                        size="small"
                        fullWidth
                        multiline
                        minRows={3}
                        value={formData.fullDescription ?? ""}
                        onChange={(e) => setField("fullDescription", e.target.value || null)}
                    />
                </Grid>

                <Grid size={wideFieldSize}>
                    <TextField
                        label="Specs & Features"
                        size="small"
                        fullWidth
                        multiline
                        minRows={3}
                        value={formData.specsAndFeatures ?? ""}
                        onChange={(e) => setField("specsAndFeatures", e.target.value || null)}
                    />
                </Grid>
            </Grid>


            {/* --- pricing --- */}
            <Box sx={{ mt: 3, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                    Pricing
                </Typography>
                {canUseAiSellPrice && (
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={generatingPrice || !formData.makeAndModel}
                        onClick={handleGenerateSellPrice}
                        startIcon={generatingPrice ? <CircularProgress size={14} /> : <AutoFixHighIcon />}
                        sx={{ ml: "auto" }}
                    >
                        {generatingPrice ? "Generating…" : "AI Price"}
                    </Button>
                )}
            </Box>
            <Grid container spacing={2}>
                <Grid size={fieldSize}>
                    <TextField
                        label="Ads Price"
                        size="small"
                        fullWidth
                        type="number"
                        value={formData.adsPrice ?? ""}
                        onChange={(e) => setField("adsPrice", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                </Grid>

                {canUseAiSellPrice &&
                    formData.aiSellPriceLow !== null &&
                    formData.aiSellPriceHigh !== null && (
                    <Grid size={wideFieldSize}>
                        <Typography variant="body2" color="text.primary">
                            <strong>AI Suggested Sell Price:</strong>{" "}
                            £{formData.aiSellPriceLow.toLocaleString()} to £{formData.aiSellPriceHigh.toLocaleString()}{" "}
                            (avg £{Math.round((formData.aiSellPriceLow + formData.aiSellPriceHigh) / 2).toLocaleString()})
                        </Typography>
                    </Grid>
                )}

                <Grid size={fieldSize}>
                    <TextField
                        label="Asking Price"
                        size="small"
                        fullWidth
                        type="number"
                        value={formData.askingPrice ?? ""}
                        onChange={(e) => setField("askingPrice", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                </Grid>
            </Grid>

            {/* --- listings --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
                Listings
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography variant="body2" sx={{ minWidth: 70 }}>eBay</Typography>
                    <FormControl size="small" sx={{ minWidth: 200, maxWidth: 420, flex: "1 1 200px" }}>
                        <InputLabel id="resale-ebay-category-label">eBay category</InputLabel>
                        <Select
                            labelId="resale-ebay-category-label"
                            label="eBay category"
                            value={formData.ebayCategoryId ?? ""}
                            onChange={(e) => {
                                const v = e.target.value;
                                setField("ebayCategoryId", v === "" ? null : String(v));
                            }}
                        >
                            <MenuItem value="">
                                <em>None</em>
                            </MenuItem>
                            {ebayCategories.map((row) => (
                                <MenuItem key={row.code} value={row.code}>
                                    {row.value ?? row.code}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {formData.eBayUrl && (
                        <Typography
                            component="a"
                            href={formData.eBayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="body2"
                            sx={{ display: "flex", alignItems: "center", gap: 0.5, mr: 1 }}
                        >
                            View listing <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </Typography>
                    )}
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={ebayPublishDisabled}
                        onClick={handleEbayPublish}
                        startIcon={ebayCreating ? <CircularProgress size={14} /> : undefined}
                    >
                        {ebayCreating ? "Working…" : formData.eBayUrl ? "Update" : "Create"}
                    </Button>
                    {formData.eBayUrl && (
                        <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={ebayCancelling}
                            onClick={handleEbayCancel}
                            startIcon={ebayCancelling ? <CircularProgress size={14} /> : undefined}
                        >
                            {ebayCancelling ? "Cancelling…" : "Cancel"}
                        </Button>
                    )}
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography variant="body2" sx={{ minWidth: 70 }}>Facebook</Typography>
                    {formData.facebookUrl && (
                        <Typography
                            component="a"
                            href={formData.facebookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="body2"
                            sx={{ display: "flex", alignItems: "center", gap: 0.5, mr: 1 }}
                        >
                            View listing <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </Typography>
                    )}
                    <Button
                        size="small"
                        variant="outlined"
                        disabled={facebookAssistDisabled}
                        onClick={handleFacebookAssist}
                        startIcon={facebookWorking ? <CircularProgress size={14} /> : undefined}
                    >
                        {facebookWorking ? "Working…" : formData.facebookUrl ? "Update" : "Create"}
                    </Button>
                    <Button
                        size="small"
                        variant="text"
                        disabled={facebookPhotosDisabled}
                        onClick={handleFacebookPhotos}
                        startIcon={<DownloadIcon fontSize="small" />}
                    >
                        Download photos
                    </Button>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: { xs: 0, sm: "78px" }, flexWrap: "wrap" }}>
                    <TextField
                        label="Facebook URL"
                        size="small"
                        placeholder="https://www.facebook.com/marketplace/item/…"
                        value={facebookUrlInput}
                        onChange={(e) => setFacebookUrlInput(e.target.value)}
                        sx={{ minWidth: 280, maxWidth: 520, flex: "1 1 280px" }}
                        disabled={!formData.id || facebookUrlSaving}
                    />
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={handleSaveFacebookUrl}
                        disabled={!formData.id || !facebookUrlDirty || facebookUrlSaving}
                        startIcon={facebookUrlSaving ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
                    >
                        {facebookUrlSaving ? "Saving…" : "Save URL"}
                    </Button>
                </Box>
            </Box>

            {/* --- save --- */}
            <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
                <Button
                    type="submit"
                    variant="contained"
                    disabled={saving || !formData.makeAndModel || !formData.shortDescription}
                    startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
                >
                    {saving ? "Saving…" : formData.id ? "Update" : "Create"}
                </Button>
            </Box>

            {/* --- images --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
                Images
            </Typography>
            {formData.id ? (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
                    {secondaryImages.map((img) => (
                        <Box
                            key={img.id}
                            sx={{
                                position: "relative",
                                maxWidth: 320,
                                borderRadius: 1,
                                overflow: "hidden",
                                border: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Box
                                component="img"
                                src={img.url}
                                alt=""
                                sx={{ maxWidth: 320, width: "100%", height: "auto", display: "block" }}
                            />
                            <IconButton
                                size="small"
                                onClick={() => handleDeleteImage(img.id)}
                                sx={{
                                    position: "absolute",
                                    top: 2,
                                    right: 2,
                                    bgcolor: "rgba(0,0,0,0.5)",
                                    color: "white",
                                    "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                                }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    ))}

                    <Box
                        onClick={() => fileInputRef.current?.click()}
                        sx={{
                            width: 120,
                            height: 120,
                            borderRadius: 1,
                            border: "2px dashed",
                            borderColor: "divider",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: uploading ? "default" : "pointer",
                            "&:hover": uploading ? {} : { borderColor: "primary.main", bgcolor: "action.hover" },
                        }}
                    >
                        {uploading ? <CircularProgress size={24} /> : <AddPhotoAlternateIcon color="action" sx={{ fontSize: 36 }} />}
                    </Box>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={handleFileSelect}
                    />
                </Box>
            ) : (
                <Typography variant="body2" color="text.secondary">
                    Save the listing first to add images.
                </Typography>
            )}

            <Box
                sx={{
                    position: "fixed",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    px: { xs: 1, sm: 2 },
                    pb: { xs: 1, sm: 2 },
                    zIndex: (theme) => theme.zIndex.snackbar,
                    pointerEvents: "none",
                }}
            >
                <Collapse in={snackbar.open} unmountOnExit timeout="auto">
                    <Alert
                        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                        severity={snackbar.severity}
                        variant="filled"
                        sx={{
                            whiteSpace: "pre-line",
                            width: "100%",
                            pointerEvents: "auto",
                        }}
                    >
                        {snackbar.message}
                    </Alert>
                </Collapse>
            </Box>
        </Box>
    );
}
