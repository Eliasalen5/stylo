-- AlterTable: Renombrar priceCents → price en Service, Appointment y Plan
ALTER TABLE "Service" RENAME COLUMN "priceCents" TO "price";
ALTER TABLE "Appointment" RENAME COLUMN "priceCents" TO "price";
ALTER TABLE "Plan" RENAME COLUMN "priceCents" TO "price";
