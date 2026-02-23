"use client";

import {useState, useMemo, useTransition} from "react";
import {
    Box,
    IconButton,
    Stack,
    Typography,
    Button,
    Tooltip,
    FormControl,
    Select,
    MenuItem,
    InputLabel,
    CircularProgress,
    Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {savePreferredLanguages} from "./actions";

// TYPES
interface Language {
    code: string;
    language: string;
}

interface PreferredLanguage {
    id: number;
    languageCode: string;
    owner: string;
    createdAt: Date | null;
    updatedAt: Date | null;
    language: Language;
}

interface PreferencesClientProps {
    initialPreferredLanguages: PreferredLanguage[];
    allLanguages: Language[];
}

// PREFERENCES CLIENT
export default function PreferencesClient({
    initialPreferredLanguages,
    allLanguages,
}: PreferencesClientProps) {
    /**
     * Client component for managing language preferences.
     * Handles staged changes (pending adds/deletes) before saving to the database.
     */

    const [preferredLanguages, setPreferredLanguages] = useState(initialPreferredLanguages);
    const [pendingAdds, setPendingAdds] = useState<string[]>([]);
    const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(new Set());
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // build language code to label map
    const languageCodeToLabelMap = useMemo(() => {
        const map = new Map<string, string>();
        allLanguages.forEach((lang) => map.set(lang.code, lang.language));
        return map;
    }, [allLanguages]);

    // filter out languages that are already selected or pending
    const availableLanguages = useMemo(() => {
        const existingCodes = new Set(preferredLanguages.map((p) => p.languageCode));
        const pendingCodes = new Set(pendingAdds);
        return allLanguages.filter(
            (lang) => !existingCodes.has(lang.code) && !pendingCodes.has(lang.code),
        );
    }, [allLanguages, preferredLanguages, pendingAdds]);

    // visible existing languages (excluding those marked for deletion)
    const visibleExisting = useMemo(
        () => preferredLanguages.filter((row) => !pendingDeletes.has(row.id)),
        [preferredLanguages, pendingDeletes],
    );

    // HANDLE ADD
    const handleAdd = (code: string): boolean => {
        /**
         * Adds a language code to the pending additions list if not already present.
         */

        if (!code) return false;

        const alreadyExists = preferredLanguages.some((r) => r.languageCode === code);
        const alreadyPending = pendingAdds.includes(code);

        if (!alreadyExists && !alreadyPending) {
            setPendingAdds((prev) => [...prev, code]);
            return true;
        }
        return false;
    };

    // TOGGLE DELETE EXISTING
    const toggleDeleteExisting = (id: number) => {
        /**
         * Toggles a preferred language's deletion status in the pending deletes set.
         */

        setPendingDeletes((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // REMOVE PENDING ADD
    const removePendingAdd = (code: string) => {
        /**
         * Removes a language code from the pending additions list.
         */

        setPendingAdds((prev) => prev.filter((c) => c !== code));
    };

    // HANDLE SAVE
    const handleSave = () => {
        /**
         * Saves all pending changes to the database using the server action.
         */

        setError(null);

        startTransition(async () => {
            try {
                const updatedPreferences = await savePreferredLanguages(
                    pendingAdds,
                    Array.from(pendingDeletes),
                );

                // update local state with fresh data from the database
                setPreferredLanguages(updatedPreferences);
                setPendingAdds([]);
                setPendingDeletes(new Set());
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to save preferences");
            }
        });
    };

    // GET LANGUAGE LABEL
    const getLanguageLabel = (code: string) => languageCodeToLabelMap.get(code) ?? code;

    const hasChanges = pendingAdds.length > 0 || pendingDeletes.size > 0;

    return (
        <Stack spacing={1} sx={{mt: {xs: 2, sm: 3}, width: "100%", maxWidth: 640}}>
            <Typography variant="h5" component="h2" gutterBottom sx={{color: "primary.main"}}>
                Language Preferences
            </Typography>

            {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Stack>
                {visibleExisting.map((row) => (
                    <Box
                        key={row.id}
                        sx={{display: "flex", alignItems: "center", gap: 0.5, px: 0.5}}
                    >
                        <Tooltip title="Remove">
                            <IconButton
                                aria-label="remove"
                                color={pendingDeletes.has(row.id) ? "warning" : "error"}
                                onClick={() => toggleDeleteExisting(row.id)}
                            >
                                <RemoveIcon />
                            </IconButton>
                        </Tooltip>
                        <Box sx={{flex: 1, px: 0.5}}>
                            <Typography variant="body1">
                                {getLanguageLabel(row.languageCode)}
                            </Typography>
                        </Box>
                    </Box>
                ))}

                {visibleExisting.length === 0 && pendingAdds.length === 0 && (
                    <Typography variant="body2">No preferred languages set.</Typography>
                )}

                {pendingAdds.map((code) => (
                    <Box
                        key={`new-${code}`}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            px: 0.5,
                            py: 0.5,
                        }}
                    >
                        <Tooltip title="Remove">
                            <IconButton
                                aria-label="remove"
                                color="error"
                                onClick={() => removePendingAdd(code)}
                            >
                                <RemoveIcon />
                            </IconButton>
                        </Tooltip>
                        <Box sx={{flex: 1, px: 0.5}}>
                            <Typography variant="body1">{getLanguageLabel(code)}</Typography>
                        </Box>
                    </Box>
                ))}
            </Stack>

            <AddLanguageRow
                availableLanguages={availableLanguages}
                onAdd={handleAdd}
            />

            <Box>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSave}
                    disabled={isPending || !hasChanges}
                    startIcon={isPending ? <CircularProgress size={16} /> : undefined}
                >
                    {isPending ? "Saving..." : "Save"}
                </Button>
            </Box>
        </Stack>
    );
}

// ADD LANGUAGE ROW
interface AddLanguageRowProps {
    availableLanguages: Language[];
    onAdd: (code: string) => boolean;
}

function AddLanguageRow({availableLanguages, onAdd}: AddLanguageRowProps) {
    /**
     * Row component for selecting and adding a new language to preferences.
     */

    const [selected, setSelected] = useState("");

    const handleAddClick = () => {
        if (!selected) return;
        const added = onAdd(selected);
        if (added) setSelected("");
    };

    return (
        <Box sx={{display: "flex", alignItems: "center", gap: 0.5, px: 0.5, py: 0.5}}>
            <Tooltip title="Add">
                <IconButton aria-label="add" color="success" onClick={handleAddClick}>
                    <AddIcon />
                </IconButton>
            </Tooltip>
            <FormControl size="small" sx={{minWidth: 200}}>
                <InputLabel id="language-select-label">Select Language</InputLabel>
                <Select
                    labelId="language-select-label"
                    value={selected}
                    label="Select Language"
                    onChange={(e) => setSelected(e.target.value)}
                >
                    {availableLanguages.map((lang) => (
                        <MenuItem key={lang.code} value={lang.code}>
                            {lang.language}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
}
