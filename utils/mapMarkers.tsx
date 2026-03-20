// utils/mapMarkers.tsx
// Markers simples que funcionan garantizados en react-native-maps
// Usa View + Text en lugar de SVG para máxima compatibilidad

import React from "react";
import { Text, View } from "react-native";

// ── Marker del profesional — tijeras de barbería ──────────────────────────
export function ScissorsMarker({
  size = 50,
  color = "#2196F3",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#0D1B2E",
        borderWidth: 3,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.6,
        shadowRadius: 4,
      }}
    >
      <Text style={{ fontSize: size * 0.45, lineHeight: size * 0.55 }}>✂️</Text>
    </View>
  );
}

// ── Marker de destino — pin dorado con ícono de casa/ubicación ────────────
export function DestinationMarker({
  size = 50,
  color = "#D4AF37",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <View style={{ alignItems: "center" }}>
      {/* Cabeza del pin */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.5,
          shadowRadius: 4,
        }}
      >
        <Text style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }}>🏠</Text>
      </View>
      {/* Punta del pin */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size * 0.2,
          borderRightWidth: size * 0.2,
          borderTopWidth: size * 0.28,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: color,
          marginTop: -3,
        }}
      />
      {/* Sombra */}
      <View
        style={{
          width: size * 0.5,
          height: 5,
          backgroundColor: "#00000040",
          borderRadius: 10,
          marginTop: 2,
        }}
      />
    </View>
  );
}

// Alias
export const ClipperMarker = ScissorsMarker;
