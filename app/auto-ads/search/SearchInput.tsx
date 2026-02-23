"use client";

import React, {useState, useEffect, useCallback, useRef} from "react";
import {useRouter, useSearchParams, usePathname} from "next/navigation";
import {IconButton, Box, CircularProgress, Autocomplete, TextField, Tooltip} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import {getSavedSearches, saveSearch, recordSavedSearchUsed} from "./actions";

// SEARCH INPUT
export default function SearchInput() {
    /**
     * Client component providing a text input with dropdown of saved searches, a save-search
     * button, and a search button. Updates the URL search param 'q' on submit or when a
     * saved search is selected; records last-used when a saved search is used.
     */

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const urlQuery = searchParams.get("q") || "";

    const [query, setQuery] = useState(urlQuery);
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedSearches, setSavedSearches] = useState<{id: number; query: string}[]>([]);
    const pendingQueryRef = useRef<string | null>(null);

    const refreshSavedSearches = useCallback(async () => {
        const list = await getSavedSearches();
        setSavedSearches(list);
    }, []);

    // load saved searches on mount
    useEffect(() => {
        refreshSavedSearches();
    }, [refreshSavedSearches]);

    // reset spinner when navigation completes and url params update
    useEffect(() => {
        // check if the current urlQuery matches what we're waiting for
        if (pendingQueryRef.current !== null && pendingQueryRef.current === urlQuery) {
            setIsSearching(false);
            pendingQueryRef.current = null;
        }
        setQuery(urlQuery);
    }, [urlQuery, searchParams]);

    const navigateWithQuery = useCallback(
        (trimmed: string) => {
            setIsSearching(true);
            pendingQueryRef.current = trimmed;
            const params = new URLSearchParams(searchParams.toString());
            params.set("q", trimmed);
            
            // if the query is the same as current, add a timestamp to force navigation
            // the server will ignore this _t param, but it ensures navigation event fires
            // and searchParams updates, which triggers the useEffect to reset the spinner
            if (urlQuery === trimmed) {
                params.set("_t", Date.now().toString());
            } else {
                params.delete("_t");
            }
            
            const newUrl = `${pathname}?${params.toString()}`;
            router.push(newUrl);
        },
        [pathname, router, searchParams, urlQuery]
    );

    const queryStr = query ?? "";

    // handle search submission (Enter or search button)
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = queryStr.trim();
        if (!trimmed) return;

        const match = savedSearches.find((s) => s.query === trimmed);
        if (match) {
            recordSavedSearchUsed(match.id).then(() => refreshSavedSearches());
        }

        navigateWithQuery(trimmed);
    };

    // handle selecting a saved search from the dropdown (freeSolo can pass string; ignore unless option object)
    const handleOptionSelect = (
        _e: React.SyntheticEvent,
        value: {id: number; query: string} | string | null
    ) => {
        if (value == null || typeof value === "string") return;

        setQuery(value.query);
        recordSavedSearchUsed(value.id).then(() => refreshSavedSearches());
        navigateWithQuery(value.query);
    };

    const handleSaveSearch = async () => {
        const trimmed = queryStr.trim();
        if (!trimmed || isSaving) return;

        setIsSaving(true);
        try {
            await saveSearch(trimmed);
            await refreshSavedSearches();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mt: 2,
                mb: 3,
                maxWidth: 600,
            }}
        >
            <Autocomplete
                freeSolo
                options={savedSearches}
                getOptionLabel={(option) =>
                    typeof option === "string" ? option : option.query
                }
                inputValue={queryStr}
                onInputChange={(_, newValue) => {
                    setQuery(newValue);
                    setIsSearching(false);
                }}
                onChange={handleOptionSelect}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        size="small"
                        placeholder='e.g. "Ford Transits for less than 3,000"'
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                (e.target as HTMLInputElement).form?.requestSubmit();
                            }
                        }}
                        slotProps={{
                            input: {
                                ...params.InputProps,
                                sx: {fontSize: "0.95rem"},
                            },
                        }}
                    />
                )}
                sx={{flex: 1, minWidth: 0}}
            />
            <Tooltip title="Save search">
                <span>
                    <IconButton
                        type="button"
                        onClick={handleSaveSearch}
                        disabled={!queryStr.trim() || isSaving}
                        sx={{flexShrink: 0}}
                    >
                        {isSaving ? (
                            <CircularProgress size={24} />
                        ) : (
                            <BookmarkAddIcon />
                        )}
                    </IconButton>
                </span>
            </Tooltip>
            <IconButton
                type="submit"
                color="primary"
                disabled={!queryStr.trim() || isSearching}
                sx={{flexShrink: 0}}
            >
                {isSearching ? <CircularProgress size={24} /> : <SearchIcon />}
            </IconButton>
        </Box>
    );
}
