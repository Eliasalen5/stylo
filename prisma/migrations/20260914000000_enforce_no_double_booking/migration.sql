-- Defensa en profundidad contra doble reserva: un profesional no puede tener
-- dos turnos que empiecen exactamente en el mismo instante.
-- El índice único reemplaza al índice no único sobre (professionalId, startsAt).
DROP INDEX IF EXISTS "Appointment_professionalId_startsAt_idx";
CREATE UNIQUE INDEX "Appointment_professionalId_startsAt_key" ON "Appointment"("professionalId", "startsAt");