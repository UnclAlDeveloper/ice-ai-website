import {AppName} from "@app/utils/appNames";
import menuItems, {MenuItem, Tier} from "@app/lib/menuConfig";

// GET USER TIER
export function getUserTier(userGroups: string[]): Tier | null {
    /* Extracts the user's tier from their groups. Returns the highest tier found. */

    if (userGroups.includes('Admins')) {
        return 'Admins';
    }

    if (userGroups.includes('AdvancedTier')) {
        return 'AdvancedTier';
    }

    if (userGroups.includes('BasicTier')) {
        return 'BasicTier';
    }

    if (userGroups.includes('FreeTier')) {
        return 'FreeTier';
    }

    return null;
}

// HAS APP GROUP
export function hasAppGroup(appName: AppName, userGroups: string[]): boolean {
    /* Checks if the user belongs to the app-specific group. */

    return userGroups.includes(appName);
}

// COMPARE TIERS
export function compareTiers(userTier: Tier | null, requiredTier: Tier | null): boolean {
    /* Compares user tier with required tier. Returns true if user tier meets or exceeds requirement. */

    if (requiredTier === null) {
        return true;
    }

    if (userTier === null) {
        return false;
    }

    const tierOrder: Record<Tier, number> = {
        FreeTier: 1,
        BasicTier: 2,
        AdvancedTier: 3,
        Admins: 4
    };

    console.log('comparing tiers', userTier, requiredTier);

    return tierOrder[userTier] >= tierOrder[requiredTier];
}

// CAN ACCESS MENU ITEM
export function canAccessMenuItem(
    item: MenuItem,
    userGroups: string[],
    isAuthenticated: boolean,
): boolean {
    /* Determines if a user can access a menu item based on authentication, app group membership, and tier. */

    if (item.isPublic) {
        return true;
    }

    if (!isAuthenticated) {
        return false;
    }

    if (!hasAppGroup(item.appName, userGroups)) {
        return false;
    }

    const userTier = getUserTier(userGroups);

    return compareTiers(userTier, item.requiredTier);
}

// GET MENU ITEMS FOR APP
export function getMenuItemsForApp(
    appName: AppName,
    userGroups: string[],
    isAuthenticated: boolean,
): Array<MenuItem & {canAccess: boolean}> {
    /* Returns menu items for the specified app, filtered and annotated with access permissions. Items with hideWhenDisabled=true and canAccess=false are excluded. */

    const appMenuItems = menuItems.filter((item) => item.appName === appName);

    return appMenuItems
        .map((item) => ({
            ...item,
            canAccess: canAccessMenuItem(item, userGroups, isAuthenticated),
        }))
        .filter((item) => {
            // hide items where hideWhenDisabled is true and user doesn't have access
            return !(item.hideWhenDisabled && !item.canAccess);
        });
}

// GET MENU ITEM BY PATH
export function getMenuItemByPath(path: string): MenuItem | undefined {
    /* Finds a menu item by its path. Used in middleware for authorization checks. */

    return menuItems.find((item) => item.path === path);
}

// GET MENU ITEM BY PATH AND APP NAME
export function getMenuItemByPathAndApp(path: string, appName: AppName): MenuItem | undefined {
    /* Finds a menu item by its path and app name. Used in middleware for authorization checks when multiple apps share the same paths. */

    return menuItems.find((item) => item.path === path && item.appName === appName);
}

