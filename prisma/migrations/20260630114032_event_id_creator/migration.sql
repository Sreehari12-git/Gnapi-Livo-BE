/*
  Warnings:

  - Added the required column `createdBy` to the `EventInfo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EventInfo" ADD COLUMN     "createdBy" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "EventInfo" ADD CONSTRAINT "EventInfo_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
