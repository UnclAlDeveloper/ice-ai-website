"use client";

import React from "react";
import {InputAdornment, TextField} from "@mui/material";
import type {TextFieldProps} from "@mui/material";

// CURRENCY TEXT FIELD PROPS

interface CurrencyTextFieldProps extends Omit<TextFieldProps, "value" | "onChange" | "type"> {
    value: number | null | undefined;
    onChange: (value: number | null) => void;
    currencySymbol?: string | null;
}
/**
 * Props for the currency input. The numeric value is held as a plain integer
 * (no decimals are stored anywhere in the auto-ads database). The optional
 * currency symbol is rendered as a start adornment so the user can see which
 * currency the figure is in. Any other TextField props are forwarded straight
 * through, so callers keep full control over size, label, fullWidth, sx etc.
 */

// FORMAT WITH COMMAS
function formatWithCommas(value: number | null | undefined): string {

    // empty string keeps the field blank when the underlying value is unset
    if (value == null || Number.isNaN(value)) return "";
    return value.toLocaleString("en-GB");
}

// PARSE FROM INPUT
function parseFromInput(raw: string): number | null {
    /**
     * Strip everything that is not a digit so the user can paste values like
     * "£1,234" or "1 234" and we still capture the intended integer. Returns
     * null when nothing numeric is left, which matches the database column
     * being nullable.
     */

    const digits = raw.replace(/\D+/g, "");
    if (!digits) return null;
    const n = parseInt(digits, 10);
    return Number.isNaN(n) ? null : n;
}

// CURRENCY TEXT FIELD

export default function CurrencyTextField({
    value,
    onChange,
    currencySymbol,
    slotProps,
    ...rest
}: CurrencyTextFieldProps) {
    /**
     * A drop-in TextField that accepts and displays integer currency values
     * formatted with thousands separators (e.g. 12,500). Internally it runs
     * as type="text" so the comma characters are visible, but uses
     * inputMode="numeric" so mobile keyboards still show the digit pad. Any
     * non-digit characters the user types are stripped before the parent's
     * onChange callback fires.
     */

    // build the input slot props, adding the currency adornment when supplied
    // and merging anything the caller already passed in
    const callerInputSlot =
        slotProps && typeof slotProps === "object" && "input" in slotProps
            ? (slotProps as {input?: Record<string, unknown>}).input ?? {}
            : {};
    const mergedInputSlot: Record<string, unknown> = {
        ...callerInputSlot,
        inputMode: "numeric",
    };
    if (currencySymbol) {
        mergedInputSlot.startAdornment = (
            <InputAdornment position="start">{currencySymbol}</InputAdornment>
        );
    }

    return (
        <TextField
            {...rest}
            type="text"
            value={formatWithCommas(value)}
            onChange={(e) => onChange(parseFromInput(e.target.value))}
            slotProps={{
                ...slotProps,
                input: mergedInputSlot,
            }}
        />
    );
}
