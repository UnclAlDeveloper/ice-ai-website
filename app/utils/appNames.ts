// APP NAME
export enum AppName {
    /* Enumeration of application names for this project. */

    IceAI = 'ice-group',
    AutoAds = 'auto-ads',
    AnnaTrainer = 'anna-trainer',
}

export const AppFriendlyNames: Record<AppName, string> = {
    [AppName.IceAI]: 'ice-ai',
    [AppName.AutoAds]: 'Auto Ads',
    [AppName.AnnaTrainer]: 'Anna Trainer',
};

export const AppIcons: Record<AppName, string> = {
    [AppName.IceAI]: '/images/ice-ai-icon.ico',
    [AppName.AutoAds]: '/images/auto-ads-icon.ico',
    [AppName.AnnaTrainer]: '/images/anna-trainer-icon.ico',
};

// GET APP NAME FROM HOSTNAME
export function getAppNameFromHostname(hostname: string): AppName {
    /* Returns the AppName that corresponds to a given hostname using the second-level domain segment. */

    const parts = hostname.split('.');

    const secondLevelDomain = parts.length >= 2 ? parts[parts.length - 2] : hostname;

    const appName = Object.values(AppName).find((value) => value === secondLevelDomain);

    return appName || (process.env.DEFAULT_APP_NAME as AppName);
}

// GET APP NAME
export function getAppName(): AppName {
    /* Returns the AppName based on the current hostname, falling back to a default for server-side rendering. */

    if (typeof window === 'undefined') {
        return process.env.DEFAULT_APP_NAME as AppName;
    }

    const hostname = window.location.hostname;

    return getAppNameFromHostname(hostname);
}
