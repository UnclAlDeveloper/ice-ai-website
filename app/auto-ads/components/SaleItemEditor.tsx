"use client";

import React, {useState, useEffect, useRef} from "react";
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
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DownloadIcon from "@mui/icons-material/Download";
import {
    saveSaleItem,
    createSaleItemEbayListingAction,
    cancelSaleItemEbayListingAction,
    buildSaleItemFacebookListingPayloadAction,
    saveSaleItemFacebookUrl,
} from "../sale-items/actions";
import type {saleItem} from "../sale-items/actions";
import {fetchListingImages, uploadListingImage, deleteListingImage} from "./actions";
import CurrencyTextField from "./CurrencyTextField";

// STATUS OPTIONS
const STATUS_OPTIONS = ["Inventory", "Sold"] as const;
/** Sale item statuses matching the sale_listing_status database enum. */

// CURRENCY OPTIONS
const CURRENCY_OPTIONS = [
    {symbol: "£", label: "£ GBP"},
    {symbol: "$", label: "$ USD"},
    {symbol: "€", label: "€ EUR"},
] as const;
/**
 * Currencies the user can pick for the asking price. eBay's REST API maps
 * these symbols back onto ISO 4217 codes via the publish helpers, so the
 * stored char is enough for both the UI and the publishing layer.
 */

// SALE ITEM EDITOR PROPS
interface SaleItemEditorProps {
    data: saleItem;
    ebayCategories: {code: string; value: string | null; description: string | null}[];
    onSaved?: (data: saleItem) => void;
}
/**
 * Props accepted by the editor: the current sale item row, the eBay
 * category options for the publishing dropdown, and an optional callback
 * fired after the row has been persisted so the parent can refresh its
 * own listing dropdown.
 */

// SALE ITEM EDITOR
export default function SaleItemEditor({
    data,
    ebayCategories,
    onSaved,
}: SaleItemEditorProps) {
    /**
     * Form for editing a sale item. Calls saveSaleItem directly so the
     * row is always flushed and committed, returning the database id for
     * new inserts. Once an id exists the user can attach images and
     * publish to eBay or Facebook Marketplace, mirroring the resale
     * editor's external-listing flow but without any vehicle-specific
     * inputs (year, mileage, DVLA lookup, AI generators, etc.).
     */

    const [formData, setFormData] = useState<saleItem>(data);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: "success" | "error"}>({
        open: false,
        message: "",
        severity: "success",
    });
    const [imageList, setImageList] = useState<{id: number; url: string; isPrimary: boolean | null}[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadingPrimary, setUploadingPrimary] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const primaryFileInputRef = useRef<HTMLInputElement>(null);

    const primaryImage = imageList.find((img) => img.isPrimary === true) ?? null;
    const secondaryImages = imageList.filter((img) => !img.isPrimary);

    // reset form when the parent switches sale item
    useEffect(() => {
        setFormData(data);
    }, [data]);

    // load images when the sale item id is available or changes
    useEffect(() => {
        if (formData.id) {
            fetchListingImages("SaleItem", formData.id).then((result) => {
                if (result.success && result.images) {
                    setImageList(result.images);
                }
            });
        } else {
            setImageList([]);
        }
    }, [formData.id]);

    const [ebayCreating, setEbayCreating] = useState(false);
    const [ebayCancelling, setEbayCancelling] = useState(false);
    const [facebookWorking, setFacebookWorking] = useState(false);
    const [facebookUrlInput, setFacebookUrlInput] = useState<string>(data.facebookUrl ?? "");
    const [facebookUrlSaving, setFacebookUrlSaving] = useState(false);

    // keep the facebook url input in sync when the parent switches item
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
    const setField = (key: keyof saleItem, value: string | number | null) => {
        /**
         * Updates a single field in the local form state.
         */

        setFormData((prev) => ({...prev, [key]: value}));
    };

    // HANDLE SUBMIT
    const handleSubmit = async (e: React.FormEvent) => {
        /**
         * Inserts or updates the sale item via the server action. The
         * returned id is merged back into local state so subsequent
         * actions (image upload, eBay publish, etc.) become available.
         */

        e.preventDefault();
        setSaving(true);
        try {
            const result = await saveSaleItem(formData);
            if (result.success && result.id) {
                const persisted = {...formData, id: result.id};
                setFormData(persisted);
                setSnackbar({open: true, message: "Item saved successfully", severity: "success"});
                onSaved?.(persisted);
            } else {
                setSnackbar({open: true, message: result.error || "Failed to save item", severity: "error"});
            }
        } catch (err) {
            setSnackbar({open: true, message: err instanceof Error ? err.message : "Unexpected error", severity: "error"});
        } finally {
            setSaving(false);
        }
    };

    // HANDLE PRIMARY FILE SELECT
    const handlePrimaryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        /**
         * Uploads a single file as the primary image of the sale item.
         */

        const files = e.target.files;
        if (!files?.length || !formData.id) return;

        setUploadingPrimary(true);
        try {
            const fd = new FormData();
            fd.append("file", files[0]);
            fd.append("listingId", String(formData.id));
            fd.append("listingTable", "SaleItem");
            fd.append("isPrimary", "true");

            const result = await uploadListingImage(fd);
            if (result.success && result.image) {
                setImageList((prev) => [...prev, result.image!]);
            } else {
                setSnackbar({open: true, message: result.error || "Failed to upload primary image", severity: "error"});
            }
        } catch (err) {
            setSnackbar({open: true, message: err instanceof Error ? err.message : "Upload failed", severity: "error"});
        } finally {
            setUploadingPrimary(false);
            if (primaryFileInputRef.current) primaryFileInputRef.current.value = "";
        }
    };

    // HANDLE FILE SELECT
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        /**
         * Iterates over files chosen by the user, uploads each to S3 as a
         * non-primary image and appends the returned record to the local
         * list.
         */

        const files = e.target.files;
        if (!files?.length || !formData.id) return;

        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("listingId", String(formData.id));
                fd.append("listingTable", "SaleItem");
                fd.append("isPrimary", "false");

                const result = await uploadListingImage(fd);
                if (result.success && result.image) {
                    setImageList((prev) => [...prev, result.image!]);
                } else {
                    setSnackbar({open: true, message: result.error || "Failed to upload image", severity: "error"});
                }
            }
        } catch (err) {
            setSnackbar({open: true, message: err instanceof Error ? err.message : "Upload failed", severity: "error"});
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

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
            setSnackbar({open: true, message: result.error || "Failed to delete image", severity: "error"});
        }
    };

    // FLUSH PENDING CHANGES
    const flushPendingChanges = async (): Promise<{success: true; id: number} | {success: false; error: string}> => {
        /**
         * Persists the current form state and returns the database id so the
         * caller can immediately invoke a server action that reloads the row
         * (eBay publish, Facebook assist, etc.). Without this step, fields
         * the user has edited but not yet saved would be invisible to those
         * actions and would surface as confusing "missing field" errors.
         */

        const result = await saveSaleItem(formData);
        if (!result.success || !result.id) {
            return {success: false, error: result.error || "Failed to save item"};
        }
        const persisted = {...formData, id: result.id};
        setFormData(persisted);
        onSaved?.(persisted);
        return {success: true, id: result.id};
    };

    // HANDLE EBAY PUBLISH
    const handleEbayPublish = async () => {
        /**
         * Publishes or updates the sale item on eBay and stores the
         * returned URL. Saves any pending form edits first because the
         * publish action reads its inputs from the persisted row.
         */

        if (!formData.id) return;
        setEbayCreating(true);
        try {
            // persist pending edits so the freshly-picked category, price, etc.
            // are visible to the publish action when it reloads the row
            const flushed = await flushPendingChanges();
            if (!flushed.success) {
                setSnackbar({open: true, message: flushed.error, severity: "error"});
                return;
            }

            const result = await createSaleItemEbayListingAction(flushed.id);
            if (result.success && result.ebayUrl) {
                setFormData((prev) => ({...prev, eBayUrl: result.ebayUrl!}));
                setSnackbar({open: true, message: "eBay listing published successfully", severity: "success"});
            } else {
                setSnackbar({open: true, message: result.error || "eBay publish failed", severity: "error"});
            }
        } catch (err) {
            setSnackbar({open: true, message: err instanceof Error ? err.message : "eBay publish failed", severity: "error"});
        } finally {
            setEbayCreating(false);
        }
    };

    // HANDLE EBAY CANCEL
    const handleEbayCancel = async () => {
        /**
         * Cancels the currently published eBay listing and clears the
         * stored URL.
         */

        if (!formData.id || !formData.eBayUrl) return;
        setEbayCancelling(true);
        try {
            const result = await cancelSaleItemEbayListingAction(formData.id);
            if (result.success) {
                setFormData((prev) => ({...prev, eBayUrl: null, ebayItemId: null}));
                setSnackbar({open: true, message: "eBay listing cancelled successfully", severity: "success"});
            } else {
                setSnackbar({open: true, message: result.error || "eBay cancellation failed", severity: "error"});
            }
        } catch (err) {
            setSnackbar({open: true, message: err instanceof Error ? err.message : "eBay cancellation failed", severity: "error"});
        } finally {
            setEbayCancelling(false);
        }
    };

    const ebayPublishDisabled =
        !formData.id ||
        !formData.ebayCategoryId?.trim() ||
        formData.askingPrice == null ||
        formData.askingPrice < 0 ||
        imageList.length === 0 ||
        ebayCreating;

    // HANDLE FACEBOOK ASSIST
    const handleFacebookAssist = async () => {
        /**
         * Builds the pre-fill payload for Facebook Marketplace, copies the
         * description text to the clipboard, and opens Marketplace in a
         * new tab. Sale items use the generic item create wizard since
         * Facebook does not expose a per-category create flow for
         * non-vehicles.
         */

        if (!formData.id) return;
        setFacebookWorking(true);
        try {
            // persist pending edits so the marketplace payload is built from
            // the latest title/description/price the user just typed
            const flushed = await flushPendingChanges();
            if (!flushed.success) {
                setSnackbar({open: true, message: flushed.error, severity: "error"});
                return;
            }

            const result = await buildSaleItemFacebookListingPayloadAction(flushed.id);
            if (!result.success || !result.payload) {
                setSnackbar({open: true, message: result.error || "Failed to prepare Facebook listing", severity: "error"});
                return;
            }

            // copy the title + description so the user can paste it into
            // facebook's description field in one keystroke
            try {
                await navigator.clipboard.writeText(result.payload.copyText);
            } catch (err) {
                console.warn("Clipboard write failed:", err);
                setSnackbar({open: true, message: "Could not copy text — please copy it manually after opening Facebook.", severity: "error"});
            }

            window.open(result.payload.marketplaceUrl, "_blank", "noopener,noreferrer");

            const actionLabel = result.payload.mode === "edit" ? "Edit" : "New listing";
            setSnackbar({
                open: true,
                message: `Description copied to clipboard. Opened Facebook Marketplace (${actionLabel}). Remember to download photos and paste the text into the description field.`,
                severity: "success",
            });
        } catch (err) {
            setSnackbar({open: true, message: err instanceof Error ? err.message : "Facebook assist failed", severity: "error"});
        } finally {
            setFacebookWorking(false);
        }
    };

    // HANDLE FACEBOOK PHOTOS
    const handleFacebookPhotos = () => {
        /**
         * Triggers a browser download of every photo attached to the sale
         * item, zipped server-side, so the user can drag the contents
         * straight into Facebook Marketplace's photo picker.
         */

        if (!formData.id || imageList.length === 0) return;

        const a = document.createElement("a");
        a.href = `/api/auto-ads/sale-items/${formData.id}/photos.zip`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    // HANDLE SAVE FACEBOOK URL
    const handleSaveFacebookUrl = async () => {
        /**
         * Persists the Facebook Marketplace URL the user pasted back
         * after publishing the listing manually.
         */

        if (!formData.id) return;
        setFacebookUrlSaving(true);
        try {
            const trimmed = facebookUrlInput.trim();
            const toSave = trimmed.length > 0 ? trimmed : null;
            const result = await saveSaleItemFacebookUrl(formData.id, toSave);
            if (result.success) {
                setFormData((prev) => ({...prev, facebookUrl: toSave}));
                setSnackbar({
                    open: true,
                    message: toSave ? "Facebook URL saved" : "Facebook URL cleared",
                    severity: "success",
                });
            } else {
                setSnackbar({open: true, message: result.error || "Failed to save Facebook URL", severity: "error"});
            }
        } catch (err) {
            setSnackbar({open: true, message: err instanceof Error ? err.message : "Failed to save Facebook URL", severity: "error"});
        } finally {
            setFacebookUrlSaving(false);
        }
    };

    const facebookAssistDisabled =
        !formData.id ||
        !formData.title?.trim() ||
        facebookWorking;

    const facebookPhotosDisabled =
        !formData.id ||
        imageList.length === 0;

    const facebookUrlDirty = (facebookUrlInput.trim() || null) !== (formData.facebookUrl ?? null);

    // column spans: xs=12 (full), sm=6 (half), md=4 (third)
    const fieldSize = {xs: 12, sm: 6, md: 4};
    const wideFieldSize = {xs: 12};

    return (
        <Box component="form" onSubmit={handleSubmit} noValidate>
            {/* --- primary image (floated so content wraps around it) --- */}
            {formData.id ? (
                <Box sx={{float: {sm: "left"}, mr: {sm: 3}, mb: 2, textAlign: {xs: "center", sm: "left"}}}>
                    {primaryImage ? (
                        <Box
                            sx={{
                                position: "relative",
                                maxWidth: 320,
                                mx: {xs: "auto", sm: 0},
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
                                sx={{maxWidth: 320, width: "100%", height: "auto", display: "block"}}
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
                                    "&:hover": {bgcolor: "rgba(0,0,0,0.7)"},
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
                                mx: {xs: "auto", sm: 0},
                                borderRadius: 1,
                                border: "2px dashed",
                                borderColor: "divider",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: uploadingPrimary ? "default" : "pointer",
                                "&:hover": uploadingPrimary ? {} : {borderColor: "primary.main", bgcolor: "action.hover"},
                            }}
                        >
                            {uploadingPrimary ? <CircularProgress size={24} /> : <PhotoIcon color="action" sx={{fontSize: 36}} />}
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
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                    Save the item first to add a primary image.
                </Typography>
            )}

            {/* --- core item fields --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{mb: 1}}>
                Item Details
            </Typography>
            <Grid container spacing={2}>
                {formData.id ? (
                    <Grid size={fieldSize}>
                        <FormControl size="small" fullWidth>
                            <InputLabel id="sale-item-status-label">Status</InputLabel>
                            <Select
                                labelId="sale-item-status-label"
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
                ) : null}

                <Grid size={wideFieldSize}>
                    <TextField
                        label="Title"
                        size="small"
                        fullWidth
                        required
                        value={formData.title}
                        onChange={(e) => setField("title", e.target.value)}
                    />
                </Grid>

                <Grid size={wideFieldSize}>
                    <TextField
                        label="Description"
                        size="small"
                        fullWidth
                        multiline
                        minRows={3}
                        value={formData.description ?? ""}
                        onChange={(e) => setField("description", e.target.value || null)}
                    />
                </Grid>

                <Grid size={fieldSize}>
                    <TextField
                        label="Location"
                        size="small"
                        fullWidth
                        value={formData.location ?? ""}
                        onChange={(e) => setField("location", e.target.value || null)}
                    />
                </Grid>
            </Grid>

            {/* --- pricing --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{mt: 3, mb: 1}}>
                Pricing
            </Typography>
            <Grid container spacing={2}>
                <Grid size={fieldSize}>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="sale-item-currency-label">Currency</InputLabel>
                        <Select
                            labelId="sale-item-currency-label"
                            label="Currency"
                            value={formData.currencySymbol ?? "£"}
                            onChange={(e) => setField("currencySymbol", String(e.target.value))}
                        >
                            {CURRENCY_OPTIONS.map((c) => (
                                <MenuItem key={c.symbol} value={c.symbol}>{c.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid size={fieldSize}>
                    <CurrencyTextField
                        label="Asking Price"
                        size="small"
                        fullWidth
                        currencySymbol={formData.currencySymbol ?? "£"}
                        value={formData.askingPrice}
                        onChange={(v) => setField("askingPrice", v)}
                    />
                </Grid>
            </Grid>

            {/* --- listings --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{mt: 3, mb: 1}}>
                Listings
            </Typography>
            <Box sx={{display: "flex", flexDirection: "column", gap: 1}}>
                <Box sx={{display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap"}}>
                    <Typography variant="body2" sx={{minWidth: 70}}>eBay</Typography>
                    <Autocomplete
                        size="small"
                        sx={{minWidth: 200, maxWidth: 420, flex: "1 1 200px"}}
                        options={ebayCategories}
                        // resolve the currently-stored code back to its option object so the
                        // input shows the human-readable label rather than the raw code.
                        // we display `description` (the full category path) because the
                        // leaf `value` is not unique across the ebay taxonomy
                        value={ebayCategories.find((c) => c.code === formData.ebayCategoryId) ?? null}
                        getOptionLabel={(option) => option.description ?? option.value ?? option.code}
                        isOptionEqualToValue={(option, val) => option.code === val.code}
                        onChange={(_event, newValue) => {
                            setField("ebayCategoryId", newValue ? newValue.code : null);
                        }}
                        renderOption={(props, option) => {
                            // strip mui's auto-generated key (it defaults to the label and
                            // would collide on any duplicate label) and key by the unique
                            // code instead
                            const {key: _muiKey, ...liProps} = props as React.HTMLAttributes<HTMLLIElement> & {key?: React.Key};
                            return (
                                <li key={option.code} {...liProps}>
                                    {option.description ?? option.value ?? option.code}
                                </li>
                            );
                        }}
                        renderInput={(params) => (
                            <TextField {...params} label="eBay category" />
                        )}
                    />
                    {formData.eBayUrl && (
                        <Typography
                            component="a"
                            href={formData.eBayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="body2"
                            sx={{display: "flex", alignItems: "center", gap: 0.5, mr: 1}}
                        >
                            View listing <OpenInNewIcon sx={{fontSize: 14}} />
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

                <Box sx={{display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap"}}>
                    <Typography variant="body2" sx={{minWidth: 70}}>Facebook</Typography>
                    {formData.facebookUrl && (
                        <Typography
                            component="a"
                            href={formData.facebookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="body2"
                            sx={{display: "flex", alignItems: "center", gap: 0.5, mr: 1}}
                        >
                            View listing <OpenInNewIcon sx={{fontSize: 14}} />
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
                <Box sx={{display: "flex", alignItems: "center", gap: 1, pl: {xs: 0, sm: "78px"}, flexWrap: "wrap"}}>
                    <TextField
                        label="Facebook URL"
                        size="small"
                        placeholder="https://www.facebook.com/marketplace/item/…"
                        value={facebookUrlInput}
                        onChange={(e) => setFacebookUrlInput(e.target.value)}
                        sx={{minWidth: 280, maxWidth: 520, flex: "1 1 280px"}}
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
            <Box sx={{mt: 3, display: "flex", justifyContent: "flex-end"}}>
                <Button
                    type="submit"
                    variant="contained"
                    disabled={saving || !formData.title?.trim()}
                    startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
                >
                    {saving ? "Saving…" : formData.id ? "Update" : "Create"}
                </Button>
            </Box>

            {/* --- images --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{mt: 3, mb: 1}}>
                Images
            </Typography>
            {formData.id ? (
                <Box sx={{display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start"}}>
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
                                sx={{maxWidth: 320, width: "100%", height: "auto", display: "block"}}
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
                                    "&:hover": {bgcolor: "rgba(0,0,0,0.7)"},
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
                            "&:hover": uploading ? {} : {borderColor: "primary.main", bgcolor: "action.hover"},
                        }}
                    >
                        {uploading ? <CircularProgress size={24} /> : <AddPhotoAlternateIcon color="action" sx={{fontSize: 36}} />}
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
                    Save the item first to add images.
                </Typography>
            )}

            <Box
                sx={{
                    position: "fixed",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    px: {xs: 1, sm: 2},
                    pb: {xs: 1, sm: 2},
                    zIndex: (theme) => theme.zIndex.snackbar,
                    pointerEvents: "none",
                }}
            >
                <Collapse in={snackbar.open} unmountOnExit timeout="auto">
                    <Alert
                        onClose={() => setSnackbar((prev) => ({...prev, open: false}))}
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
