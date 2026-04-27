"use client";

import React from "react";
import {Card, CardActionArea, CardContent, Typography, Box} from "@mui/material";
import type {saleItem} from "@app/auto-ads/sale-items/actions";

// SALE ITEM CARD PROPS
interface SaleItemCardProps {
    /* Props for the compact sale item card. */

    item: saleItem;
    primaryImageUrl: string | null;
    onClick: () => void;
}

// SALE ITEM CARD
export default function SaleItemCard({item, primaryImageUrl, onClick}: SaleItemCardProps) {
    /**
     * Compact card for a sale item shown on the home tab. By design this
     * card is intentionally minimal — only the primary image and the item
     * title are visible, matching the user's spec for the House Sales tab.
     * Pricing, description and the rest of the metadata are reserved for
     * the expanded detail view shown when the user taps the card.
     */

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
                                alt={item.title}
                                sx={{width: "100%", height: "100%", objectFit: "cover"}}
                            />
                        )}
                    </Box>

                    <Typography variant="h6" component="div" sx={{lineHeight: 1.2, mt: 0.5}}>
                        {item.title}
                    </Typography>
                </CardContent>
            </CardActionArea>
        </Card>
    );
}
