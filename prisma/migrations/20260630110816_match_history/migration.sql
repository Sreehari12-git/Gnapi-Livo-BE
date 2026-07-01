-- CreateTable
CREATE TABLE "MatchHistory" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamAName" TEXT NOT NULL,
    "teamBName" TEXT NOT NULL,
    "teamAScore" INTEGER NOT NULL,
    "teamBScore" INTEGER NOT NULL,

    CONSTRAINT "MatchHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MatchHistory" ADD CONSTRAINT "MatchHistory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventInfo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
