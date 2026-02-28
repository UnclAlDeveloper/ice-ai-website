import { createTheme } from '@mui/material/styles';
import {
    blue,
    orange,
    pink,
    deepOrange,
    grey,
    indigo,
    red,
} from '@mui/material/colors';

declare module '@mui/material/styles' {
    interface Theme {
        custom: {
            appBarBackground: string;
            menuItemColour: string;
            mobileMenuItemColour: string;
            mobileMenuIconColour: string;
            loginButtonColour: string;
            userNameColour: string;
            userMenuItemColour: string;
            labelColour: string;
            logo: string;
            altLogo: string;
            backgroundImage: string;
            logoText?: string | undefined;
            logoTextSize?: string | undefined;
            logoTextColor?: string | undefined;
            logoTextFont?: string | undefined;
            displayBarLogoOnHome: boolean;
        };
    }

    interface ThemeOptions {
        custom?: {
            appBarBackground?: string;
            menuItemColour?: string;
            mobileMenuItemColour?: string;
            mobileMenuIconColour?: string;
            loginButtonColour?: string;
            userNameColour?: string;
            userMenuItemColour?: string;
            labelColour?: string;
            logo?: string;
            altLogo?: string;
            backgroundImage?: string;
            logoText?: string | undefined;
            logoTextSize?: string | undefined;
            logoTextColor?: string | undefined;
            logoTextFont?: string | undefined;
            displayBarLogoOnHome?: boolean;
        };
    }
}

// ICE AI THEME
export const iceAiTheme = createTheme({
    palette: {
        primary: {
            main: blue[800],
        },
        secondary: {
            main: orange[500],
        },
        text: {
            primary: pink[500],
            secondary: orange[500],
        },
    },
    custom: {
        appBarBackground: '#24435c',
        menuItemColour: '#f5f5f5',
        mobileMenuItemColour: '#202020',
        mobileMenuIconColour: 'cyan',
        loginButtonColour: 'lightblue',
        userNameColour: 'lightblue',
        userMenuItemColour: 'blue',
        labelColour: pink[500],
        logo: '/images/ice-ai-logo.png',
        altLogo: "ice-ai",
        backgroundImage: '/images/ice-ai-background.png',
        logoText: undefined,
        logoTextSize: undefined,
        logoTextColor: undefined,
        logoTextFont: undefined,
        displayBarLogoOnHome: false,
    },
});

// AUTO ADS THEME
export const autoAdsTheme = createTheme({
    palette: {
        primary: {
            main: deepOrange[900],
        },
        secondary: {
            main: orange[700],
        },
        text: {
            primary: grey[900],
            secondary: orange[900],
        },
    },
    typography: {
        h3: {
            color: deepOrange[600],
        },
        subtitle2: {
            color: deepOrange[300],
        },
    },
    components: {
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    color: red[900],
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                },
            },
        },
        MuiFilledInput: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                },
            },
        },
    },
    custom: {
        appBarBackground: '#33363A',
        menuItemColour: deepOrange[600],
        mobileMenuItemColour: deepOrange[600],
        mobileMenuIconColour: deepOrange[800],
        loginButtonColour: deepOrange[800],
        userNameColour: deepOrange[800],
        userMenuItemColour: deepOrange[900],
        labelColour: red[900],
        logo: '/images/auto-ads-logo.png',
        altLogo: "auto-ads",
        backgroundImage: '/images/auto-ads-background.png',
        logoText: undefined,
        logoTextSize: undefined,
        logoTextColor: undefined,
        logoTextFont: undefined,
        displayBarLogoOnHome: true,
    },
});

// ANNA TRAINER THEME
export const annaTrainerTheme = createTheme({
    palette: {
        primary: {
            main: indigo[300],
        },
        secondary: {
            main: orange[500],
        },
        text: {
            primary: indigo[600],
            secondary: grey[600],
        },
    },
    custom: {
        appBarBackground: '#e6e6e6',
        menuItemColour: 'slateblue',
        mobileMenuIconColour: 'purple',
        mobileMenuItemColour: 'slateblue',
        loginButtonColour: '#b300b3',
        userNameColour: '#b300b3',
        userMenuItemColour: '#b300b3',
        labelColour: indigo[600],
        logo: '/images/anna-trainer-logo.png',
        altLogo: "Anna, Trainer",
        backgroundImage: '/images/anna-trainer-background.png',
        logoText: undefined,
        logoTextSize: undefined,
        logoTextColor: undefined,
        logoTextFont: undefined,
        displayBarLogoOnHome: true,
    },
});
