import React from "react";
import {AppName} from '@app/utils/appNames';
import IceAIHome from '@components/home/IceAIHome';
import AutoAdsHome from '@components/home/AutoAdsHome';
import AnnaTrainerHome from '@components/home/AnnaTrainerHome';

// HOME PAGE PROPS
interface HomePageProps {
    /* Props for HomePage selecting which app's home page to render. */

    appName: AppName;
}

// HOME PAGE
export default function HomePage({appName}: HomePageProps) {
    /**
     * Server component that picks the correct app-specific home page based on
     * the resolved hostname. Kept as a server component so its children can
     * fetch data on the server when they need to (for example AutoAdsHome).
     */

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
