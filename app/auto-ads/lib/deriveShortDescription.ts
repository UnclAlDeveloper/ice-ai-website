
// DERIVE SHORT DESCRIPTION
export function deriveShortDescription(data: {
    year?: number | null;
    makeAndModel?: string | null;
    colour?: string | null;
    engineSize?: string | null;
    fuelType?: string | null;
}): string {
    /**
     * Builds a concise short description from the vehicle fields populated by
     * a DVLA lookup. Produces strings such as "2018 Ford Focus White 2.0L Diesel".
     * Only includes a field if it is non-empty. Engine size is converted from
     * the DVLA "1996cc" format to the more readable "2.0L" form. Colour and
     * fuel type are title-cased since the DVLA returns them in uppercase.
     */

    const parts: string[] = [];

    if (data.year) {
        parts.push(String(data.year));
    }

    if (data.colour) {
        const c = data.colour.trim();
        parts.push(c.charAt(0).toUpperCase() + c.slice(1).toLowerCase());
    }

    if (data.makeAndModel) {
        parts.push(data.makeAndModel.trim());
    }

    if (data.engineSize) {
        const s = data.engineSize.trim();
        if (s.toLowerCase().endsWith("cc")) {
            const cc = parseInt(s, 10);
            if (!isNaN(cc)) {
                parts.push(`${(cc / 1000).toFixed(1)}L`);
            } else {
                parts.push(s);
            }
        } else {
            parts.push(s);
        }
    }

    if (data.fuelType) {
        const f = data.fuelType.trim();
        parts.push(f.charAt(0).toUpperCase() + f.slice(1).toLowerCase());
    }

    return parts.join(" ");
}
