"use client";

import Image from "next/image";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {ThemeProvider} from '@mui/material/styles';
import {logoTheme} from '@app/ui/logoTheme';
import Stack from "@mui/material/Stack";

// LARGE LOGO
export default function LargeLogo() {
    /* Component that displays the large logo with the company name and tagline. */
    
    return (
        <div>
            <ThemeProvider theme={logoTheme}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{
                        position: 'relative',
                        width: {xs: '64px', sm: '92px', lg: '120px'},
                        height: {xs: '80px', sm: '115px', lg: '150px'}
                    }}
                    >
                        <Image
                            src='/quill-and-chart-logo.png'
                            alt="Logo"
                            fill
                            sizes="150px"
                            style={{objectFit: 'contain'}}
                        />
                    </Box>
                    <Stack
                        spacing={0}
                    >
                        <Typography variant="h1" sx={{
                            lineHeight: 0.8,
                            fontSize: {xs: 70, sm: 105, lg: 140},
                        }}>
                            Unc&apos;l Al
                        </Typography>
                        <Typography variant="h2" sx={{
                            fontSize: {xs: 28, sm: 42, lg: 56},
                        }}>
                            <strong>Unc</strong>orre<strong>l</strong>ated <strong>Al</strong>pha
                        </Typography>
                    </Stack>
                </Stack>
            </ThemeProvider>
        </div>
    )
        ;
}