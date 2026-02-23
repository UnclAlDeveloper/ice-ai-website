'use client';

import React from "react";
import { AppName } from '@app/utils/appNames';
import IceAIHome from '@components/home/IceAIHome';
import AutoAdsHome from '@components/home/AutoAdsHome';
import AnnaTrainerHome from '@components/home/AnnaTrainerHome';

interface HomePageProps {
    /* Props for HomePage component specifying which app's home page to render. */

    appName: AppName;
}

// HOME PAGE
export default function HomePage({ appName }: HomePageProps) {
    /* Client component that renders the appropriate home page based on the provided app name. */

    switch (appName) {
        case AppName.IceAI:
            return <IceAIHome />;
        case AppName.AutoAds:
            return <AutoAdsHome />;
        case AppName.AnnaTrainer:
            return <AnnaTrainerHome />;
        default:
            return <IceAIHome />;
    }
}
