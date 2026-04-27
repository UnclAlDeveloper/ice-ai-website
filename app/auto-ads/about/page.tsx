import React from "react";
import Link from "next/link";
import Image from "next/image";
import {Box, Stack, Typography} from "@mui/material";
import OwnerCard from "@components/home/OwnerCard";

// PAGE
export default async function Page() {
    /**
     * About page for the Auto Ads application. Shows the same owner card used
     * on the Auto Ads home screen and a short network attribution row linking
     * to the Ice Group website.
     */

    return (
        <Box sx={{display: "flex", flexDirection: "column", gap: 1.5}}>
            <Typography variant="h5" component="h1">
                About - Auto Ads
            </Typography>

            <OwnerCard
                name={process.env.AUTO_ADS_USERNAME}
                phone={process.env.AUTO_ADS_PHONE}
                email={process.env.AUTO_ADS_EMAIL}
                facebookUrl={process.env.AUTO_ADS_FACEBOOK_URL}
                ebayUrl={process.env.AUTO_ADS_EBAY_URL}
                imageSrc={process.env.AUTO_ADS_IMAGE}
            />

            <Stack direction="row" spacing={1} alignItems="center" sx={{flexWrap: "wrap"}}>
                <Typography variant="body1">Part of the</Typography>
                <Link href="https://www.ice-group.ai" target="_blank" rel="noopener noreferrer" aria-label="Ice Group website">
                    <Image
                        src="/images/ice-ai-logo.png"
                        alt="Ice-AI"
                        width={40}
                        height={40}
                        style={{width: "auto", height: "32px", objectFit: "contain", verticalAlign: "middle"}}
                    />
                </Link>
                <Typography variant="body1">Network</Typography>
            </Stack>
        </Box>
    );
}

