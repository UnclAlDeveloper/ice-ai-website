'use client';

import * as React from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import type { EmotionCache } from '@emotion/cache';

// REGISTRY
export default function Registry({ children }: { children: React.ReactNode }) {
    /* Emotion cache provider that ensures consistent style injection between server and client. */
    
    const [cache] = React.useState<EmotionCache>(() => {
        const cache = createCache({ key: 'css', prepend: true });
        cache.compat = true;
        return cache;
    });

    useServerInsertedHTML(() => {
        const names = Object.keys(cache.inserted);
        if (names.length === 0) {
            return null;
        }
        let styles = '';
        for (const name of names) {
            styles += cache.inserted[name];
        }
        return (
            <style
                data-emotion={`${cache.key} ${names.join(' ')}`}
                dangerouslySetInnerHTML={{
                    __html: styles,
                }}
            />
        );
    });

    return <CacheProvider value={cache}>{children}</CacheProvider>;
}

