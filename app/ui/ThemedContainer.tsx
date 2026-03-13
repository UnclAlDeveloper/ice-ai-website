'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Container } from '@mui/system';
import Box from '@mui/material/Box';
import { useMediaQuery } from '@mui/material';

const SHOW_SHADOW_EDGES = false;

interface ThemedContainerProps {
    /* Props for ThemedContainer component including children, auth route flag, and optional app bar. */

    children: React.ReactNode;
    isAuthRoute?: boolean;
    appBar?: React.ReactNode;
}

// THEMED CONTAINER
export default function ThemedContainer({ children, isAuthRoute = false, appBar }: ThemedContainerProps) {
    /* Client component that wraps the main container with theme-based background image styling. Renders AppBar inside the container for proper padding. */

    const theme = useTheme();
    const backgroundImage = theme.custom.backgroundImage;
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const appBarHeight = isMobile ? 56 : 64;
    const totalHeaderHeight = 6 + appBarHeight;
    const [bgSize, setBgSize] = useState('100% auto');

    useEffect(() => {
        // load image and compute cover size against container width and viewport height
        if (backgroundImage) {
            const img = new Image();
            img.onload = () => {
                const containerWidth = 1800;
                const vh = window.innerHeight;
                const scale = Math.max(containerWidth / img.naturalWidth, vh / img.naturalHeight);
                const bgWidth = Math.round(img.naturalWidth * scale);
                const bgHeight = Math.round(img.naturalHeight * scale);
                setBgSize(`${bgWidth}px ${bgHeight}px`);
            };
            img.src = backgroundImage;
        }
    }, [backgroundImage]);

    return (
        <Box sx={{margin: 0, padding: 0}}>
            {!isAuthRoute && (
                <>
                    {/* Fixed top white box - spans full width */}
                    <Box
                        sx={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '6px',
                            backgroundColor: 'white',
                            width: '100%',
                            zIndex: 1301,
                        }}
                    />
                    {/* Fixed header wrapper - spans full width */}
                    <Box
                        sx={{
                            position: 'fixed',
                            top: '6px',
                            left: 0,
                            right: 0,
                            width: '100%',
                            zIndex: 1300,
                        }}
                    >
                        {/* Container that respects maxWidth and centers */}
                        <Container
                            maxWidth="xl"
                            disableGutters
                            sx={{
                                margin: '0 auto',
                                paddingLeft: '6px',
                                paddingRight: '6px',
                            }}
                        >
                            <Box
                                sx={{
                                    position: 'relative',
                                    marginLeft: '-6px',
                                    marginRight: '-6px',
                                    width: 'calc(100% + 12px)',
                                }}
                            >
                                {SHOW_SHADOW_EDGES && (
                                    <>
                                        {/* Fixed left gradient box */}
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                width: '6px',
                                                height: `${appBarHeight}px`,
                                                background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
                                                zIndex: 0,
                                            }}
                                        />
                                        {/* Fixed right gradient box */}
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                right: 0,
                                                top: 0,
                                                width: '6px',
                                                height: `${appBarHeight}px`,
                                                background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
                                                zIndex: 0,
                                            }}
                                        />
                                    </>
                                )}
                                {/* AppBar wrapper */}
                                <Box sx={{ position: 'relative', zIndex: 1, marginLeft: '6px', marginRight: '6px' }}>
                                    {appBar}
                                </Box>
                            </Box>
                        </Container>
                    </Box>
                </>
            )}
            {/* Background wrapper that extends to 1800px on wide screens */}
            <Box
                sx={{
                    margin: '0 auto',
                    maxWidth: '1800px',
                    '@media (min-width:1800px)': {
                        ...(SHOW_SHADOW_EDGES ? {
                            boxShadow:
                                '5px 0 10px  rgba(0,0,0,0.1), -5px 0 10px rgba(0,0,0,0.1)',
                        } : {}),
                        ...(backgroundImage ? {
                            backgroundImage: `url(${backgroundImage})`,
                            backgroundSize: bgSize,
                            backgroundPosition: 'top center',
                            backgroundRepeat: 'no-repeat',
                        } : {}),
                    }
                }}
            >
                <Container
                    maxWidth="xl"
                    disableGutters
                    sx={{
                        margin: '0 auto',
                        marginTop: 0,
                        padding: '6px 6px 12px 6px',
                        minHeight: '100vh',
                        display: 'block',
                        position: 'relative',
                        top: 0,
                        paddingTop: !isAuthRoute ? `${totalHeaderHeight + 6}px` : '6px',
                    }}
                >
                    {children}
                </Container>
            </Box>
        </Box>
    );
}

