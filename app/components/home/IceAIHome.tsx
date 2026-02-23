'use client';

import React from "react";
import Box from "@mui/material/Box";
import Image from "next/image";

// ICE AI HOME
export default function IceAIHome() {
    /* Home page component for IceAI app that displays the ice-ai logo centered on the screen. */

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 'calc(100vh - 200px)',
                mt: '36px',
            }}
        >
            <Box
                sx={{
                    position: 'relative',
                    width: {xs: 300, sm: 450, lg: 600},
                    height: {xs: 200, sm: 300, lg: 400},
                }}
            >
                <Image
                    src="/images/ice-ai-logo.png"
                    alt="ice-ai logo"
                    fill
                    sizes="600px"
                    style={{objectFit: 'contain'}}
                />
            </Box>
        </Box>
    );
}

