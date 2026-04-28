"use client";

import React, {useState, useRef, useEffect, useCallback} from "react";
import {Card, CardContent, Typography, Link, Box, useTheme, useMediaQuery, Collapse, IconButton, Rating, Button, Dialog, DialogContent, DialogTitle, CircularProgress} from "@mui/material";
import CurrencyTextField from "./CurrencyTextField";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import CloseIcon from "@mui/icons-material/Close";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {prospectListings} from '@/drizzle/auto-ads/schema';
import {InferSelectModel} from "drizzle-orm";
import {playTextAsSpeech, getCurrentPlayingText, stopCurrentAudio} from "../lib/textToSpeech";
import {stripMarkdown} from "../lib/markdownSpeech";
import {useSession} from "@app/lib/useSession";
import {getUserTier, compareTiers} from "@app/lib/menuUtils";
import {updateProspectInterest, fetchListingImages, copyProspectToResale} from "./actions";
import AiAnalysisSection from "./AiAnalysisSection";


// STATUS COLOR MAP
const statusColorMap: Record<string, string> = {
    'New': 'primary.main',           // theme color
    'Viewed': 'info.main',           // theme color
    'Not Interested': '#bdbdbd',     // light grey
    'Interested': 'success.main',    // theme color
    'Bought': '#9c27b0',             // custom hex (purple)
};

// LISTING SOURCE LOGO PATHS (under public/images/auto-ads/sources/)
const listingSourceLogoMap: Record<string, string> = {
    'Autotrader': '/images/auto-ads/sources/autotrader.png',
    'Car&Classic': '/images/auto-ads/sources/carandclassic.svg',
    'eBay': '/images/auto-ads/sources/ebay.png',
    'Facebook': '/images/auto-ads/sources/facebook.png',
    'Gumtree': '/images/auto-ads/sources/gumtree.png',
    'OnlyVans': '/images/auto-ads/sources/onlyvans.png',
};

// GET STATUS COLOR
const getStatusColor = (status: string): string => {
    /**
     * Returns a color for the given status. Can be a theme path (e.g. 'primary.main')
     * or a custom hex color (e.g. '#9c27b0'). Falls back to text.primary if unknown.
     */

    return statusColorMap[status] || 'text.primary';
};

// FORMAT TIME UNTIL AUCTION
const formatTimeUntilAuction = (auctionCloses: string | null): string | null => {
    /**
     * Returns a human-readable string for the time until auction closes.
     * If less than 2 days, shows hours; otherwise shows days. Returns null if no date or already ended.
     */

    if (!auctionCloses) return null;
    const closes = new Date(auctionCloses);
    const now = new Date();
    const diffMs = closes.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;
    if (diffDays < 2) {
        const hours = Math.max(1, Math.round(diffHours));
        return `${hours} hour${hours === 1 ? '' : 's'}`;
    }
    const days = Math.max(1, Math.round(diffDays));
    return `${days} day${days === 1 ? '' : 's'}`;
};

// SPEAK TEXT
const speakText = async (text: string, onEnded?: () => void): Promise<{success: boolean; stopped?: boolean; error?: string}> => {
    /**
     * Converts text to speech and plays it aloud via the TTS dispatcher (native on mobile, ElevenLabs on desktop).
     * Returns the result so callers can update playback state; onEnded is called when playback finishes.
     */

    const result = await playTextAsSpeech(text, {onEnded});
    if (!result.success) {
        console.error("Failed to speak text:", result.error);
    }
    return result;
};

// PROSPECT CARD
interface ProspectCardProps {
    listing: InferSelectModel<typeof prospectListings>;
    imageUrl?: string | null;
    showCopyToResale?: boolean;
}

export default function ProspectCard({listing, imageUrl, showCopyToResale}: ProspectCardProps) {
    /**
     * Displays a single prospect listing in a card format, showing key details
     * such as make and model, description, year, mileage, price, location, status,
     * and a link to view the full listing. Optionally displays an image on the left side.
     */

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [descriptionExpanded, setDescriptionExpanded] = useState(false);
    const [playingText, setPlayingText] = useState<string | null>(null);
    const playingTextRef = useRef<string | null>(null);
    useEffect(() => {
        playingTextRef.current = playingText;
    }, [playingText]);
    const {data: session} = useSession();
    const [interestLevel, setInterestLevel] = useState<number | null>(listing.interestLevel);
    const [adsEstBuyPrice, setAdsEstBuyPrice] = useState<number | null>(listing.adsEstBuyPrice ?? null);
    const [adsEstSellPrice, setAdsEstSellPrice] = useState<number | null>(listing.adsEstSellPrice ?? null);
    const [localStatus, setLocalStatus] = useState<string>(listing.status);
    const [saving, setSaving] = useState(false);
    const [copying, setCopying] = useState(false);
    const [copiedToResale, setCopiedToResale] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<{id: number; url: string; isPrimary: boolean | null}[]>([]);
    const [galleryLoading, setGalleryLoading] = useState(false);

    // HANDLE GALLERY OPEN
    const handleGalleryOpen = useCallback(async () => {
        /**
         * Opens the image gallery modal and fetches all images for this prospect
         * listing from the database, ordered by insertion order.
         */

        setGalleryOpen(true);
        setGalleryLoading(true);
        try {
            const result = await fetchListingImages("Prospect", listing.id);
            if (result.success && result.images) {
                setGalleryImages(result.images);
            } else {
                console.error("Failed to fetch gallery images:", result.error);
            }
        } catch (err) {
            console.error("Failed to fetch gallery images:", err);
        } finally {
            setGalleryLoading(false);
        }
    }, [listing.id]);

    // HANDLE GALLERY CLOSE
    const handleGalleryClose = useCallback(() => {
        /**
         * Closes the image gallery modal.
         */

        setGalleryOpen(false);
    }, []);

    // HANDLE RATING CHANGE
    const handleRatingChange = (_event: React.SyntheticEvent, newValue: number | null) => {
        /**
         * Updates local interest level and derives the status: 1-3 sets Not Interested,
         * 4-5 sets Interested, and null reverts to the original listing status.
         */

        setInterestLevel(newValue);
        if (newValue !== null && newValue >= 1 && newValue <= 3) {
            setLocalStatus('Not Interested');
        } else if (newValue !== null && newValue >= 4) {
            setLocalStatus('Interested');
        } else {
            setLocalStatus(listing.status);
        }
    };

    // HANDLE SAVE
    const handleSave = async () => {
        /**
         * Validates required fields (buy/sell prices when interest >= 4) and persists
         * the interest level, derived status, and estimated prices to the database.
         */

        if (interestLevel === null) return;

        if (interestLevel >= 4) {
            if (adsEstBuyPrice == null) return;
            if (adsEstSellPrice == null) return;
        }

        const newStatus = interestLevel >= 4 ? 'Interested' as const : 'Not Interested' as const;

        setSaving(true);
        try {
            const result = await updateProspectInterest(
                listing.id,
                interestLevel,
                newStatus,
                interestLevel >= 4 ? adsEstBuyPrice : null,
                interestLevel >= 4 ? adsEstSellPrice : null,
            );
            if (!result.success) {
                console.error("Failed to save prospect interest:", result.error);
            }
        } catch (err) {
            console.error("Failed to save prospect interest:", err);
        } finally {
            setSaving(false);
        }
    };

    // HANDLE COPY TO RESALE
    const handleCopyToResale = async () => {
        /**
         * Copies the prospect listing into the resale_listings table via the
         * server action. Marks the button as copied on success so it cannot
         * be pressed a second time in the same session.
         */

        setCopying(true);
        try {
            const result = await copyProspectToResale(listing.id);
            if (result.success) {
                setCopiedToResale(true);
            } else {
                console.error("Failed to copy to resale:", result.error);
            }
        } catch (err) {
            console.error("Failed to copy to resale:", err);
        } finally {
            setCopying(false);
        }
    };

    const handleSpeak = (text: string): void => {
        if (getCurrentPlayingText() === text) {
            stopCurrentAudio();
            setPlayingText(null);
            return;
        }
        setPlayingText(null);
        setPlayingText(text);
        void speakText(text, () => setPlayingText(null)).then((result) => {
            if ((!result?.success || result?.stopped) && playingTextRef.current === text) {
                setPlayingText(null);
            }
        });
    };

    const descriptionText = stripMarkdown(listing.fullDescription || '');

    const handleDescriptionExpandClick = () => {
        setDescriptionExpanded(!descriptionExpanded);
    };

    // check if user has AdvancedTier or higher
    const userTier = getUserTier(session?.user?.groups || []);
    const canViewPricing = compareTiers(userTier, 'AdvancedTier');
    const timeUntilAuction = formatTimeUntilAuction(listing.auctionCloses);

    return (
        <>
        <Card sx={{ mb: 2 }}>
            <CardContent sx={{ 
                display: 'flex', 
                gap: 2, 
                p: 2,
                flexDirection: { xs: 'column', sm: 'row' },
            }}>
                <Box
                    sx={{
                        width: { xs: '100%', sm: '120px' },
                        height: { xs: 'auto', sm: '120px' },
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: { xs: 'center', sm: 'flex-start' },
                        padding: 0,
                        margin: 0,
                        border: 0,
                    }}
                >
                    {imageUrl && (
                        <Box
                            onClick={handleGalleryOpen}
                            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                            <Box
                                component="img"
                                src={imageUrl}
                                alt={listing.makeAndModel}
                                sx={{
                                    maxHeight: { xs: '200px', sm: '120px' },
                                    maxWidth: { xs: '100%', sm: '120px' },
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'contain',
                                }}
                            />
                        </Box>
                    )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <Typography variant="body2" component="span" sx={{ color: getStatusColor(localStatus) }}>
                            <strong>{localStatus}</strong>
                        </Typography>
                        {listingSourceLogoMap[listing.listingSource] && (
                            <Link
                                href={listing.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1, transform: 'translateY(5px)', marginBottom: -5 }}
                                aria-label={`View on ${listing.listingSource}`}
                            >
                                <Box
                                    component="img"
                                    src={listingSourceLogoMap[listing.listingSource]}
                                    alt={listing.listingSource}
                                    sx={{
                                        height: 20,
                                        width: 'auto',
                                        objectFit: 'contain',
                                        verticalAlign: 'middle',
                                    }}
                                />
                            </Link>
                        )}
                        <Typography variant="h6" component="div">
                            <Link href={listing.url} target="_blank" rel="noopener noreferrer" sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                {listing.makeAndModel}
                            </Link>
                        </Typography>
                    </div>
                    <Typography variant="body2" color="text.secondary">
                        {listing.shortDescription}
                    </Typography>
                    <Typography variant="body2">
                        {listing.year && (
                            <>
                                <Box component="span" sx={{ color: theme.custom.labelColour }}>Year: </Box>
                                {listing.year}
                            </>
                        )}
                        {listing.year && listing.mileage && ' • '}
                        {listing.mileage && (
                            <>
                                <Box component="span" sx={{ color: theme.custom.labelColour }}>Mileage: </Box>
                                {Number(listing.mileage).toLocaleString()} {listing.mileageUnit || ''}
                            </>
                        )}
                        {(listing.year || listing.mileage) && ' • '}
                        <Box component="span" sx={{ color: theme.custom.labelColour }}>Price: </Box>
                        {listing.currencySymbol || '£'}{listing.askingPrice?.toLocaleString()}
                        {listing.vatStatus && listing.vatStatus !== 'No VAT' && (
                            <> {listing.vatStatus}</>
                        )}
                        {listing.location && ' • '}
                        {listing.location && (
                            <>
                                <Box component="span" sx={{ color: theme.custom.labelColour }}>Location: </Box>
                                {listing.location}
                            </>
                        )}
                        {timeUntilAuction && ' • '}
                        {timeUntilAuction && (
                            <>
                                <Box component="span" sx={{ color: theme.custom.labelColour }}>Auction Closes: </Box>
                                {timeUntilAuction}
                            </>
                        )}
                    </Typography>
                    {listing.fullDescription && (
                        <>
                            {isMobile ? (
                                <>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, ml: 0, gap: 0.5 }}>
                                        <IconButton
                                            onClick={handleDescriptionExpandClick}
                                            sx={{ p: 0, ml: 0, mr: 0, minWidth: 'auto', color: 'inherit' }}
                                        >
                                            {descriptionExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                        </IconButton>
                                        <Typography variant="body2" sx={{ ml: 0.5, color: theme.custom.labelColour }}>
                                            Description
                                        </Typography>
                                        <IconButton
                                            onClick={() => handleSpeak(descriptionText)}
                                            size="small"
                                            sx={{ p: 0.5, minWidth: 'auto' }}
                                            title="Speak description"
                                            color={playingText === descriptionText ? 'secondary' : 'inherit'}
                                        >
                                            <VolumeUpIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                    <Collapse in={descriptionExpanded} timeout="auto" unmountOnExit>
                                        <Box sx={{ mt: 1, maxWidth: '100%', overflow: 'hidden' }}>
                                            <Box sx={{
                                                fontSize: '0.875rem',
                                                wordBreak: 'break-word',
                                                overflowWrap: 'break-word',
                                                '& p': { margin: '0.5em 0' },
                                                '& ul, & ol': { margin: '0.5em 0', paddingLeft: '1.5em' },
                                                '& li': { margin: '0.75em 0' },
                                                '& h1, & h2, & h3, & h4, & h5, & h6': { margin: '0.75em 0 0.5em 0' },
                                                '& strong': { fontWeight: 'bold' },
                                                '& em': { fontStyle: 'italic' },
                                            }}>
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{listing.fullDescription}</ReactMarkdown>
                                            </Box>
                                        </Box>
                                    </Collapse>
                                </>
                            ) : (
                                <Box sx={{ mt: 1, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                    <IconButton
                                        onClick={() => handleSpeak(descriptionText)}
                                        size="small"
                                        sx={{ p: 0.5, minWidth: 'auto', flexShrink: 0 }}
                                        title="Speak description"
                                        color={playingText === descriptionText ? 'secondary' : 'inherit'}
                                    >
                                        <VolumeUpIcon fontSize="small" />
                                    </IconButton>
                                    <Box sx={{
                                        fontSize: '0.875rem',
                                        wordBreak: 'break-word',
                                        overflowWrap: 'break-word',
                                        flex: 1,
                                        minWidth: 0,
                                        '& p': { margin: '0.5em 0' },
                                        '& ul, & ol': { margin: '0.5em 0', paddingLeft: '1.5em' },
                                        '& li': { margin: '0.75em 0' },
                                        '& h1, & h2, & h3, & h4, & h5, & h6': { margin: '0.75em 0 0.5em 0' },
                                        '& strong': { fontWeight: 'bold' },
                                        '& em': { fontStyle: 'italic' },
                                    }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{listing.fullDescription}</ReactMarkdown>
                                    </Box>
                                </Box>
                            )}
                        </>
                    )}
                    <AiAnalysisSection
                        data={listing}
                        askingPrice={listing.askingPrice}
                        currencySymbol={listing.currencySymbol}
                        canViewPricing={canViewPricing}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" sx={{ color: theme.custom.labelColour }}>Interest</Typography>
                            <Rating
                                value={interestLevel}
                                onChange={handleRatingChange}
                                size="small"
                            />
                        </Box>
                        {interestLevel !== null && interestLevel >= 4 && (
                            <>
                                <CurrencyTextField
                                    label="Buy Price"
                                    placeholder="Estimated"
                                    size="small"
                                    required
                                    currencySymbol={listing.currencySymbol || '£'}
                                    value={adsEstBuyPrice}
                                    onChange={(v) => setAdsEstBuyPrice(v)}
                                    sx={{width: 150}}
                                />
                                <CurrencyTextField
                                    label="Sell Price"
                                    placeholder="Estimated"
                                    size="small"
                                    required
                                    currencySymbol={listing.currencySymbol || '£'}
                                    value={adsEstSellPrice}
                                    onChange={(v) => setAdsEstSellPrice(v)}
                                    sx={{width: 150}}
                                />
                            </>
                        )}
                        <Button
                            variant="contained"
                            size="small"
                            onClick={handleSave}
                            disabled={saving || interestLevel === null}
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                        {showCopyToResale && (
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={handleCopyToResale}
                                disabled={copying || copiedToResale}
                            >
                                {copying ? 'Copying…' : copiedToResale ? 'Copied to Resales' : 'Copy to Resales'}
                            </Button>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>

            {/* IMAGE GALLERY MODAL */}
            <Dialog
                open={galleryOpen}
                onClose={handleGalleryClose}
                maxWidth={false}
                fullScreen={isMobile}
                slotProps={{
                    paper: {
                        sx: {
                            width: isMobile ? '100%' : '90vw',
                            maxWidth: isMobile ? '100%' : '1400px',
                            maxHeight: isMobile ? '100%' : '90vh',
                        },
                    },
                }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
                    <Typography variant="h6" component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {listing.makeAndModel}
                    </Typography>
                    <IconButton onClick={handleGalleryClose} aria-label="Close gallery" edge="end">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ p: isMobile ? 1 : 2 }}>
                    {galleryLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                            <CircularProgress />
                        </Box>
                    ) : galleryImages.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            No images available for this listing.
                        </Typography>
                    ) : (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: isMobile ? 'column' : 'row',
                                flexWrap: isMobile ? 'nowrap' : 'wrap',
                                gap: isMobile ? 1 : 2,
                                alignItems: isMobile ? 'stretch' : 'flex-start',
                            }}
                        >
                            {galleryImages.map((img) => (
                                <Box
                                    key={img.id}
                                    component="img"
                                    src={img.url}
                                    alt={listing.makeAndModel}
                                    sx={{
                                        width: isMobile ? '100%' : 'auto',
                                        maxWidth: '100%',
                                        height: 'auto',
                                        display: 'block',
                                    }}
                                />
                            ))}
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
