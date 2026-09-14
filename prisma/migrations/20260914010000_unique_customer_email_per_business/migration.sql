-- Un email no puede repetirse como cliente dentro del mismo negocio.
-- PostgreSQL permite múltiples NULLs (clientes sin email).
CREATE UNIQUE INDEX "Customer_businessId_email_key" ON "Customer"("businessId", "email");