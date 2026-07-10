-- Convert single-identity columns to arrays on Match table

ALTER TABLE "Match"
  ADD COLUMN "liveCapturerIdentities"    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "liveCommentatorIdentities" TEXT[] NOT NULL DEFAULT '{}';

-- Migrate existing single values into the new arrays (skip NULLs)
UPDATE "Match"
SET "liveCapturerIdentities" = ARRAY["liveCapturerIdentity"]
WHERE "liveCapturerIdentity" IS NOT NULL;

UPDATE "Match"
SET "liveCommentatorIdentities" = ARRAY["liveCommentatorIdentity"]
WHERE "liveCommentatorIdentity" IS NOT NULL;

-- Drop old columns
ALTER TABLE "Match"
  DROP COLUMN "liveCapturerIdentity",
  DROP COLUMN "liveCommentatorIdentity";
