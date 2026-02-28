import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {getServerSessionFromCookies} from "@app/lib/session";
import {getAppNameFromHostname} from "@app/utils/appNames";
import {getMenuItemByPathAndApp, canAccessMenuItem} from "@app/lib/menuUtils";

// MIDDLEWARE
export default async function middleware(request: NextRequest) {
    /* Next.js middleware that logs all requests, checks authorization, and redirects unauthorized access to forbidden page. */
    const path = request.nextUrl.pathname;
    const method = request.method;
    const hostname = request.headers.get('host') || '';
    const appName = getAppNameFromHostname(hostname);
    
    // log all middleware hits for debugging
    console.log('[MIDDLEWARE]', method, path, {
        host: hostname,
        userAgent: request.headers.get('user-agent'),
        forwarded: request.headers.get('x-forwarded-for')
    });
    
    // helper function to set x-pathname header and return response
    const setPathnameHeader = (response: NextResponse, pathname?: string): NextResponse => {
        response.headers.set('x-pathname', pathname || path);
        return response;
    };
    
    // explicit bypass for health check
    if (path === '/api/health') {
        console.log('[MIDDLEWARE] Bypassing auth for health check');
        return setPathnameHeader(NextResponse.next());
    }
    
    // bypass for API routes (they handle their own auth)
    if (path.startsWith('/api/')) {
        return setPathnameHeader(NextResponse.next());
    }
    
    // bypass for auth pages
    if (path.startsWith('/auth/') || path.startsWith('/login') || path.startsWith('/signup') || 
        path.startsWith('/forgot-password') || path.startsWith('/reset-password') || 
        path.startsWith('/confirm-signup') || path.startsWith('/new-password') || 
        path.startsWith('/change-password') || path.startsWith('/logout-complete')) {
        return setPathnameHeader(NextResponse.next());
    }
    
    // bypass for forbidden page itself
    if (path === '/forbidden') {
        return setPathnameHeader(NextResponse.next());
    }
    
    // bypass for home page
    if (path === '/') {
        return setPathnameHeader(NextResponse.next());
    }
    
    // check if this path matches a menu item for the current app
    // need to find menu item that matches both path AND app name since multiple apps can have same paths
    const menuItem = appName ? getMenuItemByPathAndApp(path, appName) : undefined;
    
    if (menuItem) {
        // get session for authorization check
        const session = await getServerSessionFromCookies();
        
        const userGroups = session?.user?.groups || [];
        const isAuthenticated = session !== null;
        
        // check if user can access this menu item
        // public items should always be accessible, even without authentication
        const hasAccess = canAccessMenuItem(menuItem, userGroups, isAuthenticated);
        
        if (!hasAccess) {
            console.log('[MIDDLEWARE] Unauthorized access attempt:', path, 'User groups:', userGroups, 'Authenticated:', isAuthenticated, 'IsPublic:', menuItem.isPublic);
            // when not authenticated, send to login with returnTo so they can come back after signing in
            if (!isAuthenticated) {
                const loginUrl = new URL('/auth/login', request.url);
                loginUrl.searchParams.set('returnTo', path);
                return setPathnameHeader(NextResponse.redirect(loginUrl));
            }
            const forbiddenUrl = new URL('/forbidden', request.url);
            return setPathnameHeader(NextResponse.redirect(forbiddenUrl));
        }
        
        // rewrite path to include app name prefix for Next.js routing
        const rewrittenPath = `/${appName}${path}`;
        const url = request.nextUrl.clone();
        url.pathname = rewrittenPath;
        return setPathnameHeader(NextResponse.rewrite(url), path);
    }
    
    // set x-pathname header for server components to access current pathname
    return setPathnameHeader(NextResponse.next());
}

// CONFIG
export const config = {
/* Next.js middleware configuration that defines which routes the middleware should run on. */

    // https://nextjs.org/docs/app/building-your-application/routing/proxy#matcher
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};

