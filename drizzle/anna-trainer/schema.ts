import {
    pgTable,
    pgSchema,
    serial,
    varchar,
    integer,
    timestamp,
    index,
} from "drizzle-orm/pg-core";
import {relations} from "drizzle-orm";

export const atSchema = pgSchema("at");

// LANGUAGE

export const languages = atSchema.table(
    "languages",
    {
        code: varchar("code").primaryKey(),
        language: varchar("language").notNull(),
    },
);

// LOOKUP

export const lookups = atSchema.table(
    "lookups",
    {
        id: serial("id").primaryKey(),
        lookupType: varchar("lookup_type").notNull(),
        code: varchar("code").notNull(),
        value: varchar("value"),
        description: varchar("description"),
    },
    (table) => [
        index("idx_lookups_code").on(table.code),
        index("idx_lookups_lookup_type").on(table.lookupType),
    ],
);

// PREFERRED LANGUAGE

export const preferredLanguages = atSchema.table(
    "preferred_languages",
    {
        id: serial("id").primaryKey(),
        languageCode: varchar("language_code").notNull(),
        owner: varchar("owner").notNull(),
        createdAt: timestamp("createdat", {withTimezone: true, mode: "date"}),
        updatedAt: timestamp("updatedat", {withTimezone: true, mode: "date"}),
    },
    (table) => [
        index("idx_preferred_languages_language_code").on(table.languageCode),
        index("idx_preferred_languages_owner").on(table.owner),
    ],
);

// VIDEO STAGE

export const videoStages = atSchema.table("video_stages", {
    code: varchar("code").primaryKey(),
    name: varchar("name").notNull(),
    description: varchar("description"),
});

// VIDEO

export const videos = atSchema.table(
    "videos",
    {
        id: serial("id").primaryKey(),
        name: varchar("name").notNull(),
        languageCode: varchar("language_code").notNull(),
        stageCode: varchar("stage_code").notNull(),
        videoUrl: varchar("video_url"),
        transcript: varchar("transcript"),
        description: varchar("description"),
        rawVideoId: integer("raw_video_id"),
        owner: varchar("owner").notNull(),
        createdAt: timestamp("createdat", {withTimezone: true, mode: "date"}),
        updatedAt: timestamp("updatedat", {withTimezone: true, mode: "date"}),
    },
    (table) => [
        index("idx_videos_language_code").on(table.languageCode),
        index("idx_videos_owner").on(table.owner),
        index("idx_videos_stage_code").on(table.stageCode),
    ],
);

// RELATIONS

export const languagesRelations = relations(languages, ({many}) => ({
    preferredLanguages: many(preferredLanguages),
    videos: many(videos),
}));

export const preferredLanguagesRelations = relations(preferredLanguages, ({one}) => ({
    language: one(languages, {
        fields: [preferredLanguages.languageCode],
        references: [languages.code],
    }),
}));

export const videoStagesRelations = relations(videoStages, ({many}) => ({
    videos: many(videos),
}));

export const videosRelations = relations(videos, ({one}) => ({
    language: one(languages, {
        fields: [videos.languageCode],
        references: [languages.code],
    }),
    stage: one(videoStages, {
        fields: [videos.stageCode],
        references: [videoStages.code],
    }),
}));
