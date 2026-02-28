"use client";

import React, {useState, useEffect} from "react";
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
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import SaveIcon from "@mui/icons-material/Save";
import type {ProspectListingData} from "../manual-entry/actions";

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
    onSave: (data: ProspectListingData) => Promise<void>;
    saving: boolean;
}
/** Props accepted by the editor: current listing data, lookup options, save handler, and busy flag. */

// PROSPECT LISTING EDITOR
export default function ProspectListingEditor({data, lookupMap, onSave, saving}: ProspectListingEditorProps) {
    /**
     * Reusable form for editing prospect listing fields. Renders status as a
     * select, lookup-backed fields as freeSolo autocompletes, numbers as integer
     * inputs, and everything else as text fields. Responsive grid layout adapts
     * from single-column on phones to three columns on laptops.
     */

    const [formData, setFormData] = useState<ProspectListingData>(data);

    // reset form when the parent switches listing
    useEffect(() => {
        setFormData(data);
    }, [data]);

    // SET FIELD
    const setField = (key: keyof ProspectListingData, value: string | number | null) => {
        /**
         * Updates a single field in the local form state.
         */

        setFormData((prev) => ({...prev, [key]: value}));
    };

    // HANDLE SUBMIT
    const handleSubmit = (e: React.FormEvent) => {
        /**
         * Prevents default form submission and delegates to the onSave callback.
         */

        e.preventDefault();
        onSave(formData);
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
                    {formData.id ? "Update" : "Create"}
                </Button>
            </Box>
        </Box>
    );
}
