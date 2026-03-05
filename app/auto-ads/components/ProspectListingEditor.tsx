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
    Snackbar,
    Alert,
    IconButton,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import SaveIcon from "@mui/icons-material/Save";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import DeleteIcon from "@mui/icons-material/Delete";
import {saveProspectListing} from "../manual-entry/actions";
import type {ProspectListingData} from "../manual-entry/actions";
import {fetchListingImages, uploadListingImage, deleteListingImage} from "./actions";

// STATUS OPTIONS
const STATUS_OPTIONS = ["New", "Viewed", "Not Interested", "Interested", "Bought", "Sold"] as const;
/** All possible prospect listing statuses matching the database enum. */

// AUTOCOMPLETE FIELD CONFIG
const AUTOCOMPLETE_FIELDS: {key: keyof ProspectListingData; label: string; lookupType: string}[] = [
    {key: "makeAndModel", label: "Make & Model", lookupType: "make_and_model"},
    {key: "location", label: "Location", lookupType: "location"},
    {key: "bodyType", label: "Body Type", lookupType: "body_type"},
    {key: "cabType", label: "Cab Type", lookupType: "cab_type"},
    {key: "fuelType", label: "Fuel Type", lookupType: "fuel_type"},
    {key: "gearboxType", label: "Gearbox Type", lookupType: "gearbox_type"},
    {key: "wheelbase", label: "Wheelbase", lookupType: "wheelbase"},
    {key: "engineSize", label: "Engine Size", lookupType: "engine_size"},
    {key: "colour", label: "Colour", lookupType: "colour"},
    {key: "emissionClass", label: "Emission Class", lookupType: "emission_class"},
];
/** Maps each autocomplete-enabled field to its display label and lookups table key. */

// INTEGER FIELD CONFIG
const INTEGER_FIELDS: {key: keyof ProspectListingData; label: string}[] = [
    {key: "seats", label: "Seats"},
    {key: "mileage", label: "Mileage"},
    {key: "year", label: "Year"},
    {key: "numberOfOwners", label: "Number of Owners"},
];
/** Fields rendered as number inputs. */

// TEXT FIELD CONFIG
const TEXT_FIELDS: {key: keyof ProspectListingData; label: string; multiline?: boolean}[] = [
    {key: "shortDescription", label: "Short Description"},
    {key: "registration", label: "Registration"},
    {key: "mileageUnit", label: "Mileage Unit"},
    {key: "serviceHistory", label: "Service History"},
    {key: "basicHistoryCheck", label: "Basic History Check"},
    {key: "motStatus", label: "MOT Status"},
    {key: "motExpiry", label: "MOT Expiry"},
    {key: "fullDescription", label: "Full Description", multiline: true},
    {key: "specsAndFeatures", label: "Specs & Features", multiline: true},
];
/** Fields rendered as plain text inputs, with optional multiline flag. */

// PROSPECT LISTING EDITOR PROPS
interface ProspectListingEditorProps {
    data: ProspectListingData;
    lookupMap: Record<string, string[]>;
    onSaved?: (data: ProspectListingData) => void;
}
/**
 * Props accepted by the editor: current listing data, lookup options, and an
 * optional callback fired after a successful save with the persisted data
 * (including the assigned id for new records).
 */

// PROSPECT LISTING EDITOR
export default function ProspectListingEditor({data, lookupMap, onSaved}: ProspectListingEditorProps) {
    /**
     * Reusable form for editing prospect listing fields. Calls the
     * saveProspectListing server action directly so the record is always
     * flushed and committed, returning the database id for new inserts.
     * Responsive grid layout adapts from single-column on phones to three
     * columns on laptops.
     */

    const [formData, setFormData] = useState<ProspectListingData>(data);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: "success" | "error"}>({
        open: false,
        message: "",
        severity: "success",
    });
    const [imageList, setImageList] = useState<{id: number; url: string; isPrimary: boolean | null}[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // reset form when the parent switches listing
    useEffect(() => {
        setFormData(data);
    }, [data]);

    // load images when the listing id is available or changes
    useEffect(() => {
        if (formData.id) {
            fetchListingImages("Prospect", formData.id).then((result) => {
                if (result.success && result.images) {
                    setImageList(result.images);
                }
            });
        } else {
            setImageList([]);
        }
    }, [formData.id]);

    // SET FIELD
    const setField = (key: keyof ProspectListingData, value: string | number | null) => {
        /**
         * Updates a single field in the local form state.
         */

        setFormData((prev) => ({...prev, [key]: value}));
    };

    // HANDLE SUBMIT
    const handleSubmit = async (e: React.FormEvent) => {
        /**
         * Inserts or updates the prospect listing via the server action. On a
         * successful insert the returned id is merged into the local form state
         * so subsequent saves become updates. Notifies the parent via onSaved.
         */

        e.preventDefault();
        setSaving(true);
        try {
            const result = await saveProspectListing(formData);
            if (result.success && result.id) {
                const persisted = {...formData, id: result.id};
                setFormData(persisted);
                setSnackbar({open: true, message: "Listing saved successfully", severity: "success"});
                onSaved?.(persisted);
            } else {
                setSnackbar({open: true, message: result.error || "Failed to save listing", severity: "error"});
            }
        } catch (err) {
            setSnackbar({open: true, message: err instanceof Error ? err.message : "Unexpected error", severity: "error"});
        } finally {
            setSaving(false);
        }
    };

    // HANDLE FILE SELECT
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        /**
         * Iterates over files chosen by the user, uploads each to S3 via the
         * server action, and appends the returned image record to the local list.
         */

        const files = e.target.files;
        if (!files?.length || !formData.id) return;

        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("listingId", String(formData.id));
                fd.append("listingTable", "Prospect");

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

    // column spans: xs=12 (full), sm=6 (half), md=4 (third)
    const fieldSize = {xs: 12, sm: 6, md: 4};
    const wideFieldSize = {xs: 12};

    return (
        <Box component="form" onSubmit={handleSubmit} noValidate>
            {/* --- vehicle identity --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{mb: 1}}>
                Vehicle Identity
            </Typography>
            <Grid container spacing={2}>
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
            <Typography variant="subtitle2" color="text.secondary" sx={{mt: 3, mb: 1}}>
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

                <Grid size={fieldSize}>
                    <TextField
                        label="Registration"
                        size="small"
                        fullWidth
                        value={formData.registration ?? ""}
                        onChange={(e) => setField("registration", e.target.value || null)}
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
            <Typography variant="subtitle2" color="text.secondary" sx={{mt: 3, mb: 1}}>
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
            <Typography variant="subtitle2" color="text.secondary" sx={{mt: 3, mb: 1}}>
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
                        slotProps={{inputLabel: {shrink: true}}}
                    />
                </Grid>
            </Grid>


            {/* --- descriptions --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{mt: 3, mb: 1}}>
                Descriptions
            </Typography>
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

            {/* --- save --- */}
            <Box sx={{mt: 3, display: "flex", justifyContent: "flex-end"}}>
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
            <Typography variant="subtitle2" color="text.secondary" sx={{mt: 3, mb: 1}}>
                Images
            </Typography>
            {formData.id ? (
                <Box sx={{display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start"}}>
                    {imageList.map((img) => (
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
                    Save the listing first to add images.
                </Typography>
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
