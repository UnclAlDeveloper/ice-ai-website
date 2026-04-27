"use client";

import React from "react";
import {Card, CardActionArea, CardContent, Typography, Box, useTheme} from "@mui/material";
import type {resaleListing} from "@app/auto-ads/resales/actions";

// RESALE LISTING CARD PROPS
interface ResaleListingCardProps {
    /* Props for the compact resale listing card. */

    listing: resaleListing;
    primaryImageUrl: string | null;
    onClick: () => void;
}

// RESALE LISTING CARD
export default function ResaleListingCard({listing, primaryImageUrl, onClick}: ResaleListingCardProps) {
    /**
     * Compact card showing key resale listing fields: image, make and model,
     * short description, year, mileage, asking price, location and
     * registration. Status, listing source and the AI Assistant section are
     * intentionally omitted compared to ProspectCard so the card stays small
     * enough to repeat across a wide screen and wrap to one column on mobile.
     * The whole card is a single click target that asks the parent to expand
     * it into a full read-only detail view.
     */

    const theme = useTheme();

    return (
        <Card sx={{height: "100%", display: "flex", flexDirection: "column"}}>
            <CardActionArea onClick={onClick} sx={{height: "100%", alignItems: "stretch"}}>
                <CardContent
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.75,
                        p: 2,
                        height: "100%",
                    }}
                >
                    {/* primary image preview, falls back to a placeholder block when none set */}
                    <Box
                        sx={{
                            width: "100%",
                            aspectRatio: "4 / 3",
                            overflow: "hidden",
                            borderRadius: 1,
                            bgcolor: "action.hover",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {primaryImageUrl && (
                            <Box
                                component="img"
                                src={primaryImageUrl}
                                alt={listing.makeAndModel}
                                sx={{width: "100%", height: "100%", objectFit: "cover"}}
                            />
                        )}
                    </Box>

                    <Typography variant="h6" component="div" sx={{lineHeight: 1.2, mt: 0.5}}>
                        {listing.makeAndModel}
                    </Typography>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}
                    >
                        {listing.shortDescription}
                    </Typography>

                    {/* meta line: year and mileage on one row when both present */}
                    {(listing.year || listing.mileage) && (
                        <Typography variant="body2">
                            {listing.year && (
                                <>
                                    <Box component="span" sx={{color: theme.custom.labelColour}}>Year: </Box>
                                    {listing.year}
                                </>
                            )}
                            {listing.year && listing.mileage ? " • " : null}
                            {listing.mileage && (
                                <>
                                    <Box component="span" sx={{color: theme.custom.labelColour}}>Mileage: </Box>
                                    {Number(listing.mileage).toLocaleString()}
                                    {listing.mileageUnit ? ` ${listing.mileageUnit}` : ""}
                                </>
                            )}
                        </Typography>
                    )}

                    {/* price line: prefers askingPrice, falls back to adsPrice if no asking price set */}
                    {(listing.askingPrice ?? listing.adsPrice) != null && (
                        <Typography variant="body2">
                            <Box component="span" sx={{color: theme.custom.labelColour}}>Price: </Box>
                            {listing.currencySymbol || "£"}
                            {(listing.askingPrice ?? listing.adsPrice)?.toLocaleString()}
                            {listing.vatStatus && listing.vatStatus !== "No VAT" && ` ${listing.vatStatus}`}
                        </Typography>
                    )}

                    {listing.location && (
                        <Typography variant="body2">
                            <Box component="span" sx={{color: theme.custom.labelColour}}>Location: </Box>
                            {listing.location}
                        </Typography>
                    )}

                    {listing.registration && (
                        <Typography variant="body2">
                            <Box component="span" sx={{color: theme.custom.labelColour}}>Reg: </Box>
                            {listing.registration}
                        </Typography>
                    )}
                </CardContent>
            </CardActionArea>
        </Card>
    );
}
