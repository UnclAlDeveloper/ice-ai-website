import {defineConfig} from "drizzle-kit";

export default defineConfig({
    schema: "./drizzle/auto-ads/schema.ts",
    out: "./drizzle/auto-ads/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.AUTO_ADS_DATABASE_URL!,
    },
    schemaFilter: ["aa"],
});
