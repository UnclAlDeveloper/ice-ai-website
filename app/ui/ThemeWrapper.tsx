'use client';

import { ThemeProvider } from '@mui/material/styles';
import { iceAiTheme, autoAdsTheme, annaTrainerTheme } from './allThemes';
import { AppName } from '../utils/appNames';
import { AppNameProvider } from '../lib/AppNameProvider';

interface ThemeWrapperProps {
    /* Props for ThemeWrapper component including children and app name for theme selection. */

    children: React.ReactNode;
    appName: AppName;
}

// THEME WRAPPER
export default function ThemeWrapper({ children, appName }: ThemeWrapperProps) {
    /* Client component that selects and provides the appropriate Material-UI theme based on the provided app name. */

    const theme = appName === AppName.IceAI ? iceAiTheme :
        appName === AppName.AutoAds ? autoAdsTheme :
        appName === AppName.AnnaTrainer ? annaTrainerTheme :
        annaTrainerTheme;

    return (
        <AppNameProvider appName={appName}>
            <ThemeProvider theme={theme}>
                {children}
            </ThemeProvider>
        </AppNameProvider>
    );
}
