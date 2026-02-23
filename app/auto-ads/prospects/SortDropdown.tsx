"use client";

import React from "react";
import {useRouter, useSearchParams, usePathname} from "next/navigation";
import {Select, MenuItem, FormControl, InputLabel, SelectChangeEvent} from "@mui/material";

// SORT DROPDOWN
export default function SortDropdown() {
    /**
     * Client component that provides a dropdown to sort prospects.
     * Updates the URL search params when the sort option changes.
     */

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const sort = searchParams.get("sort") || "suggested";

    const handleChange = (event: SelectChangeEvent) => {
        const newSort = event.target.value;
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", newSort);
        params.delete("page");
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="sort-label">Sort:</InputLabel>
            <Select
                labelId="sort-label"
                value={sort}
                label="Sort:"
                onChange={handleChange}
            >
                <MenuItem value="suggested">Suggested</MenuItem>
                <MenuItem value="latest">Latest</MenuItem>
                <MenuItem value="alphabetical">Alphabetical</MenuItem>
            </Select>
        </FormControl>
    );
}
