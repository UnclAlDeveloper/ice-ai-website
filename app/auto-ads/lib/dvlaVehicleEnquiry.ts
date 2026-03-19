// DVLA VEHICLE RESPONSE
export interface DvlaVehicleResponse {
    /**
     * Typed representation of the JSON body returned by the DVLA Vehicle
     * Enquiry Service API v1. Every field except registrationNumber is
     * optional because the DVLA omits fields when data is unavailable.
     */

    registrationNumber: string;
    taxStatus?: string;
    taxDueDate?: string;
    artEndDate?: string;
    motStatus?: string;
    motExpiryDate?: string;
    make?: string;
    monthOfFirstDvlaRegistration?: string;
    monthOfFirstRegistration?: string;
    yearOfManufacture?: number;
    engineCapacity?: number;
    co2Emissions?: number;
    fuelType?: string;
    markedForExport?: boolean;
    colour?: string;
    typeApproval?: string;
    wheelplan?: string;
    revenueWeight?: number;
    realDrivingEmissions?: string;
    dateOfLastV5CIssued?: string;
    euroStatus?: string;
    automatedVehicle?: boolean;
}

const DVLA_API_URL = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

// LOOKUP VEHICLE
export async function lookupVehicle(registrationNumber: string): Promise<DvlaVehicleResponse> {
    /**
     * Calls the DVLA Vehicle Enquiry Service API with the given registration
     * number and returns the parsed response. Throws descriptive errors for
     * missing API key, invalid registrations, vehicles not found, rate
     * limiting, and server-side failures.
     */

    const apiKey = process.env.DVLA_API_KEY;
    if (!apiKey) {
        throw new Error("DVLA_API_KEY environment variable is not set");
    }

    // strip spaces and uppercase to normalise the input
    const normalised = registrationNumber.replace(/\s+/g, "").toUpperCase();
    if (!normalised || normalised.length < 2 || normalised.length > 7) {
        throw new Error("Invalid registration number");
    }

    console.log(`[DVLA] Looking up registration: ${normalised}`);
    const startTime = Date.now();

    const response = await fetch(DVLA_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
        },
        body: JSON.stringify({registrationNumber: normalised}),
    });

    const duration = Date.now() - startTime;
    console.log(`[DVLA] Response ${response.status} in ${duration}ms`);

    if (response.status === 200) {
        return (await response.json()) as DvlaVehicleResponse;
    }

    if (response.status === 404) {
        throw new Error("Vehicle not found for that registration");
    }

    if (response.status === 400) {
        const body = await response.text();
        console.error(`[DVLA] Bad request: ${body}`);
        throw new Error("Invalid registration number format");
    }

    if (response.status === 429) {
        throw new Error("DVLA rate limit exceeded — please try again shortly");
    }

    if (response.status === 403) {
        throw new Error("DVLA API key is invalid or has been revoked");
    }

    // 500, 503, or anything else
    const body = await response.text();
    console.error(`[DVLA] Unexpected ${response.status}: ${body}`);
    throw new Error(`DVLA service error (HTTP ${response.status})`);
}
