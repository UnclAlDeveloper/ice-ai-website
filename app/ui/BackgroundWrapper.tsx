'use client';

import { useTheme } from '@mui/material/styles';
import { useEffect } from 'react';

interface BackgroundWrapperProps {
    /* Props for BackgroundWrapper component including children. */

    children: React.ReactNode;
}

// BACKGROUND WRAPPER
export default function BackgroundWrapper({ children }: BackgroundWrapperProps) {
    /* Client component that applies the theme's background image to the body for screens smaller than 1800px. */

    const theme = useTheme();
    const backgroundImage = theme.custom.backgroundImage;

    useEffect(() => {
        if (backgroundImage) {
            const mediaQuery = window.matchMedia('(max-width: 1799px)');

            const clearBodyBackground = () => {
                document.body.style.backgroundImage = '';
                document.body.style.backgroundSize = '';
                document.body.style.backgroundPosition = '';
                document.body.style.backgroundRepeat = '';
            };

            // load image and compute cover size against viewport, then lock it as fixed pixels
            const applyBackground = () => {
                if (!mediaQuery.matches) {
                    clearBodyBackground();
                    return;
                }

                const img = new Image();
                img.onload = () => {
                    const vw = window.innerWidth;
                    const vh = window.innerHeight;
                    const scale = Math.max(vw / img.naturalWidth, vh / img.naturalHeight);
                    const bgWidth = Math.round(img.naturalWidth * scale);
                    const bgHeight = Math.round(img.naturalHeight * scale);

                    document.body.style.backgroundImage = `url(${backgroundImage})`;
                    document.body.style.backgroundSize = `${bgWidth}px ${bgHeight}px`;
                    document.body.style.backgroundPosition = 'top center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                };
                img.onerror = () => clearBodyBackground();
                img.src = backgroundImage;
            };

            applyBackground();
            mediaQuery.addEventListener('change', applyBackground);

            return () => {
                mediaQuery.removeEventListener('change', applyBackground);
                clearBodyBackground();
            };
        }
    }, [backgroundImage]);

    return <>{children}</>;
}

