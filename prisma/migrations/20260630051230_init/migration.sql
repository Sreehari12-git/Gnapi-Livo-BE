-- CreateTable
CREATE TABLE "broadcasterLogin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "broadcasterLogin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "broadcasterLogin_email_key" ON "broadcasterLogin"("email");
