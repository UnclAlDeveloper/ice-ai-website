"use client";

import React, {useState} from "react";
import {Card, CardContent, Box, Typography, IconButton, Tooltip, Dialog, DialogContent} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {saleItem} from "@app/auto-ads/sale-items/actions";

// SECONDARY IMAGE
interface SecondaryImage {
    /* Lightweight shape for a non-primary image rendered in the thumbnail strip. */

    id: number;
    url: string;
}

// EBAY LOGO PATH
const EBAY_LOGO_PATH = "/images/auto-ads/sources/ebay.png";

// FACEBOOK BRAND BLUE
const FACEBOOK_BRAND_BLUE = "#0866FF";

// SALE ITEM DETAIL CARD PROPS
interface SaleItemDetailCardProps {
    /* Props for the read-only sale item detail card. */

    item: saleItem;
    primaryImageUrl: string | null;
    secondaryImages: SecondaryImage[];
    onClose: () => void;
}

// FORMAT PRICE
function formatPrice(value: number | null | undefined, currencySymbol: string | null): string | null {
    /**
     * Formats a numeric price using the sale item's currency symbol where
     * available, falling back to a pound sign. Returns null when the price
     * is unset so callers can hide the field entirely.
     */

    if (value === null || value === undefined) return null;
    return `${currencySymbol || "£"}${value.toLocaleString()}`;
}

// SALE ITEM DETAIL CARD
export default function SaleItemDetailCard({item, primaryImageUrl, secondaryImages, onClose}: SaleItemDetailCardProps) {
    /**
     * Expanded read-only view of a single sale item. Shows the title at
     * the top, the primary image, the description (rendered as markdown
     * for parity with the resale detail view), pricing, location, and
     * marketplace links when present. Secondary images render as a
     * responsive grid below; clicking any image opens it at full size in
     * a lightbox dialog.
     */

    const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

    const askingPriceFormatted = formatPrice(item.askingPrice, item.currencySymbol);
    const hasListings = !!(item.eBayUrl || item.facebookUrl);

    return (
        <Card>
            <CardContent sx={{p: {xs: 2, sm: 3}}}>
                {/* header with title and close control */}
                <Box sx={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 2}}>
                    <Box sx={{minWidth: 0}}>
                        <Typography variant="h5" component="div" sx={{lineHeight: 1.2}}>
                            {item.title}
                        </Typography>
                    </Box>
                    <Tooltip title="Close">
                        <IconButton onClick={onClose} size="small" aria-label="Close detail">
                            <CloseIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* primary image floats so the description wraps around it on wider screens */}
                {primaryImageUrl && (
                    <Box sx={{float: {sm: "left"}, mr: {sm: 3}, mb: 2, textAlign: {xs: "center", sm: "left"}}}>
                        <Box
                            sx={{
                                maxWidth: 320,
                                mx: {xs: "auto", sm: 0},
                                borderRadius: 1,
                                overflow: "hidden",
                                border: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Box
                                component="img"
                                src={primaryImageUrl}
                                alt={item.title}
                                sx={{maxWidth: 320, width: "100%", height: "auto", display: "block"}}
                            />
                        </Box>
                    </Box>
                )}

                {/* description as markdown */}
                {item.description && (
                    <Box
                        sx={{
                            fontSize: "0.875rem",
                            wordBreak: "break-word",
                            overflowWrap: "break-word",
                            "& p": {margin: "0.5em 0"},
                            "& ul, & ol": {margin: "0.5em 0", paddingLeft: "1.5em"},
                            "& li": {margin: "0.25em 0"},
                            "& strong": {fontWeight: "bold"},
                            "& em": {fontStyle: "italic"},
                        }}
                    >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.description}</ReactMarkdown>
                    </Box>
                )}

                {/* asking price + marketplace links + location */}
                {(askingPriceFormatted || item.location || hasListings) && (
                    <Box sx={{mt: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap"}}>
                        {askingPriceFormatted && (
                            <Typography variant="body2">
                                <Box component="span" sx={{color: "text.secondary", fontWeight: 500}}>Asking Price: </Box>
                                {askingPriceFormatted}
                            </Typography>
                        )}
                        {item.location && (
                            <Typography variant="body2">
                                <Box component="span" sx={{color: "text.secondary", fontWeight: 500}}>Location: </Box>
                                {item.location}
                            </Typography>
                        )}
                        {item.eBayUrl && (
                            <Tooltip title="View on eBay">
                                <Box
                                    component="a"
                                    href={item.eBayUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="View on eBay"
                                    sx={{display: "inline-flex", alignItems: "center", lineHeight: 0}}
                                >
                                    <Box
                                        component="img"
                                        src={EBAY_LOGO_PATH}
                                        alt="eBay"
                                        sx={{height: 22, width: "auto", objectFit: "contain"}}
                                    />
                                </Box>
                            </Tooltip>
                        )}
                        {item.facebookUrl && (
                            <Tooltip title="View on Facebook Marketplace">
                                <Box
                                    component="a"
                                    href={item.facebookUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="View on Facebook Marketplace"
                                    sx={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                        lineHeight: 0,
                                        textDecoration: "none",
                                    }}
                                >
                                    <Box
                                        component="span"
                                        sx={{
                                            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                                            fontWeight: 700,
                                            fontSize: 18,
                                            letterSpacing: "-0.02em",
                                            color: FACEBOOK_BRAND_BLUE,
                                            textTransform: "lowercase",
                                            lineHeight: 1,
                                        }}
                                    >
                                        facebook
                                    </Box>
                                    <StorefrontIcon
                                        sx={{fontSize: 24, color: FACEBOOK_BRAND_BLUE}}
                                    />
                                </Box>
                            </Tooltip>
                        )}
                    </Box>
                )}

                {/* clear the floated primary image so following content starts on a new line */}
                <Box sx={{clear: "both"}} />

                {/* secondary images sized like the primary image, click to open at full size */}
                {secondaryImages.length > 0 && (
                    <Box sx={{mt: 3, display: "flex", flexWrap: "wrap", gap: 2}}>
                        {secondaryImages.map((img) => (
                            <Box
                                key={img.id}
                                onClick={() => setLightboxImageUrl(img.url)}
                                sx={{
                                    maxWidth: 320,
                                    borderRadius: 1,
                                    overflow: "hidden",
                                    border: "1px solid",
                                    borderColor: "divider",
                                    cursor: "pointer",
                                    transition: "transform 120ms ease, box-shadow 120ms ease",
                                    "&:hover": {
                                        transform: "translateY(-2px)",
                                        boxShadow: 2,
                                    },
                                }}
                            >
                                <Box
                                    component="img"
                                    src={img.url}
                                    alt=""
                                    sx={{maxWidth: 320, width: "100%", height: "auto", display: "block"}}
                                />
                            </Box>
                        ))}
                    </Box>
                )}

                {/* full-size lightbox shown when a secondary image is clicked */}
                <Dialog
                    open={lightboxImageUrl !== null}
                    onClose={() => setLightboxImageUrl(null)}
                    maxWidth="lg"
                    fullWidth
                >
                    <DialogContent sx={{p: 0, bgcolor: "common.black", position: "relative"}}>
                        <Tooltip title="Close">
                            <IconButton
                                onClick={() => setLightboxImageUrl(null)}
                                aria-label="Close image"
                                sx={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    bgcolor: "rgba(0, 0, 0, 0.5)",
                                    color: "common.white",
                                    "&:hover": {bgcolor: "rgba(0, 0, 0, 0.7)"},
                                }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </Tooltip>
                        {lightboxImageUrl && (
                            <Box
                                component="img"
                                src={lightboxImageUrl}
                                alt=""
                                onClick={() => setLightboxImageUrl(null)}
                                sx={{
                                    width: "100%",
                                    height: "auto",
                                    maxHeight: "90vh",
                                    objectFit: "contain",
                                    display: "block",
                                    cursor: "zoom-out",
                                }}
                            />
                        )}
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
