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
import PhotoIcon from "@mui/icons-material/Photo";
import DeleteIcon from "@mui/icons-material/Delete";
import {saveProspectListing, runAiAnalysis, getProspectAiAnalysis} from "../manual-entry/actions";
import type {ProspectListingData, VehicleType} from "../manual-entry/actions";
import SearchIcon from "@mui/icons-material/Search";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import {fetchListingImages, uploadListingImage, deleteListingImage, detectNumberplate, lookupRegistration} from "./actions";
import type {DvlaVehicleData} from "./actions";
import {deriveShortDescription} from "../lib/deriveShortDescription";
import AiAnalysisSection, {type AiAnalysisData} from "./AiAnalysisSection";

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
    pendingPrimaryImage?: File | null;
    onPendingImageConsumed?: () => void;
}
/**
 * Props accepted by the editor: current listing data, lookup options, an
 * optional callback fired after a successful save, an optional pending
 * primary image file captured before the listing was created, and a callback
 * to clear that pending file once it has been uploaded to S3.
 */

// PROSPECT LISTING EDITOR
export default function ProspectListingEditor({data, lookupMap, onSaved, pendingPrimaryImage, onPendingImageConsumed}: ProspectListingEditorProps) {
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
    const [uploadingPrimary, setUploadingPrimary] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const primaryFileInputRef = useRef<HTMLInputElement>(null);

    // ai analysis state: which prompt to use, the latest analysis fields, and whether a run is in flight
    const [vehicleType, setVehicleType] = useState<VehicleType>("Van");
    const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisData | null>(null);
    const [runningAi, setRunningAi] = useState(false);

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
            fetchListingImages("Prospect", formData.id).then((result) => {
                if (result.success && result.images) {
                    setImageList(result.images);
                }
            });
        } else {
            setImageList([]);
        }
    }, [formData.id]);

    // load existing ai analysis fields when the listing id changes so the section reflects saved output
    useEffect(() => {
        if (!formData.id) {
            setAiAnalysis(null);
            return;
        }
        getProspectAiAnalysis(formData.id).then((result) => {
            if (result.success && result.fields) {
                setAiAnalysis(result.fields);
            } else {
                setAiAnalysis(null);
            }
        });
    }, [formData.id]);

    const [lookingUp, setLookingUp] = useState(false);

    // SET FIELD
    const setField = (key: keyof ProspectListingData, value: string | number | boolean | null) => {
        /**
         * Updates a single field in the local form state.
         */

        setFormData((prev) => ({...prev, [key]: value}));
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
            const next = {...prev};
            const keys = Object.keys(dvla) as (keyof DvlaVehicleData)[];
            for (const key of keys) {
                const dvlaValue = dvla[key];
                if (dvlaValue == null) continue;
                const current = prev[key as keyof ProspectListingData];
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

            return next as ProspectListingData;
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
                setSnackbar({open: true, message: `DVLA lookup complete — ${filled} field${filled !== 1 ? "s" : ""} populated`, severity: "success"});
            } else {
                setSnackbar({open: true, message: result.error || "DVLA lookup failed", severity: "error"});
            }
        } catch (err) {
            setSnackbar({open: true, message: err instanceof Error ? err.message : "DVLA lookup failed", severity: "error"});
        } finally {
            setLookingUp(false);
        }
    };

    // HANDLE SUBMIT
    const handleSubmit = async (e: React.FormEvent) => {
        /**
         * Inserts or updates the prospect listing via the server action. On a
         * successful insert the pending primary image (if any) is uploaded to
         * S3 and linked to the new listing before notifying the parent.
         */

        e.preventDefault();
        setSaving(true);
        try {
            const result = await saveProspectListing(formData);
            if (result.success && result.id) {
                // upload the pending primary image now that the listing has an id
                if (pendingPrimaryImage) {
                    const fd = new FormData();
                    fd.append("file", pendingPrimaryImage);
                    fd.append("listingId", String(result.id));
                    fd.append("listingTable", "Prospect");
                    fd.append("isPrimary", "true");
                    const uploadResult = await uploadListingImage(fd);
                    if (uploadResult.success && uploadResult.image) {
                        setImageList((prev) => [...prev, uploadResult.image!]);
                    }
                    onPendingImageConsumed?.();
                }

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
                fd.append("listingTable", "Prospect");
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
            fd.append("listingTable", "Prospect");
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
                                setSnackbar({open: true, message: `Plate ${plateResult.numberplate} detected — ${filled} field${filled !== 1 ? "s" : ""} populated via DVLA`, severity: "success"});
                            } else {
                                setSnackbar({open: true, message: `Numberplate detected: ${plateResult.numberplate}`, severity: "success"});
                            }
                        }
                    });
                }
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

    // HANDLE RUN AI ANALYSIS
    const handleRunAiAnalysis = async () => {
        /**
         * Calls the runAiAnalysis server action with the currently selected
         * vehicle type, then updates the local AI Assistant section with
         * the freshly persisted fields. Disabled until the listing has been
         * saved (so a database id exists to attach the results to).
         */

        if (!formData.id) {
            setSnackbar({open: true, message: "Save the listing before running AI analysis", severity: "error"});
            return;
        }

        setRunningAi(true);
        try {
            const result = await runAiAnalysis(formData.id, vehicleType);
            if (result.success && result.fields) {
                setAiAnalysis(result.fields);
                setSnackbar({open: true, message: "AI analysis complete", severity: "success"});
            } else {
                setSnackbar({open: true, message: result.error || "AI analysis failed", severity: "error"});
            }
        } catch (err) {
            setSnackbar({open: true, message: err instanceof Error ? err.message : "AI analysis failed", severity: "error"});
        } finally {
            setRunningAi(false);
        }
    };

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
            ) : pendingPreviewUrl ? (
                <Box sx={{float: {sm: "left"}, mr: {sm: 3}, mb: 2, textAlign: {xs: "center", sm: "left"}}}>
                    <Box
                        sx={{
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
                            src={pendingPreviewUrl}
                            alt="Primary (pending upload)"
                            sx={{maxWidth: 320, width: "100%", height: "auto", display: "block"}}
                        />
                    </Box>
                </Box>
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                    Save the listing first to add a primary image.
                </Typography>
            )}

            {/* --- vehicle identity --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{mb: 1}}>
                Vehicle Identity
            </Typography>
            <Grid container spacing={2}>
                <Grid size={fieldSize}>
                    <Box sx={{display: "flex", gap: 1}}>
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
                            sx={{minWidth: 0, px: 1.5, whiteSpace: "nowrap"}}
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


            {/* --- tax and emissions --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{mt: 3, mb: 1}}>
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
                        slotProps={{inputLabel: {shrink: true}}}
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
                        slotProps={{inputLabel: {shrink: true}}}
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

            {/* --- ai analysis --- */}
            <Typography variant="subtitle2" color="text.secondary" sx={{mt: 3, mb: 1}}>
                AI Analysis
            </Typography>
            {formData.id ? (
                <>
                    <Box sx={{display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 2}}>
                        <FormControl size="small" sx={{minWidth: 140}}>
                            <InputLabel id="vehicle-type-label">Vehicle Type</InputLabel>
                            <Select
                                labelId="vehicle-type-label"
                                label="Vehicle Type"
                                value={vehicleType}
                                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                            >
                                <MenuItem value="Car">Car</MenuItem>
                                <MenuItem value="Van">Van</MenuItem>
                            </Select>
                        </FormControl>
                        <Button
                            type="button"
                            variant="outlined"
                            disabled={runningAi}
                            onClick={handleRunAiAnalysis}
                            startIcon={runningAi ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                        >
                            {runningAi ? "Analysing…" : "Do AI Analysis"}
                        </Button>
                    </Box>
                    {aiAnalysis && (
                        <AiAnalysisSection
                            data={aiAnalysis}
                            askingPrice={formData.askingPrice}
                            currencySymbol={formData.currencySymbol}
                            canViewPricing
                            defaultExpanded
                        />
                    )}
                </>
            ) : (
                <Typography variant="body2" color="text.secondary">
                    Save the listing first to run AI analysis.
                </Typography>
            )}

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
