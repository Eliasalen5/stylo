-- CreateEnum
CREATE TYPE "SubscriptionInterval" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN "interval" "SubscriptionInterval" NOT NULL DEFAULT 'MONTH';
ALTER TABLE "Plan" ADD COLUMN "intervalCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Plan" ADD COLUMN "mercadoPagoPlanId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "mpStatus" TEXT;

-- CreateIndex
CREATE INDEX "Subscription_mercadoPagoSubscriptionId_idx" ON "Subscription"("mercadoPagoSubscriptionId");

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "mpEventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEvent_mpEventId_key" ON "SubscriptionEvent"("mpEventId");
CREATE INDEX "SubscriptionEvent_subscriptionId_idx" ON "SubscriptionEvent"("subscriptionId");
CREATE INDEX "SubscriptionEvent_eventType_idx" ON "SubscriptionEvent"("eventType");

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;