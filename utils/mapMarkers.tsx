// utils/mapMarkers.tsx
// Markers personalizados para react-native-maps

import React from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";

// ── Marker de tijeras (profesional en movimiento) ─────────────────────────
export function ScissorsMarker({ size = 44, color = "#D4AF37" }: { size?: number; color?: string }) {
  return (
    <View style={{
      width: size, height: size,
      backgroundColor: "#0D2137",
      borderRadius: size / 2,
      borderWidth: 2.5,
      borderColor: color,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
      elevation: 6,
    }}>
      <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        {/* Hoja superior de tijeras */}
        <Path
          d="M6 9C6 7.34 7.34 6 9 6C10.66 6 12 7.34 12 9C12 10.66 10.66 12 9 12C7.34 12 6 10.66 6 9Z"
          fill={color}
        />
        {/* Hoja inferior */}
        <Path
          d="M6 15C6 13.34 7.34 12 9 12C10.66 12 12 13.34 12 15C12 16.66 10.66 18 9 18C7.34 18 6 16.66 6 15Z"
          fill={color}
        />
        {/* Brazo superior */}
        <Line x1="11" y1="9.5" x2="20" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Brazo inferior */}
        <Line x1="11" y1="14.5" x2="20" y2="19" stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Punto de pivote */}
        <Circle cx="12" cy="12" r="1.5" fill={color} />
      </Svg>
    </View>
  );
}

// ── Marker de máquina de cortar (variante) ────────────────────────────────
export function ClipperMarker({ size = 44, color = "#D4AF37" }: { size?: number; color?: string }) {
  return (
    <View style={{
      width: size, height: size,
      backgroundColor: "#0D2137",
      borderRadius: size / 2,
      borderWidth: 2.5,
      borderColor: color,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
      elevation: 6,
    }}>
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        {/* Cuerpo de la máquina */}
        <Rect x="3" y="8" width="14" height="8" rx="3" fill={color} />
        {/* Cuchilla superior */}
        <Rect x="3" y="6" width="14" height="2.5" rx="1" fill={color} opacity="0.7" />
        {/* Dientes de la cuchilla */}
        <Rect x="4"  y="5" width="1.5" height="2" rx="0.5" fill={color} />
        <Rect x="7"  y="5" width="1.5" height="2" rx="0.5" fill={color} />
        <Rect x="10" y="5" width="1.5" height="2" rx="0.5" fill={color} />
        <Rect x="13" y="5" width="1.5" height="2" rx="0.5" fill={color} />
        {/* Cable */}
        <Path d="M17 12 Q20 12 20 15 Q20 18 18 18" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Botón on/off */}
        <Circle cx="7" cy="12" r="1.5" fill="#0D2137" />
        <Circle cx="11" cy="12" r="1.5" fill="#0D2137" />
      </Svg>
    </View>
  );
}

// ── Marker de destino dorado (pin clásico con ✂) ──────────────────────────
export function DestinationMarker({ size = 44, color = "#D4AF37" }: { size?: number; color?: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{
        width: size, height: size,
        backgroundColor: color,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
        elevation: 5,
      }}>
        <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="#0D2137"
          />
          <Circle cx="12" cy="9" r="2.5" fill={color} />
        </Svg>
      </View>
      {/* Sombra del pin */}
      <Ellipse cx={size / 2} cy={4} rx={size / 4} ry={3} fill="#00000033" />
    </View>
  );
}
