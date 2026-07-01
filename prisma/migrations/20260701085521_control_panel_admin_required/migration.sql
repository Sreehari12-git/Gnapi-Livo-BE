/*
  Warnings:

  - Made the column `adminId` on table `ControlPanelLogin` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ControlPanelLogin" ALTER COLUMN "adminId" SET NOT NULL;
