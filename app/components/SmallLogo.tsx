'use client';

import Box from "@mui/material/Box";
import Logo from "/public/quill-and-chart-logo.png";
import Image from "next/image";

interface SmallLogoProps {
    /* Props for SmallLogo component with responsive display settings and size. */

    xs: string;
    md: string;
    size: number;
}

// SMALL LOGO
export default function SmallLogo({ xs, md, size }: SmallLogoProps)  {
    /* Component that displays a small logo image with configurable display and size properties. */
    
    return (
        <Box sx={{display: {xs: xs, md: md}, mr: 1, height: size, width: size}}>
            <Image
                src={Logo}
                alt="-"
                style={{ objectFit: 'contain' }}
            />
        </Box>
    )
}
