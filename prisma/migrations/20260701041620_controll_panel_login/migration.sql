/*
  Warnings:

  - You are about to drop the `Login` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EventInfo" DROP CONSTRAINT "EventInfo_createdBy_fkey";

-- DropTable
DROP TABLE "Login";

-- CreateTable
CREATE TABLE "AdminLogin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "AdminLogin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlPanelLogin" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "ControlPanelLogin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminLogin_email_key" ON "AdminLogin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ControlPanelLogin_email_key" ON "ControlPanelLogin"("email");

-- AddForeignKey
ALTER TABLE "EventInfo" ADD CONSTRAINT "EventInfo_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "AdminLogin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
