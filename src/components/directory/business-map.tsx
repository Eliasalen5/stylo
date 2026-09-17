/**
 * Mapa de ubicación del negocio en su página pública.
 * Usa el iframe de OpenStreetMap (sin API key). Solo se renderiza cuando el
 * negocio tiene coordenadas (geocoding automático o manual).
 */
export function BusinessMap({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const delta = 0.004;
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <iframe
        title="Ubicación del negocio"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
          bbox
        )}&layer=mapnik&marker=${latitude},${longitude}`}
        className="h-64 w-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}