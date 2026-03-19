"use client";

import React from "react";
import {useRouter, useSearchParams, usePathname} from "next/navigation";
import {Select, MenuItem, FormControl, InputLabel, SelectChangeEvent} from "@mui/material";

// FILTER DROPDOWN
export default function FilterDropdown() {
    /**
     * Client component that provides a dropdown filter for prospects.
     * Updates the URL search params when the filter changes.
     */

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const filter = searchParams.get("filter") || "suggested";

    const handleChange = (event: SelectChangeEvent) => {
        const newFilter = event.target.value;
        const params = new URLSearchParams(searchParams.toString());
        params.set("filter", newFilter);
        params.delete("page");
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="filter-label">Filter:</InputLabel>
            <Select
                labelId="filter-label"
                value={filter}
                label="Filter:"
                onChange={handleChange}
            >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="suggested">Suggested</MenuItem>
                <MenuItem value="campervan-conversions">Campervan Conversions</MenuItem>
                <MenuItem value="classic-cars">Classic Cars</MenuItem>
                <MenuItem value="stock">Stock</MenuItem>
            </Select>
        </FormControl>
    );
}
