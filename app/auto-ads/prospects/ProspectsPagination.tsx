"use client";

import React from "react";
import {useRouter, usePathname, useSearchParams} from "next/navigation";
import {Box, Pagination, Typography} from "@mui/material";

// PROSPECTS PAGINATION
interface ProspectsPaginationProps {
    totalCount: number;
    currentPage: number;
    pageSize: number;
}

export default function ProspectsPagination({
    totalCount,
    currentPage,
    pageSize,
}: ProspectsPaginationProps) {
    /**
     * Renders pagination controls when there are more than pageSize results.
     * Updates the page search param on change while preserving other params.
     */

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    if (totalCount <= pageSize) {
        return null;
    }

    const handleChange = (_event: React.ChangeEvent<unknown>, value: number) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value <= 1) {
            params.delete("page");
        } else {
            params.set("page", String(value));
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, mt: 3, mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
                Page {currentPage} of {totalPages} ({totalCount} prospect{totalCount !== 1 ? "s" : ""})
            </Typography>
            <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handleChange}
                color="primary"
                size="medium"
                showFirstButton
                showLastButton
            />
        </Box>
    );
}
