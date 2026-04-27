"use client";

import React, {useState} from "react";
import {Card, CardContent, Box, Typography, IconButton, Tooltip, Dialog, DialogContent} from "@mui/material";
import Grid from "@mui/material/Grid2";
import CloseIcon from "@mui/icons-material/Close";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {resaleListing} from "@app/auto-ads/resales/actions";

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

// RESALE LISTING DETAIL CARD PROPS
interface ResaleListingDetailCardProps {
    /* Props for the read-only detail card. */

    listing: resaleListing;
    primaryImageUrl: string | null;
    secondaryImages: SecondaryImage[];
    onClose: () => void;
}

// FIELD VALUE PROPS
interface FieldValueProps {
    /* Props for a single label/value display row. */

    label: string;
    value: React.ReactNode;
}

// FIELD VALUE
function FieldValue({label, value}: FieldValueProps) {
    /**
     * Renders a label/value pair on a single line. The whole row is hidden
     * when the value is null, undefined or an empty string so the read-only
     * view only shows fields that actually contain data.
     */

    if (value === null || value === undefined || value === "") return null;
    return (
        <Typography variant="body2">
            <Box component="span" sx={{color: "text.secondary", fontWeight: 500}}>{label}: </Box>
            {value}
        </Typography>
    );
}

// FORMAT PRICE
function formatPrice(value: number | null | undefined, currencySymbol: string | null): string | null {
    /**
     * Formats a numeric price using the listing's currency symbol where
     * available, falling back to a pound sign. Returns null when the price
     * is unset so callers can hide the field entirely.
     */

    if (value === null || value === undefined) return null;
    return `${currencySymbol || "£"}${value.toLocaleString()}`;
}

// SECTION TITLE PROPS
interface SectionTitleProps {
    /* Props for the small section heading shown between groups of fields. */

    children: React.ReactNode;
}

// SECTION TITLE
function SectionTitle({children}: SectionTitleProps) {
    /**
     * Renders a small uppercase-style section heading matching the section
     * subtitles used throughout the resale listing editor so the read-only
     * view feels visually consistent with its editable counterpart.
     */

    return (
        <Typography variant="subtitle2" color="text.secondary" sx={{mt: 3, mb: 1}}>
            {children}
        </Typography>
    );
}

// MARKDOWN BLOCK PROPS
interface MarkdownBlockProps {
    /* Props for a labelled markdown block within the descriptions section. */

    label: string;
    content: string;
}

// MARKDOWN BLOCK
function MarkdownBlock({label, content}: MarkdownBlockProps) {
    /**
     * Renders a markdown-rendered block of text under a small label, matching
     * the typography used for the editor's full description and specs and
     * features fields but without any inputs or controls.
     */

    return (
        <Box sx={{mb: 2}}>
            <Typography variant="body2" sx={{color: "text.secondary", fontWeight: 500, mb: 0.5}}>
                {label}
            </Typography>
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </Box>
        </Box>
    );
}

// RESALE LISTING DETAIL CARD
export default function ResaleListingDetailCard({listing, primaryImageUrl, secondaryImages, onClose}: ResaleListingDetailCardProps) {
    /**
     * Expanded read-only view of a single resale listing. Mirrors the layout
     * of ResaleListingEditor with the same section grouping (Vehicle Identity,
     * Vehicle Details, Mileage, History and Condition, Tax and Emissions,
     * Descriptions, Pricing, Listings) but renders every value as plain text.
     * Editing controls such as DVLA lookup, AI generation, image uploads,
     * eBay publish and Facebook assist buttons are deliberately excluded.
     * Empty fields are hidden so the card stays compact. Images are passed in
     * from the server-rendered parent so the card works for unauthenticated
     * visitors without needing any client-side data fetching.
     */

    const fieldSize = {xs: 12, sm: 6, md: 4};
    const wideFieldSize = {xs: 12};

    const hasDescriptions = !!(listing.fullDescription || listing.specsAndFeatures);
    const hasListings = !!(listing.eBayUrl || listing.facebookUrl);

    // lightbox state: the url of the image being shown at full size, or null
    const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

    return (
        <Card>
            <CardContent sx={{p: {xs: 2, sm: 3}}}>
                {/* header with title and close control */}
                <Box sx={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 2}}>
                    <Box sx={{minWidth: 0}}>
                        <Typography variant="h5" component="div" sx={{lineHeight: 1.2}}>
                            {listing.makeAndModel}
                        </Typography>
                        {listing.shortDescription && (
                            <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
                                {listing.shortDescription}
                            </Typography>
                        )}
                    </Box>
                    <Tooltip title="Close">
                        <IconButton onClick={onClose} size="small" aria-label="Close detail">
                            <CloseIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* primary image floats so the field grid wraps around it on wider screens */}
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
                                alt={listing.makeAndModel}
                                sx={{maxWidth: 320, width: "100%", height: "auto", display: "block"}}
                            />
                        </Box>
                    </Box>
                )}

                {/* vehicle identity */}
                <Typography variant="subtitle2" color="text.secondary" sx={{mb: 1}}>
                    Vehicle Identity
                </Typography>
                <Grid container spacing={1}>
                    <Grid size={fieldSize}><FieldValue label="Registration" value={listing.registration} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Make & Model" value={listing.makeAndModel} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Status" value={listing.status} /></Grid>
                    <Grid size={wideFieldSize}><FieldValue label="Short Description" value={listing.shortDescription} /></Grid>
                </Grid>

                {/* vehicle details */}
                <SectionTitle>Vehicle Details</SectionTitle>
                <Grid container spacing={1}>
                    <Grid size={fieldSize}><FieldValue label="Year" value={listing.year} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Body Type" value={listing.bodyType} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Cab Type" value={listing.cabType} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Fuel Type" value={listing.fuelType} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Gearbox" value={listing.gearboxType} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Wheelbase" value={listing.wheelbase} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Engine Size" value={listing.engineSize} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Colour" value={listing.colour} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Emission Class" value={listing.emissionClass} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Location" value={listing.location} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Seats" value={listing.seats} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Drive Configuration" value={listing.driveConfiguration} /></Grid>
                </Grid>

                {/* mileage */}
                <SectionTitle>Mileage</SectionTitle>
                <Grid container spacing={1}>
                    <Grid size={fieldSize}>
                        <FieldValue
                            label="Mileage"
                            value={
                                listing.mileage != null
                                    ? `${listing.mileage.toLocaleString()}${listing.mileageUnit ? ` ${listing.mileageUnit}` : ""}`
                                    : null
                            }
                        />
                    </Grid>
                </Grid>

                {/* history and condition */}
                <SectionTitle>History &amp; Condition</SectionTitle>
                <Grid container spacing={1}>
                    <Grid size={fieldSize}><FieldValue label="Number of Owners" value={listing.numberOfOwners} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Service History" value={listing.serviceHistory} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Basic History Check" value={listing.basicHistoryCheck} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="MOT Status" value={listing.motStatus} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="MOT Expiry" value={listing.motExpiry} /></Grid>
                </Grid>

                {/* tax and emissions */}
                <SectionTitle>Tax &amp; Emissions</SectionTitle>
                <Grid container spacing={1}>
                    <Grid size={fieldSize}><FieldValue label="Tax Status" value={listing.taxStatus} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Tax Due Date" value={listing.taxDueDate} /></Grid>
                    <Grid size={fieldSize}>
                        <FieldValue
                            label="CO2 Emissions"
                            value={listing.co2Emissions != null ? `${listing.co2Emissions} g/km` : null}
                        />
                    </Grid>
                    <Grid size={fieldSize}><FieldValue label="Type Approval" value={listing.typeApproval} /></Grid>
                    <Grid size={fieldSize}>
                        <FieldValue
                            label="Revenue Weight"
                            value={listing.revenueWeight != null ? `${listing.revenueWeight} kg` : null}
                        />
                    </Grid>
                    <Grid size={fieldSize}><FieldValue label="First Registration" value={listing.monthOfFirstRegistration} /></Grid>
                    <Grid size={fieldSize}><FieldValue label="Last V5C Issued" value={listing.dateOfLastV5CIssued} /></Grid>
                    <Grid size={fieldSize}>
                        <FieldValue
                            label="Marked for Export"
                            value={
                                listing.markedForExport === true
                                    ? "Yes"
                                    : listing.markedForExport === false
                                      ? "No"
                                      : null
                            }
                        />
                    </Grid>
                </Grid>

                {/* descriptions */}
                {hasDescriptions && (
                    <>
                        <SectionTitle>Descriptions</SectionTitle>
                        {listing.fullDescription && (
                            <MarkdownBlock label="Full Description" content={listing.fullDescription} />
                        )}
                        {listing.specsAndFeatures && (
                            <MarkdownBlock label="Specs & Features" content={listing.specsAndFeatures} />
                        )}
                    </>
                )}

                {/* asking price with marketplace icon links on the same row */}
                {(listing.askingPrice != null || hasListings) && (
                    <Box sx={{mt: 3, mb: 3, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap"}}>
                        {listing.askingPrice != null && (
                            <FieldValue label="Asking Price" value={formatPrice(listing.askingPrice, listing.currencySymbol)} />
                        )}
                        {listing.eBayUrl && (
                            <Tooltip title="View on eBay">
                                <Box
                                    component="a"
                                    href={listing.eBayUrl}
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
                        {listing.facebookUrl && (
                            <Tooltip title="View on Facebook Marketplace">
                                <Box
                                    component="a"
                                    href={listing.facebookUrl}
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

                {/* clear the floated primary image so any following content starts on a new line */}
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
