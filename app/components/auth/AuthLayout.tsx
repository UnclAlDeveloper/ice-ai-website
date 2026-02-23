'use client';

import {PropsWithChildren} from "react";
import {Box, Link, Paper, Stack, Typography, useTheme} from "@mui/material";

interface AuthLayoutProps extends PropsWithChildren {
    /* Props for AuthLayout component including title, optional subtitle, and children. */

    title: string;
    subtitle?: string;
}

// AUTH LAYOUT
export default function AuthLayout({title, subtitle, children}: AuthLayoutProps) {
    /* Reusable layout for authentication pages that applies branding from the current theme and centers the content. */

    const theme = useTheme();

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                mt: {xs: 4, md: 6},
                mb: {xs: 4, md: 6},
            }}
        >
            <Paper
                elevation={4}
                sx={{
                    maxWidth: 480,
                    width: "100%",
                    p: 0,
                    overflow: 'hidden',
                }}
            >
                <Stack spacing={0}>
                    <Link
                        href="/"
                        underline="none"
                        sx={{
                            textDecoration: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            justifyContent="center"
                            sx={{
                                backgroundColor: theme.custom.appBarBackground,
                                px: 2,
                                py: 1.5,
                            }}
                        >
                            <Box
                                component="img"
                                src={theme.custom.logo}
                                alt={theme.custom.altLogo}
                                sx={{height: 40}}
                            />
                            {theme.custom.logoText && (
                                <Typography
                                    component="span"
                                    sx={{
                                        color: theme.custom.logoTextColor,
                                        fontFamily: theme.custom.logoTextFont,
                                        fontSize: theme.custom.logoTextSize,
                                    }}
                                >
                                    {theme.custom.logoText}
                                </Typography>
                            )}
                        </Stack>
                    </Link>

                    <Stack spacing={0.5} alignItems="center" sx={{ px: 4, pt: 3 }}>
                        <Typography variant="h5">{title}</Typography>
                        {subtitle && (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                align="center"
                            >
                                {subtitle}
                            </Typography>
                        )}
                    </Stack>

                    <Box sx={{ px: 4, pb: 4 }}>
                        {children}
                    </Box>
                </Stack>
            </Paper>
        </Box>
    );
}


