'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import MenuItem from '@mui/material/MenuItem';
import { Stack, Tooltip, useTheme } from '@mui/material';
import { useSession } from '@app/lib/useSession';
import { LogInButton } from '@components/auth/LogInButton';
import { LogOutButton } from '@components/auth/LogOutButton';
import { getUserInitials } from '@app/lib/getUserInitials';
import { AppName } from '@app/utils/appNames';
import { MenuItem as MenuItemType } from '@app/lib/menuConfig';

interface AppBarClientProps {
    /* Props for AppBarClient component including menu items with access flags, initial auth state, app name, and current pathname. */

    menuItems: Array<MenuItemType & { canAccess: boolean }>;
    initialAuth: { isAuthenticated: boolean; userName: string | null };
    appName: AppName;
    pathname: string;
}

// APP BAR CLIENT
export default function AppBarClient({
    menuItems,
    initialAuth,
    appName,
    pathname: initialPathname,
}: AppBarClientProps) {
    /* Client component for app bar interactivity. Receives pre-computed menu items and auth state from RSC. */

    const { data: session } = useSession();
    const theme = useTheme();
    const pathname = usePathname() || initialPathname;

    // use server-computed auth as initial, update if client session differs
    const isAuthenticated = session?.isAuthenticated ?? initialAuth.isAuthenticated;
    const userName = session?.user?.name || session?.user?.email || initialAuth.userName;

    const shouldHideLogo = (pathname === '/' && !theme.custom.displayBarLogoOnHome) || pathname.startsWith('/auth');

    // separate "About" menu item from others
    const aboutMenuItem = menuItems.find(item => item.name === 'About');
    const navMenuItems = menuItems.filter(item => item.name !== 'About');

    // menu state handlers (client-only - requires useState)
    const [anchorElNav, setAnchorElNav] = React.useState<null | HTMLElement>(null);
    const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(null);

    // HANDLE OPEN NAV MENU
    const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
        /* Opens the navigation menu by setting the anchor element. */

        setAnchorElNav(event.currentTarget);
    };

    // HANDLE OPEN USER MENU
    const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
        /* Opens the user menu by setting the anchor element. */

        setAnchorElUser(event.currentTarget);
    };

    // HANDLE CLOSE NAV MENU
    const handleCloseNavMenu = () => {
        /* Closes the navigation menu by clearing the anchor element. */

        setAnchorElNav(null);
    };

    // HANDLE CLOSE USER MENU
    const handleCloseUserMenu = () => {
        /* Closes the user menu by clearing the anchor element. */

        setAnchorElUser(null);
    };

    return (
        <AppBar
            position="static"
            sx={{
                backgroundColor: theme.custom.appBarBackground,
            }}
        >
            <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
                {/* LEFT GROUP: Logo and Title for md+ */}
                {!shouldHideLogo && (
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }} m={1}>
                        <Stack direction="row" spacing={0.5} alignItems={'center'}>
                            <Tooltip title="Home">
                                <Link href="/" style={{ display: 'flex', alignItems: 'center', marginRight: '4px', height: '50px' }}>
                                    <Box
                                        sx={{
                                            position: 'relative',
                                            height: '50px',
                                            width: 'fit-content',
                                            display: 'flex',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Image
                                            src={theme.custom.logo}
                                            alt={theme.custom.altLogo}
                                            width={50}
                                            height={50}
                                            unoptimized
                                            style={{ 
                                                height: '50px',
                                                width: 'auto',
                                                objectFit: 'contain',
                                            }}
                                            priority
                                        />
                                    </Box>
                                </Link>
                            </Tooltip>
                            {theme.custom.logoText && (
                                <Typography
                                    variant="h4"
                                    noWrap
                                    component={Link}
                                    href="/"
                                    sx={{
                                        textDecoration: 'none',
                                        color: theme.custom.logoTextColor,
                                        fontFamily: theme.custom.logoTextFont,
                                        fontSize: theme.custom.logoTextSize,
                                    }}
                                >
                                    {theme.custom.logoText}
                                </Typography>
                            )}
                        </Stack>
                    </Box>
                )}

                {/* MIDDLE GROUP: Navigation (visible only on md+) */}
                <Stack
                    sx={{
                        flexGrow: 1,
                        display: { xs: 'none', md: 'flex' },
                        alignItems: 'center',
                        ml: shouldHideLogo ? '12px' : (theme.custom.logoText ? 2 : 0),
                    }}
                    spacing={2}
                    direction="row"
                >
                    {navMenuItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.canAccess ? item.path : '#'}
                            style={{ textDecoration: 'none' }}
                            onClick={(e) => {
                                if (!item.canAccess) {
                                    e.preventDefault();
                                }
                            }}
                        >
                            <Typography
                                textAlign="center"
                                sx={{
                                    my: 1,
                                    color: item.canAccess ? theme.custom.menuItemColour : theme.palette.text.disabled,
                                    display: 'block',
                                    textDecoration: 'none',
                                    opacity: item.canAccess ? 1 : 0.5,
                                    cursor: item.canAccess ? 'pointer' : 'not-allowed',
                                }}
                            >
                                {item.name}
                            </Typography>
                        </Link>
                    ))}
                </Stack>

                {/* MOBILE GROUP: Logo and Menu Icon for xs */}
                <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
                    <IconButton
                        size="large"
                        aria-label="account of current user"
                        aria-controls="menu-appbar"
                        aria-haspopup="true"
                        onClick={handleOpenNavMenu}
                        sx={{ color: theme.custom.mobileMenuIconColour }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Menu
                        id="menu-appbar"
                        anchorEl={anchorElNav}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                        }}
                        keepMounted
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                        }}
                        open={Boolean(anchorElNav)}
                        onClose={handleCloseNavMenu}
                    >
                        {navMenuItems.map((item) => (
                            <MenuItem
                                key={item.path}
                                onClick={() => {
                                    if (item.canAccess) {
                                        handleCloseNavMenu();
                                    }
                                }}
                                disabled={!item.canAccess}
                            >
                                <Link
                                    href={item.canAccess ? item.path : '#'}
                                    style={{ textDecoration: 'none', width: '100%' }}
                                    onClick={(e) => {
                                        if (!item.canAccess) {
                                            e.preventDefault();
                                        }
                                    }}
                                >
                                    <Typography
                                        textAlign="left"
                                        sx={{
                                            color: item.canAccess ? theme.custom.mobileMenuItemColour : theme.palette.text.disabled,
                                            display: 'block',
                                            textDecoration: 'none',
                                            opacity: item.canAccess ? 1 : 0.5,
                                        }}
                                    >
                                        {item.name}
                                    </Typography>
                                </Link>
                            </MenuItem>
                        ))}
                        {aboutMenuItem && (
                            <MenuItem
                                key={aboutMenuItem.path}
                                onClick={() => {
                                    if (aboutMenuItem.canAccess) {
                                        handleCloseNavMenu();
                                    }
                                }}
                                disabled={!aboutMenuItem.canAccess}
                            >
                                <Link
                                    href={aboutMenuItem.canAccess ? aboutMenuItem.path : '#'}
                                    style={{ textDecoration: 'none', width: '100%' }}
                                    onClick={(e) => {
                                        if (!aboutMenuItem.canAccess) {
                                            e.preventDefault();
                                        }
                                    }}
                                >
                                    <Typography
                                        textAlign="left"
                                        sx={{
                                            color: aboutMenuItem.canAccess ? theme.custom.mobileMenuItemColour : theme.palette.text.disabled,
                                            display: 'block',
                                            textDecoration: 'none',
                                            opacity: aboutMenuItem.canAccess ? 1 : 0.5,
                                        }}
                                    >
                                        {aboutMenuItem.name}
                                    </Typography>
                                </Link>
                            </MenuItem>
                        )}
                    </Menu>
                    {!shouldHideLogo && (
                        <Link
                            href="/"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                flexGrow: 1,
                                justifyContent: 'center',
                                width: 'auto',
                                position: 'absolute',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                textDecoration: 'none',
                            }}
                        >
                            <Box
                                sx={{
                                    position: 'relative',
                                    height: '45px',
                                    width: 'fit-content',
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                <Image
                                    src={theme.custom.logo}
                                    alt={theme.custom.altLogo}
                                    width={45}
                                    height={45}
                                    unoptimized
                                    style={{ 
                                        height: '45px',
                                        width: 'auto',
                                        objectFit: 'contain',
                                    }}
                                    priority
                                />
                            </Box>
                            {theme.custom.logoText && (
                                <Typography
                                    variant="h5"
                                    noWrap
                                    component="span"
                                    sx={{
                                        ml: 1,
                                        textDecoration: 'none',
                                        color: theme.custom.logoTextColor,
                                        fontFamily: theme.custom.logoTextFont,
                                        fontSize: theme.custom.logoTextSize,
                                    }}
                                >
                                    {theme.custom.logoText}
                                </Typography>
                            )}
                        </Link>
                    )}
                </Box>

                {/* RIGHT GROUP: About menu item and Login or User Info */}
                <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 2, flexGrow: 0, mb: '-2px', mr: { xs: '-6px', md: '6px' } }}>
                    {aboutMenuItem && (
                        <Link
                            href={aboutMenuItem.canAccess ? aboutMenuItem.path : '#'}
                            style={{ textDecoration: 'none' }}
                            onClick={(e) => {
                                if (!aboutMenuItem.canAccess) {
                                    e.preventDefault();
                                }
                            }}
                        >
                            <Typography
                                textAlign="center"
                                sx={{
                                    my: 1,
                                    color: aboutMenuItem.canAccess ? theme.custom.menuItemColour : theme.palette.text.disabled,
                                    display: 'block',
                                    textDecoration: 'none',
                                    opacity: aboutMenuItem.canAccess ? 1 : 0.5,
                                    cursor: aboutMenuItem.canAccess ? 'pointer' : 'not-allowed',
                                }}
                            >
                                {aboutMenuItem.name}
                            </Typography>
                        </Link>
                    )}
                    {(!isAuthenticated && !pathname.startsWith('/auth/') && (
                        <Tooltip title="Login / New User">
                            <span>
                                <LogInButton>
                                    <PersonIcon />
                                </LogInButton>
                            </span>
                        </Tooltip>
                    )) || (
                        isAuthenticated && (
                            <Button variant="text" onClick={handleOpenUserMenu}>
                                <Typography color={theme.custom.userNameColour} sx={{ display: { xs: 'none', md: 'block' } }}>
                                    {userName || 'Account'}
                                </Typography>
                                <Typography color={theme.custom.userNameColour} sx={{ display: { xs: 'block', md: 'none' } }}>
                                    {getUserInitials(userName || 'Account')}
                                </Typography>
                            </Button>
                        )
                    )}
                </Box>

                {/* MOBILE RIGHT GROUP: Login or User Info (xs only) */}
                <Box sx={{ display: { xs: 'flex', md: 'none' }, flexGrow: 0, mb: '-2px', mr: { xs: '-6px', md: '6px' } }}>
                    {(!isAuthenticated && !pathname.startsWith('/auth/') && (
                        <Tooltip title="Login / New User">
                            <span>
                                <LogInButton>
                                    <PersonIcon />
                                </LogInButton>
                            </span>
                        </Tooltip>
                    )) || (
                        isAuthenticated && (
                            <Button variant="text" onClick={handleOpenUserMenu}>
                                <Typography color={theme.custom.userNameColour} sx={{ display: { xs: 'none', md: 'block' } }}>
                                    {userName || 'Account'}
                                </Typography>
                                <Typography color={theme.custom.userNameColour} sx={{ display: { xs: 'block', md: 'none' } }}>
                                    {getUserInitials(userName || 'Account')}
                                </Typography>
                            </Button>
                        )
                    )}
                    <Menu
                        sx={{ mt: '45px' }}
                        id="menu-appbar"
                        anchorEl={anchorElUser}
                        anchorOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        keepMounted
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        open={Boolean(anchorElUser)}
                        onClose={handleCloseUserMenu}
                    >
                        <MenuItem key="SignOut">
                            <LogOutButton>
                                <Typography textAlign="center" color={theme.custom.userMenuItemColour}>
                                    Log Out
                                </Typography>
                            </LogOutButton>
                        </MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    );
}
