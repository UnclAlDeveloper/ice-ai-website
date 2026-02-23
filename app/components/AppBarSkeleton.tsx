'use client';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Skeleton from '@mui/material/Skeleton';
import { Stack, useTheme } from '@mui/material';

// APP BAR SKELETON
export default function AppBarSkeleton() {
    /* Loading skeleton for the AppBar while server data is being fetched. Displays placeholder content matching the AppBar layout. */

    const theme = useTheme();

    return (
        <AppBar
            position="static"
            sx={{
                backgroundColor: theme.custom?.appBarBackground || 'transparent',
            }}
        >
            <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
                {/* LEFT GROUP: Logo skeleton for md+ */}
                <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }} m={1}>
                    <Stack direction="row" spacing={0.5} alignItems={'center'}>
                        <Skeleton variant="rectangular" width={50} height={50} />
                    </Stack>
                </Box>

                {/* MIDDLE GROUP: Navigation skeleton for md+ */}
                <Stack
                    sx={{
                        flexGrow: 1,
                        display: { xs: 'none', md: 'flex' },
                        alignItems: 'center',
                        ml: 2,
                    }}
                    spacing={2}
                    direction="row"
                >
                    <Skeleton variant="text" width={60} height={24} />
                    <Skeleton variant="text" width={60} height={24} />
                    <Skeleton variant="text" width={80} height={24} />
                </Stack>

                {/* MOBILE GROUP: Menu icon skeleton for xs */}
                <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
                    <Skeleton variant="circular" width={40} height={40} />
                    <Box
                        sx={{
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                        }}
                    >
                        <Skeleton variant="rectangular" width={45} height={45} />
                    </Box>
                </Box>

                {/* RIGHT GROUP: About and user skeleton */}
                <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 2, flexGrow: 0, mr: { xs: '-6px', md: '6px' } }}>
                    <Skeleton variant="text" width={50} height={24} />
                    <Skeleton variant="circular" width={40} height={40} />
                </Box>

                {/* MOBILE RIGHT GROUP: User skeleton for xs */}
                <Box sx={{ display: { xs: 'flex', md: 'none' }, flexGrow: 0, mr: { xs: '-6px', md: '6px' } }}>
                    <Skeleton variant="circular" width={40} height={40} />
                </Box>
            </Toolbar>
        </AppBar>
    );
}
