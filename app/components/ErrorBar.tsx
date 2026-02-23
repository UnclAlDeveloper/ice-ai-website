"use client";

import React from "react";
import {Box, Typography, Paper} from "@mui/material";

// ERROR BAR
interface ErrorBarProps {
    error: string | null;
}

export default function ErrorBar({error}: ErrorBarProps) {
    /**
     * Displays an error bar at the bottom of the screen when an error occurs.
     * The bar is invisible when no error is present, expands to fit error content
     * up to 8 lines, and scrolls if the content exceeds that.
     */

    if (!error) {
        return null;
    }

    const maxVisibleLines = 8;

    return (
        <Paper
            elevation={3}
            sx={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'error.dark',
                color: 'error.contrastText',
                zIndex: 1300,
                maxHeight: `${maxVisibleLines * 1.5 + 1}em`,
                overflowY: 'auto',
                borderTop: '2px solid',
                borderColor: 'error.main',
            }}
        >
            <Box sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Error:
                </Typography>
                <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        margin: 0,
                        overflow: 'visible',
                    }}
                >
                    {error}
                </Typography>
            </Box>
        </Paper>
    );
}
