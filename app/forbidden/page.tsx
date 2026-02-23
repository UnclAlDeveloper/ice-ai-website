"use client"

import React from "react";
import Link from "next/link";
import {Button, Typography, Box} from "@mui/material";

// PAGE
export default function Page() {
    /* Forbidden page displayed when user attempts to access a resource they don't have permission for. */

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 2}}>
            <Typography variant="h3" component="h1">
                403 Forbidden
            </Typography>
            <Typography variant="body1" sx={{textAlign: 'center', maxWidth: 600}}>
                You don't have permission to access this resource. This may be because you're not logged in,
                don't belong to the required group, or don't have the necessary tier access.
            </Typography>
            <Button variant="contained" component={Link} href="/">
                Return to Home
            </Button>
        </Box>
    );
}

