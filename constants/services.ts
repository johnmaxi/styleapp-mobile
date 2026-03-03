// constants/services.ts
export type ProfessionalType = "estilista" | "profesional" | "quiropodologo";

export type SubOption = { id: string; label: string; minPrice: number };

export type ServiceItem = {
  id: string;
  label: string;
  minPrice: number;
  hideParentPrice?: boolean; // si true, no mostrar precio del padre, solo subopciones
  subOptions?: SubOption[];
};

export const SERVICE_CATALOG: Record<ProfessionalType, ServiceItem[]> = {
  estilista: [
    { id: "peinado_dama", label: "Corte de cabello / Peinado Dama", minPrice: 30000 },
    { id: "peinado_ninas", label: "Corte de cabello / Peinado Niñas", minPrice: 20000 },
    { id: "alizado", label: "Alizado", minPrice: 90000 },
    {
      id: "manicure",
      label: "Manicure",
      minPrice: 50000,
      hideParentPrice: true, // no mostrar precio del padre
      subOptions: [
        { id: "esmaltado_tradicional", label: "Esmaltado Tradicional", minPrice: 50000 },
        { id: "esmaltado_gel", label: "Esmaltado Semipermanente (Gel)", minPrice: 60000 },
        { id: "acrilico", label: "Uñas de Acrílico", minPrice: 70000 },
        { id: "press_on", label: "Press on", minPrice: 80000 },
        { id: "francesas", label: "Francesas", minPrice: 85000 },
        { id: "otras", label: "Otras", minPrice: 50000 },
      ],
    },
    { id: "pedicure_estilista", label: "Pedicure", minPrice: 40000 },
    { id: "keratinas", label: "Keratinas", minPrice: 100000 },
    { id: "maquillaje", label: "Maquillaje", minPrice: 50000 },
  ],
  profesional: [
    { id: "corte", label: "Corte", minPrice: 18000 },
    { id: "barba", label: "Barba", minPrice: 15000 },
    { id: "corte_premium", label: "Corte Premium (Incluye Mascarilla)", minPrice: 40000 },
  ],
  quiropodologo: [
    { id: "pedicure_quiro", label: "Pedicure", minPrice: 60000 },
    { id: "onicocriptosis", label: "Tratamiento de uñas encarnadas (onicocriptosis)", minPrice: 45000 },
  ],
};

export const PROFESSIONAL_TYPE_LABELS: Record<ProfessionalType, string> = {
  estilista: "Estilista",
  profesional: "Barbero",
  quiropodologo: "Quiropodólogo",
};

export function roleToProType(role: string): ProfessionalType | null {
  if (role === "barber") return "profesional";
  if (role === "estilista") return "estilista";
  if (role === "quiropodologo") return "quiropodologo";
  return null;
}

export function formatPrice(price: number): string {
  return `$${price.toLocaleString("es-CO")}`;
}
