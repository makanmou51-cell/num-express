-- CreateTable
CREATE TABLE "AccountOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "categoryName" TEXT,
    "quantity" INTEGER NOT NULL,
    "priceXof" INTEGER NOT NULL,
    "costVnd" INTEGER,
    "providerOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "accounts" TEXT,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountOrder_providerOrderId_key" ON "AccountOrder"("providerOrderId");

-- CreateIndex
CREATE INDEX "AccountOrder_userId_idx" ON "AccountOrder"("userId");

-- CreateIndex
CREATE INDEX "AccountOrder_status_idx" ON "AccountOrder"("status");

-- AddForeignKey
ALTER TABLE "AccountOrder" ADD CONSTRAINT "AccountOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
