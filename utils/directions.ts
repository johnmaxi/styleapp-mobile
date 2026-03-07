// utils/directions.ts
// Obtiene la ruta por calles reales entre dos puntos usando Google Directions API
// Si falla, devuelve una línea recta como fallback

const GOOGLE_MAPS_API_KEY = "AIzaSyDjGBwlnaJ92B_HqKwHNSV0DdUdGZo51wE";

export type LatLng = { latitude: number; longitude: number };

// Decodificar el polyline encodificado que devuelve Google
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

// Obtener ruta completa por calles reales
// Devuelve array de puntos para dibujar en Polyline
export async function getRouteCoords(
  origin: LatLng,
  destination: LatLng
): Promise<LatLng[]> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${origin.latitude},${origin.longitude}` +
      `&destination=${destination.latitude},${destination.longitude}` +
      `&mode=driving` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const res  = await fetch(url);
    const json = await res.json();

    if (json.status === "OK" && json.routes?.length > 0) {
      const encodedPolyline = json.routes[0].overview_polyline.points;
      return decodePolyline(encodedPolyline);
    }

    console.log("Directions API status:", json.status, json.error_message || "");
    // Fallback: línea recta
    return [origin, destination];
  } catch (e) {
    console.log("Directions API error:", e);
    // Fallback: línea recta
    return [origin, destination];
  }
}
