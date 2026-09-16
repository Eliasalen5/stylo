-- Defensa en profundidad contra doble reserva: reemplaza el índice único global
-- (professionalId, startsAt) por un índice único PARCIAL que solo cubre turnos
-- PENDING/CONFIRMED. Así un turno CANCELLED ya no bloquea la re-reserva de la
-- misma franja horaria, manteniendo la garantía anti doble reserva sobre los
-- estados activos. La serialización concurrente la aporta runBookingTransaction
-- (SELECT ... FOR UPDATE + hasConflict).
DROP INDEX "Appointment_professionalId_startsAt_key";
CREATE UNIQUE INDEX "Appointment_professionalId_startsAt_active_key"
  ON "Appointment"("professionalId", "startsAt")
  WHERE "status" IN ('PENDING', 'CONFIRMED');