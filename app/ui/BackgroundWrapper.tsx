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
            
            const applyBackground = async () => {
                if (mediaQuery.matches) {
                    // Check if image exists before setting background
                    try {
                        const response = await fetch(backgroundImage, { method: 'HEAD' });
                        if (response.ok) {
                            document.body.style.backgroundImage = `url(${backgroundImage})`;
                            document.body.style.backgroundSize = 'auto 100vh';
                            document.body.style.backgroundPosition = 'top center';
                            document.body.style.backgroundRepeat = 'no-repeat';
                        } else {
                            // Image doesn't exist, don't set background
                            document.body.style.backgroundImage = '';
                            document.body.style.backgroundSize = '';
                            document.body.style.backgroundPosition = '';
                            document.body.style.backgroundRepeat = '';
                        }
                    } catch {
                        // Network error or image doesn't exist, don't set background
                        document.body.style.backgroundImage = '';
                        document.body.style.backgroundSize = '';
                        document.body.style.backgroundPosition = '';
                        document.body.style.backgroundRepeat = '';
                    }
                } else {
                    document.body.style.backgroundImage = '';
                    document.body.style.backgroundSize = '';
                    document.body.style.backgroundPosition = '';
                    document.body.style.backgroundRepeat = '';
                }
            };

            applyBackground();
            mediaQuery.addEventListener('change', applyBackground);

            return () => {
                mediaQuery.removeEventListener('change', applyBackground);
                document.body.style.backgroundImage = '';
                document.body.style.backgroundSize = '';
                document.body.style.backgroundPosition = '';
                document.body.style.backgroundRepeat = '';
            };
        }
    }, [backgroundImage]);

    return <>{children}</>;
}

