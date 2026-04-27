import {AppName} from "@app/utils/appNames";

// TIER
export type Tier = 'FreeTier' | 'BasicTier' | 'AdvancedTier' | 'Admins';
/* Represents the subscription tier levels available to users. */

// MENU ITEM
export interface MenuItem {
    /* Defines the structure of a menu item including its path, visibility, access requirements, and associated app. */

    name: string;
    path: string;
    isPublic: boolean;
    hideWhenDisabled: boolean;
    requiredTier: Tier | null;
    componentType: 'server' | 'client';
    appName: AppName;
}

// MENU CONFIGURATION
const menuItems: MenuItem[] = [
    // ANNA TRAINER
    {
        name: 'About',
        path: '/about',
        isPublic: true,
        hideWhenDisabled: false,
        requiredTier: null,
        componentType: 'server',
        appName: AppName.AnnaTrainer,
    },
    {
        name: 'Add Video',
        path: '/add-video',
        isPublic: false,
        hideWhenDisabled: true,
        requiredTier: 'FreeTier',
        componentType: 'server',
        appName: AppName.AnnaTrainer,
    },
    {
        name: 'Preferences',
        path: '/preferences',
        isPublic: false,
        hideWhenDisabled: true,
        requiredTier: 'FreeTier',
        componentType: 'server',
        appName: AppName.AnnaTrainer,
    },
    {
        name: 'Portfolio',
        path: '/portfolio',
        isPublic: true,
        hideWhenDisabled: false,
        requiredTier: null,
        componentType: 'server',
        appName: AppName.AnnaTrainer,
    },
    // ICE GROUP
    {
        name: 'About',
        path: '/about',
        isPublic: true,
        hideWhenDisabled: false,
        requiredTier: null,
        componentType: 'server',
        appName: AppName.IceAI,
    },
    {
        name: 'Server',
        path: '/server',
        isPublic: false,
        hideWhenDisabled: false,
        requiredTier: 'FreeTier',
        componentType: 'server',
        appName: AppName.IceAI,
    },
    {
        name: 'Client',
        path: '/client',
        isPublic: false,
        hideWhenDisabled: false,
        requiredTier: 'FreeTier',
        componentType: 'client',
        appName: AppName.IceAI,
    },
    {
        name: 'Public Server',
        path: '/public-server',
        isPublic: true,
        hideWhenDisabled: false,
        requiredTier: null,
        componentType: 'server',
        appName: AppName.IceAI,
    },
    {
        name: 'Public Client',
        path: '/public-client',
        isPublic: true,
        hideWhenDisabled: false,
        requiredTier: null,
        componentType: 'client',
        appName: AppName.IceAI,
    },
    // AUTO ADS
    {
        name: 'About',
        path: '/about',
        isPublic: true,
        hideWhenDisabled: false,
        requiredTier: null,
        componentType: 'server',
        appName: AppName.AutoAds,
    },
    {
        name: 'Prospects',
        path: '/prospects',
        isPublic: false,
        hideWhenDisabled: true,
        requiredTier: 'BasicTier',
        componentType: 'server',
        appName: AppName.AutoAds,
    },
    {
        name: 'Search',
        path: '/search',
        isPublic: false,
        hideWhenDisabled: true,
        requiredTier: 'BasicTier',
        componentType: 'server',
        appName: AppName.AutoAds,
    },
    {
        name: 'Manual Entry',
        path: '/manual-entry',
        isPublic: false,
        hideWhenDisabled: true,
        requiredTier: 'BasicTier',
        componentType: 'server',
        appName: AppName.AutoAds,
    },
    {
        name: 'Resales',
        path: '/resales',
        isPublic: false,
        hideWhenDisabled: true,
        requiredTier: 'BasicTier',
        componentType: 'server',
        appName: AppName.AutoAds,
    },
    {
        name: 'House Sales',
        path: '/sale-items',
        isPublic: false,
        hideWhenDisabled: true,
        requiredTier: 'BasicTier',
        componentType: 'server',
        appName: AppName.AutoAds,
    },
];
/* Contains all menu items for this project. */

export default menuItems;
