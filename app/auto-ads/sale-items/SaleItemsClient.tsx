"use client";

import React, {useState, useCallback} from "react";
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {green, red} from "@mui/material/colors";
import {getSaleItem, getSaleItems} from "./actions";
import type {saleItem} from "./actions";
import {deleteSaleItem} from "../components/actions";
import SaleItemEditor from "../components/SaleItemEditor";

// NEW SALE ITEM DEFAULTS
const NEW_SALE_ITEM_DEFAULTS: saleItem = {
    id: 0,
    createdAt: null,
    updatedAt: null,
    status: "Inventory",
    title: "",
    description: null,
    askingPrice: null,
    currencySymbol: "£",
    location: null,
    ebayCategoryId: null,
    ebayItemId: null,
    eBayUrl: null,
    facebookUrl: null,
};
/**
 * Default field values applied when starting a brand-new sale item. id is
 * set to 0 as a sentinel; the editor treats any falsy id as "unsaved" and
 * persists the row on first save. Once persisted the real serial id
 * replaces the sentinel.
 */

// SALE ITEMS CLIENT PROPS
interface SaleItemsClientProps {
    pageTitle: string;
    existingItems: {id: number; title: string; description: string | null}[];
    ebayCategories: {code: string; value: string | null; description: string | null}[];
}
/**
 * Props received from the server component: the user-visible page title
 * (forwarded through to a header line in the future when the client needs
 * to render its own headings), the inventory items the user can resume
 * editing, and the eBay category options for the editor's category
 * dropdown.
 */

// SALE ITEMS CLIENT
export default function SaleItemsClient({pageTitle: _pageTitle, existingItems, ebayCategories}: SaleItemsClientProps) {
    /**
     * Client shell for the Sale Items page. Lets the user pick an item
     * from the inventory dropdown, start a new item, or delete the
     * currently selected item. Once an item is selected or created it
     * renders the SaleItemEditor with the item's data. Mirrors the
     * select-or-create pattern used by the manual entry page but without
     * a photo-capture flow because sale items are not numberplate-bearing
     * vehicles.
     */

    const [items, setItems] = useState(existingItems);
    const [selectedId, setSelectedId] = useState<number | "">("");
    const [editorData, setEditorData] = useState<saleItem | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // HANDLE SELECT ITEM
    const handleSelectItem = useCallback(async (id: number) => {
        /**
         * Loads the selected sale item's full data into the editor form.
         */

        setSelectedId(id);
        const result = await getSaleItem(id);
        if (result.success && result.item) {
            setEditorData(result.item);
        } else {
            console.error("Failed to load sale item:", result.error);
        }
    }, []);

    // HANDLE NEW ITEM
    const handleNewItem = useCallback(() => {
        /**
         * Drops the user into the editor with a blank sale item. The row
         * is not persisted until the user saves; doing so populates the
         * id and unlocks image uploads + external listing actions.
         */

        setSelectedId("");
        setEditorData({...NEW_SALE_ITEM_DEFAULTS, id: 0});
    }, []);

    // HANDLE SAVED
    const handleSaved = useCallback(async (data: saleItem) => {
        /**
         * Called by the editor after a successful save. Refreshes the
         * dropdown so any new title or status change is reflected.
         */

        const refreshed = await getSaleItems();
        if (refreshed.success && refreshed.items) {
            setItems(refreshed.items);
        }

        if (data.id) {
            setSelectedId(data.id);
            setEditorData(data);
        }
    }, []);

    // HANDLE DELETE ITEM
    const handleDeleteItem = useCallback(async () => {
        /**
         * Deletes the currently selected sale item and all of its images,
         * then removes it from the local dropdown and resets the editor.
         */

        if (typeof selectedId !== "number") return;
        setDeleting(true);
        try {
            const result = await deleteSaleItem(selectedId);
            if (result.success) {
                setItems((prev) => prev.filter((i) => i.id !== selectedId));
                setSelectedId("");
                setEditorData(null);
            } else {
                console.error("Failed to delete sale item:", result.error);
            }
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
        }
    }, [selectedId]);

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    gap: 1,
                    mb: 3,
                }}
            >
                <FormControl size="small" sx={{minWidth: 280, flexGrow: {xs: 1, sm: 0}}}>
                    <InputLabel id="sale-item-selector-label">Select Item</InputLabel>
                    <Select
                        labelId="sale-item-selector-label"
                        value={selectedId}
                        label="Select Item"
                        onChange={(e) => {
                            const val = e.target.value;
                            if (typeof val === "number") {
                                handleSelectItem(val);
                            }
                        }}
                    >
                        {items.map((item) => (
                            <MenuItem key={item.id} value={item.id}>
                                {item.title}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {selectedId !== "" && (
                    <Tooltip title="Delete item">
                        <IconButton
                            onClick={() => setDeleteDialogOpen(true)}
                            sx={{
                                border: 2,
                                borderColor: red[900],
                                color: red[900],
                                "&:hover": {bgcolor: red[50]},
                            }}
                        >
                            <RemoveIcon />
                        </IconButton>
                    </Tooltip>
                )}

                <Tooltip title="New item">
                    <IconButton
                        onClick={handleNewItem}
                        sx={{
                            border: 2,
                            borderColor: green[900],
                            color: green[900],
                            "&:hover": {bgcolor: green[50]},
                        }}
                    >
                        <AddIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {editorData && (
                <SaleItemEditor
                    data={editorData}
                    ebayCategories={ebayCategories}
                    onSaved={handleSaved}
                />
            )}

            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete Item</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will permanently delete the item and all of its images.
                        This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button onClick={handleDeleteItem} color="error" disabled={deleting}>
                        {deleting ? "Deleting…" : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
