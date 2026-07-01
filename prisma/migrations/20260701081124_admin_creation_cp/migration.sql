/*
  Warnings:

  - Added the required column `adminId` to the `ControlPanelLogin` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ControlPanelLogin" ADD COLUMN     "adminId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "ControlPanelLogin" ADD CONSTRAINT "ControlPanelLogin_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminLogin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
