-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "category" TEXT NOT NULL,
    "ref" TEXT,
    "recipient" TEXT NOT NULL,
    "recipients" INTEGER NOT NULL DEFAULT 1,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorClass" TEXT,
    "attempts" JSONB NOT NULL,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_delivery_events" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_deliveries_ref_idx" ON "email_deliveries"("ref");

-- CreateIndex
CREATE INDEX "email_deliveries_createdAt_id_idx" ON "email_deliveries"("createdAt", "id");

-- CreateIndex
CREATE INDEX "email_deliveries_status_idx" ON "email_deliveries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "email_deliveries_provider_providerMessageId_key" ON "email_deliveries"("provider", "providerMessageId");

-- CreateIndex
CREATE INDEX "email_delivery_events_deliveryId_at_idx" ON "email_delivery_events"("deliveryId", "at");

-- AddForeignKey
ALTER TABLE "email_delivery_events" ADD CONSTRAINT "email_delivery_events_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "email_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

