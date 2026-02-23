import {defineConfig} from "drizzle-kit";

export default defineConfig({
    schema: "./drizzle/ice-ai/schema.ts",
    out: "./drizzle/ice-ai/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.ICE_AI_DATABASE_URL!,
    },
    schemaFilter: ["ia"],
});
