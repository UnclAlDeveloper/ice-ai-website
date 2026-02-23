'use client';

import { useTheme } from '@mui/material/styles';
import { useEffect } from 'react';

// THEME BODY STYLES
export default function ThemeBodyStyles() {
    /* Client component that applies the theme's text color to the body element, ensuring consistent colors across desktop and mobile. */

    const theme = useTheme();

    useEffect(() => {
        const root = document.documentElement;
        const textColor = theme.palette.text.primary;
        const secondaryTextColor = theme.palette.text.secondary;
        
        root.style.setProperty('--foreground', textColor);
        root.style.setProperty('color-scheme', 'light');
        root.style.color = textColor;
        document.body.style.color = textColor;
        
        const styleId = 'theme-body-color';
        let styleElement = document.getElementById(styleId) as HTMLStyleElement;
        
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }
        
        styleElement.textContent = `
            html, body { 
                color: ${textColor} !important; 
            }
            body [class*="MuiAlert-error"] *, body [class*="Mui-error"] {
                color: inherit !important;
            }
        `;
    }, [theme.palette.text.primary, theme.palette.text.secondary]);

    return null;
}
