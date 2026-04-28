"use client";

import React, {useState, useRef, useEffect} from "react";
import {
    Box,
    Typography,
    Collapse,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableRow,
    useTheme,
    useMediaQuery,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {playTextAsSpeech, getCurrentPlayingText, stopCurrentAudio} from "../lib/textToSpeech";
import {stripMarkdown} from "../lib/markdownSpeech";

// AI ANALYSIS DATA
export interface AiAnalysisData {
    /**
     * Subset of prospect_listings columns produced by the Gemini AI analysis.
     * Mirrors the shape returned by the runAiAnalysis server action and is
     * the input contract for AiAnalysisSection.
     */

    aiResellOverview: string | null;
    aiWorkAndRepairs: string | null;
    aiResellNotes: string | null;
    aiCampervanConversion: string | null;
    aiValueAddImprovements: string | null;
    aiTargetMarket: string | null;
    aiBuyPriceLow: number | null;
    aiBuyPriceHigh: number | null;
    aiRepairCost: number | null;
    aiSellPriceLow: number | null;
    aiSellPriceHigh: number | null;
}

// AI ANALYSIS SECTION PROPS
interface AiAnalysisSectionProps {
    data: AiAnalysisData;
    askingPrice: number | null;
    currencySymbol: string | null;
    canViewPricing: boolean;
    defaultExpanded?: boolean;
}
/** Props accepted by the AI Assistant pane. Pricing context is passed in so
 *  the markup can be reused for prospect cards and the manual-entry editor. */

// AI ANALYSIS SECTION
export default function AiAnalysisSection({
    data,
    askingPrice,
    currencySymbol,
    canViewPricing,
    defaultExpanded = false,
}: AiAnalysisSectionProps) {
    /**
     * Expandable AI Assistant pane that renders all AI-generated narrative
     * fields and a derived pricing table. Each text section has a speak
     * button that plays the content through the TTS dispatcher. Designed to
     * be embedded inside both the prospect card and the manual-entry editor
     * so the same UI shows everywhere AI analysis is consumed.
     */

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [playingText, setPlayingText] = useState<string | null>(null);
    const playingTextRef = useRef<string | null>(null);

    useEffect(() => {
        playingTextRef.current = playingText;
    }, [playingText]);

    // HANDLE SPEAK
    const handleSpeak = (text: string): void => {
        /**
         * Toggles speech playback for the supplied text. If the same text is
         * already playing, stops audio; otherwise starts a new playback and
         * highlights the matching speaker icon.
         */

        if (getCurrentPlayingText() === text) {
            stopCurrentAudio();
            setPlayingText(null);
            return;
        }
        setPlayingText(null);
        setPlayingText(text);
        void playTextAsSpeech(text, {onEnded: () => setPlayingText(null)}).then((result) => {
            if ((!result?.success || result?.stopped) && playingTextRef.current === text) {
                setPlayingText(null);
            }
        });
    };

    const overviewText = stripMarkdown(data.aiResellOverview || "");
    const workAndRepairsText = stripMarkdown(data.aiWorkAndRepairs || "");
    const notesText = stripMarkdown(data.aiResellNotes || "");
    const campervanText = stripMarkdown(data.aiCampervanConversion || "");
    const valueAddImprovementsText = stripMarkdown(data.aiValueAddImprovements || "");
    const targetMarketText = stripMarkdown(data.aiTargetMarket || "");

    return (
        <Box>
            <Box sx={{display: "flex", alignItems: "center", mt: 0, ml: 0}}>
                <IconButton
                    onClick={() => setExpanded((prev) => !prev)}
                    sx={{p: 0, ml: 0, mr: 0, minWidth: "auto", color: "inherit"}}
                >
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                <Typography variant="body2" sx={{ml: 0.5, color: theme.custom.labelColour}}>
                    AI Assistant
                </Typography>
            </Box>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Box sx={{mt: 1, maxWidth: "100%", overflow: "hidden"}}>
                    {data.aiResellOverview && (
                        <Box sx={{mb: 2}}>
                            <Box sx={{display: "flex", alignItems: "center", gap: 1, mb: 1}}>
                                <Typography variant="subtitle2" sx={{color: theme.custom.labelColour}}>
                                    Overview
                                </Typography>
                                <IconButton
                                    onClick={() => handleSpeak(overviewText)}
                                    size="small"
                                    sx={{p: 0.5, minWidth: "auto"}}
                                    title="Speak overview"
                                    color={playingText === overviewText ? "secondary" : "inherit"}
                                >
                                    <VolumeUpIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Box sx={{
                                fontSize: "0.875rem",
                                wordBreak: "break-word",
                                overflowWrap: "break-word",
                                "& p": {margin: "0.5em 0"},
                                "& ul, & ol": {margin: "0.5em 0", paddingLeft: "1.5em"},
                                "& li": {margin: "0.75em 0"},
                                "& h1, & h2, & h3, & h4, & h5, & h6": {margin: "0.75em 0 0.5em 0"},
                                "& strong": {fontWeight: "bold"},
                                "& em": {fontStyle: "italic"},
                            }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.aiResellOverview}</ReactMarkdown>
                            </Box>
                        </Box>
                    )}
                    {data.aiWorkAndRepairs && (
                        <Box sx={{mb: 2}}>
                            <Box sx={{display: "flex", alignItems: "center", gap: 1, mb: 1}}>
                                <Typography variant="subtitle2" sx={{color: theme.custom.labelColour}}>
                                    Work and Repairs
                                </Typography>
                                <IconButton
                                    onClick={() => handleSpeak(workAndRepairsText)}
                                    size="small"
                                    sx={{p: 0.5, minWidth: "auto"}}
                                    title="Speak work and repairs"
                                    color={playingText === workAndRepairsText ? "secondary" : "inherit"}
                                >
                                    <VolumeUpIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Box sx={{
                                fontSize: "0.875rem",
                                wordBreak: "break-word",
                                overflowWrap: "break-word",
                                "& p": {margin: "0.5em 0"},
                                "& ul, & ol": {margin: "0.5em 0", paddingLeft: "1.5em"},
                                "& h1, & h2, & h3, & h4, & h5, & h6": {margin: "0.75em 0 0.5em 0"},
                                "& strong": {fontWeight: "bold"},
                                "& em": {fontStyle: "italic"},
                                "& table": {
                                    borderCollapse: "collapse",
                                    width: "100%",
                                    margin: "0.5em 0",
                                    display: "block",
                                    overflowX: "auto",
                                },
                                "& th, & td": {
                                    border: `1px solid ${theme.palette.divider}`,
                                    padding: {xs: "6px 4px", sm: "6px 10px"},
                                    textAlign: "left",
                                    wordBreak: "break-word",
                                },
                                "& th": {
                                    backgroundColor: theme.palette.action.hover,
                                    fontWeight: "bold",
                                },
                                "& tr:nth-of-type(even)": {
                                    backgroundColor: theme.palette.action.hover,
                                },
                                "& td:first-of-type": {
                                    minWidth: {xs: "90px"},
                                },
                            }}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        th: ({children, ...props}) => {
                                            const text = String(children).toLowerCase().trim();
                                            if (isMobile && text === "item") {
                                                return (
                                                    <th {...props} style={{minWidth: "90px"}}>
                                                        {children}
                                                    </th>
                                                );
                                            }
                                            if (isMobile && text.includes("estimated cost")) {
                                                return (
                                                    <th {...props} style={{minWidth: "60px", width: "60px"}}>
                                                        Est.<br />Cost
                                                    </th>
                                                );
                                            }
                                            return <th {...props}>{children}</th>;
                                        },
                                    }}
                                >
                                    {data.aiWorkAndRepairs}
                                </ReactMarkdown>
                            </Box>
                        </Box>
                    )}
                    {data.aiResellNotes && (
                        <Box sx={{mb: 2}}>
                            <Box sx={{display: "flex", alignItems: "center", gap: 1, mb: 1}}>
                                <Typography variant="subtitle2" sx={{color: theme.custom.labelColour}}>
                                    Notes
                                </Typography>
                                <IconButton
                                    onClick={() => handleSpeak(notesText)}
                                    size="small"
                                    sx={{p: 0.5, minWidth: "auto"}}
                                    title="Speak notes"
                                    color={playingText === notesText ? "secondary" : "inherit"}
                                >
                                    <VolumeUpIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Box sx={{
                                fontSize: "0.875rem",
                                wordBreak: "break-word",
                                overflowWrap: "break-word",
                                "& p": {margin: "0.5em 0"},
                                "& ul, & ol": {margin: "0.5em 0", paddingLeft: "1.5em"},
                                "& li": {margin: "0.75em 0"},
                                "& h1, & h2, & h3, & h4, & h5, & h6": {margin: "0.75em 0 0.5em 0"},
                                "& strong": {fontWeight: "bold"},
                                "& em": {fontStyle: "italic"},
                            }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.aiResellNotes}</ReactMarkdown>
                            </Box>
                        </Box>
                    )}
                    {data.aiCampervanConversion && (
                        <Box sx={{mb: 2}}>
                            <Box sx={{display: "flex", alignItems: "center", gap: 1, mb: 1}}>
                                <Typography variant="subtitle2" sx={{color: theme.custom.labelColour}}>
                                    Campervan Conversion
                                </Typography>
                                <IconButton
                                    onClick={() => handleSpeak(campervanText)}
                                    size="small"
                                    sx={{p: 0.5, minWidth: "auto"}}
                                    title="Speak campervan conversion"
                                    color={playingText === campervanText ? "secondary" : "inherit"}
                                >
                                    <VolumeUpIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Box sx={{
                                fontSize: "0.875rem",
                                wordBreak: "break-word",
                                overflowWrap: "break-word",
                                "& p": {margin: "0.5em 0"},
                                "& ul, & ol": {margin: "0.5em 0", paddingLeft: "1.5em"},
                                "& li": {margin: "0.75em 0"},
                                "& h1, & h2, & h3, & h4, & h5, & h6": {margin: "0.75em 0 0.5em 0"},
                                "& strong": {fontWeight: "bold"},
                                "& em": {fontStyle: "italic"},
                            }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.aiCampervanConversion}</ReactMarkdown>
                            </Box>
                        </Box>
                    )}
                    {data.aiValueAddImprovements && (
                        <Box sx={{mb: 2}}>
                            <Box sx={{display: "flex", alignItems: "center", gap: 1, mb: 1}}>
                                <Typography variant="subtitle2" sx={{color: theme.custom.labelColour}}>
                                    Value Add Improvements
                                </Typography>
                                <IconButton
                                    onClick={() => handleSpeak(valueAddImprovementsText)}
                                    size="small"
                                    sx={{p: 0.5, minWidth: "auto"}}
                                    title="Speak value add improvements"
                                    color={playingText === valueAddImprovementsText ? "secondary" : "inherit"}
                                >
                                    <VolumeUpIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Box sx={{
                                fontSize: "0.875rem",
                                wordBreak: "break-word",
                                overflowWrap: "break-word",
                                "& p": {margin: "0.5em 0"},
                                "& ul, & ol": {margin: "0.5em 0", paddingLeft: "1.5em"},
                                "& li": {margin: "0.75em 0"},
                                "& h1, & h2, & h3, & h4, & h5, & h6": {margin: "0.75em 0 0.5em 0"},
                                "& strong": {fontWeight: "bold"},
                                "& em": {fontStyle: "italic"},
                            }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.aiValueAddImprovements}</ReactMarkdown>
                            </Box>
                        </Box>
                    )}
                    {data.aiTargetMarket && (
                        <Box sx={{mb: 2}}>
                            <Box sx={{display: "flex", alignItems: "center", gap: 1, mb: 1}}>
                                <Typography variant="subtitle2" sx={{color: theme.custom.labelColour}}>
                                    Target Market
                                </Typography>
                                <IconButton
                                    onClick={() => handleSpeak(targetMarketText)}
                                    size="small"
                                    sx={{p: 0.5, minWidth: "auto"}}
                                    title="Speak target market"
                                    color={playingText === targetMarketText ? "secondary" : "inherit"}
                                >
                                    <VolumeUpIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Box sx={{
                                fontSize: "0.875rem",
                                wordBreak: "break-word",
                                overflowWrap: "break-word",
                                "& p": {margin: "0.5em 0"},
                                "& ul, & ol": {margin: "0.5em 0", paddingLeft: "1.5em"},
                                "& li": {margin: "0.75em 0"},
                                "& h1, & h2, & h3, & h4, & h5, & h6": {margin: "0.75em 0 0.5em 0"},
                                "& strong": {fontWeight: "bold"},
                                "& em": {fontStyle: "italic"},
                            }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.aiTargetMarket}</ReactMarkdown>
                            </Box>
                        </Box>
                    )}
                    {canViewPricing && (
                        <Box sx={{mb: 2}}>
                            <Typography variant="subtitle2" sx={{color: theme.custom.labelColour, mb: 1}}>
                                Pricing
                            </Typography>
                            <Table
                                size="small"
                                sx={{
                                    fontSize: "0.875rem",
                                    width: "100%",
                                    tableLayout: {xs: "fixed", sm: "auto"},
                                    "& .MuiTableBody-root .MuiTableRow-root": {border: "none"},
                                }}
                            >
                                <TableBody>
                                    <TableRow sx={{border: "none"}}>
                                        <TableCell sx={{color: theme.palette.text.primary, border: "none", padding: "4px 8px 4px 1.5em", whiteSpace: {xs: "normal", sm: "nowrap"}, fontWeight: "bold", position: "relative", width: {xs: "45%", sm: "auto"}}}>
                                            <span style={{position: "absolute", left: "0.5em"}}>•</span>
                                            Asking Price:
                                        </TableCell>
                                        <TableCell sx={{color: theme.palette.text.primary, border: "none", padding: "4px 0", textAlign: "left", whiteSpace: {xs: "normal", sm: "nowrap"}, wordBreak: "break-word"}}>
                                            {currencySymbol || "£"}{askingPrice?.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                    {data.aiBuyPriceLow !== null && data.aiBuyPriceHigh !== null && (
                                        <TableRow sx={{border: "none"}}>
                                            <TableCell sx={{color: theme.palette.text.primary, border: "none", padding: "4px 8px 4px 1.5em", whiteSpace: {xs: "normal", sm: "nowrap"}, fontWeight: "bold", position: "relative", width: {xs: "45%", sm: "auto"}}}>
                                                <span style={{position: "absolute", left: "0.5em"}}>•</span>
                                                Suggested Buy Price:
                                            </TableCell>
                                            <TableCell sx={{color: theme.palette.text.primary, border: "none", padding: "4px 0", textAlign: "left", whiteSpace: {xs: "normal", sm: "nowrap"}, wordBreak: "break-word"}}>
                                                {currencySymbol || "£"}{data.aiBuyPriceLow.toLocaleString()} to {currencySymbol || "£"}{data.aiBuyPriceHigh.toLocaleString()} ({currencySymbol || "£"}{Math.round((data.aiBuyPriceHigh + data.aiBuyPriceLow) / 2).toLocaleString()})
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {data.aiRepairCost !== null && (
                                        <TableRow sx={{border: "none"}}>
                                            <TableCell sx={{color: theme.palette.text.primary, border: "none", padding: "4px 8px 4px 1.5em", whiteSpace: {xs: "normal", sm: "nowrap"}, fontWeight: "bold", position: "relative", width: {xs: "45%", sm: "auto"}}}>
                                                <span style={{position: "absolute", left: "0.5em"}}>•</span>
                                                Estimated Repair Cost:
                                            </TableCell>
                                            <TableCell sx={{color: theme.palette.text.primary, border: "none", padding: "4px 0", textAlign: "left", whiteSpace: {xs: "normal", sm: "nowrap"}, wordBreak: "break-word"}}>
                                                {currencySymbol || "£"}{data.aiRepairCost.toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {data.aiSellPriceLow !== null && data.aiSellPriceHigh !== null && (
                                        <TableRow sx={{border: "none"}}>
                                            <TableCell sx={{color: theme.palette.text.primary, border: "none", padding: "4px 8px 4px 1.5em", whiteSpace: {xs: "normal", sm: "nowrap"}, fontWeight: "bold", position: "relative", width: {xs: "45%", sm: "auto"}}}>
                                                <span style={{position: "absolute", left: "0.5em"}}>•</span>
                                                Suggested Sell Price:
                                            </TableCell>
                                            <TableCell sx={{color: theme.palette.text.primary, border: "none", padding: "4px 0", textAlign: "left", whiteSpace: {xs: "normal", sm: "nowrap"}, wordBreak: "break-word"}}>
                                                {currencySymbol || "£"}{data.aiSellPriceLow.toLocaleString()} to {currencySymbol || "£"}{data.aiSellPriceHigh.toLocaleString()} ({currencySymbol || "£"}{Math.round((data.aiSellPriceHigh + data.aiSellPriceLow) / 2).toLocaleString()})
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {data.aiBuyPriceLow !== null && data.aiBuyPriceHigh !== null && (
                                        <TableRow sx={{border: "none"}}>
                                            <TableCell sx={{color: theme.palette.text.primary, border: "none", padding: "4px 8px 4px 1.5em", whiteSpace: {xs: "normal", sm: "nowrap"}, fontWeight: "bold", position: "relative", width: {xs: "45%", sm: "auto"}}}>
                                                <span style={{position: "absolute", left: "0.5em"}}>•</span>
                                                Buy Markup/down:
                                            </TableCell>
                                            <TableCell sx={{
                                                color: (() => {
                                                    const buyMidpoint = (data.aiBuyPriceLow! + data.aiBuyPriceHigh!) / 2;
                                                    const buyMarkup = buyMidpoint - (askingPrice ?? 0);
                                                    return buyMarkup < 0 ? theme.palette.error.main : theme.palette.text.primary;
                                                })(),
                                                border: "none",
                                                padding: "4px 0",
                                                textAlign: "left",
                                                whiteSpace: {xs: "normal", sm: "nowrap"},
                                                wordBreak: "break-word",
                                            }}>
                                                {(() => {
                                                    const buyMidpoint = (data.aiBuyPriceLow! + data.aiBuyPriceHigh!) / 2;
                                                    const ap = askingPrice ?? 0;
                                                    const buyMarkup = buyMidpoint - ap;
                                                    const buyMarkupPercentage = ap ? (buyMarkup / ap) * 100 : 0;
                                                    const sign = buyMarkup >= 0 ? "+" : "-";
                                                    return `${sign}${currencySymbol || "£"}${Math.abs(Math.round(buyMarkup)).toLocaleString()} (${sign}${buyMarkupPercentage.toFixed(1)}%)`;
                                                })()}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {data.aiSellPriceLow !== null && data.aiSellPriceHigh !== null && data.aiRepairCost !== null && (
                                        <TableRow sx={{border: "none"}}>
                                            <TableCell sx={{color: theme.palette.text.primary, border: "none", padding: "4px 8px 4px 1.5em", whiteSpace: {xs: "normal", sm: "nowrap"}, fontWeight: "bold", position: "relative", width: {xs: "45%", sm: "auto"}}}>
                                                <span style={{position: "absolute", left: "0.5em"}}>•</span>
                                                Sell Markup/down:
                                            </TableCell>
                                            <TableCell sx={{
                                                color: (() => {
                                                    const sellMidpoint = (data.aiSellPriceLow! + data.aiSellPriceHigh!) / 2;
                                                    const sellMarkup = sellMidpoint - data.aiRepairCost! - (askingPrice ?? 0);
                                                    return sellMarkup < 0 ? theme.palette.error.main : theme.palette.text.primary;
                                                })(),
                                                border: "none",
                                                padding: "4px 0",
                                                textAlign: "left",
                                                whiteSpace: {xs: "normal", sm: "nowrap"},
                                                wordBreak: "break-word",
                                            }}>
                                                {(() => {
                                                    const sellMidpoint = (data.aiSellPriceLow! + data.aiSellPriceHigh!) / 2;
                                                    const ap = askingPrice ?? 0;
                                                    const sellMarkup = sellMidpoint - data.aiRepairCost! - ap;
                                                    const sellMarkupPercentage = ap ? (sellMarkup / ap) * 100 : 0;
                                                    const sign = sellMarkup >= 0 ? "+" : "-";
                                                    return `${sign}${currencySymbol || "£"}${Math.abs(Math.round(sellMarkup)).toLocaleString()} (${sign}${sellMarkupPercentage.toFixed(1)}%)`;
                                                })()}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Box>
                    )}
                </Box>
            </Collapse>
        </Box>
    );
}
