import {defineConfig} from "drizzle-kit";

export default defineConfig({
    schema: "./drizzle/anna-trainer/schema.ts",
    out: "./drizzle/anna-trainer/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.ANNA_TRAINER_DATABASE_URL!,
    },
    schemaFilter: ["at"],
});
