"use client";

import React from "react";
import {Card, CardContent, Stack, Typography, Link, Box} from "@mui/material";
import {alpha} from "@mui/material/styles";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import FacebookIcon from "@mui/icons-material/Facebook";
import Image from "next/image";

// OWNER IMAGE ASPECT RATIO (matches the 768x1024 source)
const OWNER_IMAGE_ASPECT_RATIO = "3 / 4";

// EBAY LOGO SRC (reused brand mark from the listing source logos)
const EBAY_LOGO_SRC = "/images/auto-ads/sources/ebay.png";

// OWNER CARD PROPS
interface OwnerCardProps {
    /* Props for the OwnerCard with all owner-specific values supplied by the
       parent server component from environment variables so this client
       component carries no hard coded personal details. */

    name?: string;
    phone?: string;
    email?: string;
    facebookUrl?: string;
    ebayUrl?: string;
    imageSrc?: string;
}

// NORMALIZE PUBLIC PATH
const normalizePublicPath = (value: string | undefined): string | undefined => {
    /**
     * Ensures the supplied path is rooted under the next/image public
     * folder. Environment values may be entered with or without a leading
     * slash (for example "images/foo.jpg" or "/images/foo.jpg") so this
     * helper unifies them. Returns undefined when the input is empty.
     */

    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

// OWNER CARD
export default function OwnerCard({
    name,
    phone,
    email,
    facebookUrl,
    ebayUrl,
    imageSrc,
}: OwnerCardProps) {
    /**
     * Header card for the Auto Ads home page that introduces the owner
     * with a caricature portrait alongside their name and the four
     * primary contact channels: phone, email, Facebook profile and
     * eBay. All values are supplied by the server-side parent from the
     * AUTO_ADS_* environment variables, and any row whose env value is
     * missing is hidden instead of showing an empty placeholder. The
     * portrait remains on the left across viewport sizes, while contact
     * rows use tighter spacing on phones so the full card fits within
     * narrow screens.
     */

    // resolve optional inputs to renderable forms; treat empty strings as absent
    const resolvedImageSrc = normalizePublicPath(imageSrc);
    const trimmedName = name?.trim() || "";
    const trimmedPhone = phone?.trim() || "";
    const trimmedEmail = email?.trim() || "";
    const trimmedFacebookUrl = facebookUrl?.trim() || "";
    const trimmedEbayUrl = ebayUrl?.trim() || "";

    return (
        <Card
            sx={{
                mt: 0.5,
                mb: 0.5,
                width: "100%",
                maxWidth: "100%",
                overflow: "hidden",
                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.5),
            }}
        >
            <CardContent sx={{py: 0.75, px: {xs: 1, sm: 1.5}, "&:last-child": {pb: 0.75}}}>
                <Stack
                    direction="row"
                    spacing={{xs: 1.25, sm: 3}}
                    alignItems="center"
                    sx={{minWidth: 0, width: "100%"}}
                >
                    {resolvedImageSrc && (
                        // caricature portrait of the owner, kept at the source 3:4 aspect
                        // ratio and kept at a consistent height across breakpoints so
                        // mobile and desktop show the portrait at the same visual size
                        <Box
                            sx={{
                                position: "relative",
                                height: {xs: 112, sm: 150},
                                aspectRatio: OWNER_IMAGE_ASPECT_RATIO,
                                flexShrink: 0,
                                borderRadius: 2,
                                overflow: "hidden",
                                bgcolor: "transparent",
                            }}
                        >
                            <Image
                                src={resolvedImageSrc}
                                alt={trimmedName ? `${trimmedName} caricature portrait` : "Owner caricature portrait"}
                                fill
                                sizes="113px"
                                style={{objectFit: "contain"}}
                                priority
                            />
                        </Box>
                    )}

                    {/* contact column: name on top with phone, email, facebook and ebay stacked beneath */}
                    <Stack
                        spacing={{xs: 0.25, sm: 1}}
                        alignItems="flex-start"
                        sx={{textAlign: "left", minWidth: 0, flex: 1}}
                    >
                        {trimmedName && (
                            <Typography
                                variant="h5"
                                component="div"
                                sx={{fontSize: {xs: "1.25rem", sm: "1.5rem"}, lineHeight: 1.2}}
                            >
                                {trimmedName}
                            </Typography>
                        )}

                        {trimmedPhone && (
                            <Stack direction="row" spacing={{xs: 0.5, sm: 1}} alignItems="center" sx={{minWidth: 0, flexWrap: "wrap"}}>
                                <PhoneIcon fontSize="small" color="action" />
                                <Link
                                    href={`tel:${trimmedPhone.replace(/\s+/g, "")}`}
                                    underline="hover"
                                    color="inherit"
                                    sx={{fontSize: {xs: "0.9rem", sm: "1rem"}}}
                                >
                                    {trimmedPhone}
                                </Link>
                            </Stack>
                        )}

                        {trimmedEmail && (
                            <Stack direction="row" spacing={{xs: 0.5, sm: 1}} alignItems="center" sx={{minWidth: 0, flexWrap: "wrap"}}>
                                <EmailIcon fontSize="small" color="action" />
                                <Link
                                    href={`mailto:${trimmedEmail}`}
                                    underline="hover"
                                    color="inherit"
                                    sx={{
                                        wordBreak: "normal",
                                        overflowWrap: "anywhere",
                                        minWidth: 0,
                                        maxWidth: "100%",
                                        whiteSpace: "normal",
                                        display: "inline",
                                        fontSize: {xs: "0.9rem", sm: "1rem"},
                                    }}
                                >
                                    {trimmedEmail}
                                </Link>
                            </Stack>
                        )}

                        {trimmedFacebookUrl && (
                            <Stack direction="row" spacing={{xs: 0.5, sm: 1}} alignItems="center">
                                <FacebookIcon fontSize="small" sx={{color: "#1877F2"}} />
                                <Link
                                    href={trimmedFacebookUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    underline="hover"
                                    color="inherit"
                                    sx={{fontSize: {xs: "0.9rem", sm: "1rem"}}}
                                >
                                    Facebook
                                </Link>
                            </Stack>
                        )}

                        {trimmedEbayUrl && (
                            <Stack direction="row" spacing={{xs: 0.5, sm: 1}} alignItems="center">
                                {/* small ebay brand mark in place of an icon */}
                                <Box
                                    component="img"
                                    src={EBAY_LOGO_SRC}
                                    alt=""
                                    aria-hidden="true"
                                    sx={{height: 16, width: "auto", display: "block"}}
                                />
                                <Link
                                    href={trimmedEbayUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    underline="hover"
                                    color="inherit"
                                    sx={{fontSize: {xs: "0.9rem", sm: "1rem"}}}
                                >
                                    eBay
                                </Link>
                            </Stack>
                        )}
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}
