// app/admin-store.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Product = {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  image_url?: string;
  is_active: boolean;
};

type Order = {
  id: number;
  user_name?: string;
  user_phone?: string;
  status: string;
  total: number;
  payment_method: string;
  address: string;
  created_at: string;
  items?: any[];
};

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];
const STATUS_LABEL: Record<string, string> = {
  pending: "⏳ Pendiente",
  confirmed: "✅ Confirmado",
  shipped: "🚚 En camino",
  delivered: "📦 Entregado",
  cancelled: "❌ Cancelado",
};
const CATEGORIES = ["Cabello", "Uñas", "Equipos", "Maquillaje", "Pies", "Otro"];
const MAX_IMAGES = 3;
const MAX_B64 = 800 * 1024;

const emptyForm = {
  name: "",
  description: "",
  price: "",
  stock: "",
  category: "Cabello",
  is_active: true,
};

async function pickImage(onDone: (b64: string) => void) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      "Permiso requerido",
      "Activa el acceso a la galería en Configuración",
    );
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.4,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return;
  const b64 = result.assets[0].base64!;
  if (b64.length > MAX_B64) {
    Alert.alert(
      "Imagen muy grande",
      "Máximo 600KB por imagen. Reduce la resolución.",
    );
    return;
  }
  onDone(`data:image/jpeg;base64,${b64}`);
}

async function takePhoto(onDone: (b64: string) => void) {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permiso requerido", "Activa la cámara en Configuración");
    return;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.4,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return;
  const b64 = result.assets[0].base64!;
  if (b64.length > MAX_B64) {
    Alert.alert("Imagen muy grande", "Máximo 600KB por imagen.");
    return;
  }
  onDone(`data:image/jpeg;base64,${b64}`);
}

export default function AdminStore() {
  const { user } = useAuth();
  const router = useRouter();
  const palette = getPalette(user?.gender);

  const [tab, setTab] = useState<"products" | "orders">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === "products") {
        const res = await api.get("/store/admin/products");
        setProducts(res.data.data || []);
      } else {
        const res = await api.get("/store/admin/orders");
        setOrders(res.data.data || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setImages([]);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ ...p, price: String(p.price), stock: String(p.stock) });
    // Parsear imágenes existentes
    try {
      const parsed = JSON.parse(p.image_url || "[]");
      setImages(
        Array.isArray(parsed) ? parsed : p.image_url ? [p.image_url] : [],
      );
    } catch {
      setImages(p.image_url ? [p.image_url] : []);
    }
    setShowModal(true);
  };

  const addImage = (source: "gallery" | "camera") => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert(
        "Máximo de imágenes",
        `Solo puedes agregar ${MAX_IMAGES} imágenes por producto.`,
      );
      return;
    }
    const handler = (b64: string) => setImages((prev) => [...prev, b64]);
    if (source === "gallery") pickImage(handler);
    else takePhoto(handler);
  };

  const removeImage = (idx: number) =>
    setImages((prev) => prev.filter((_, i) => i !== idx));

  const handlePickImage = (idx?: number) => {
    if (idx !== undefined) {
      // Reemplazar imagen existente
      Alert.alert("Cambiar imagen", "¿Cómo quieres agregar la imagen?", [
        {
          text: "📷 Cámara",
          onPress: () =>
            takePhoto((b64) =>
              setImages((prev) =>
                prev.map((img, i) => (i === idx ? b64 : img)),
              ),
            ),
        },
        {
          text: "🖼️ Galería",
          onPress: () =>
            pickImage((b64) =>
              setImages((prev) =>
                prev.map((img, i) => (i === idx ? b64 : img)),
              ),
            ),
        },
        { text: "Cancelar", style: "cancel" },
      ]);
    } else {
      Alert.alert("Agregar imagen", "¿Cómo quieres agregar la imagen?", [
        { text: "📷 Cámara", onPress: () => addImage("camera") },
        { text: "🖼️ Galería", onPress: () => addImage("gallery") },
        { text: "Cancelar", style: "cancel" },
      ]);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      Alert.alert("Error", "Nombre y precio son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        category: form.category || null,
        image_url: images.length > 0 ? JSON.stringify(images) : null,
        is_active: form.is_active !== false,
      };
      if (editing) {
        await api.put(`/store/admin/products/${editing.id}`, payload);
        Alert.alert("✅ Actualizado", "Producto actualizado correctamente");
      } else {
        await api.post("/store/admin/products", payload);
        Alert.alert("✅ Creado", "Producto creado correctamente");
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (p: Product) => {
    Alert.alert(
      "Desactivar producto",
      `¿Desactivar "${p.name}"? Ya no aparecerá en la tienda.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desactivar",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/store/admin/products/${p.id}`);
              loadData();
            } catch {
              Alert.alert("Error", "No se pudo desactivar");
            }
          },
        },
      ],
    );
  };

  const handleOrderStatus = (order: Order, newStatus: string) => {
    Alert.alert(
      "Cambiar estado",
      `¿Cambiar pedido #${order.id} a "${STATUS_LABEL[newStatus]}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            try {
              await api.patch(`/store/admin/orders/${order.id}/status`, {
                status: newStatus,
              });
              loadData();
            } catch {
              Alert.alert("Error", "No se pudo actualizar");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      {/* Header */}
      <View
        style={{
          padding: 20,
          paddingTop: 50,
          borderBottomWidth: 1,
          borderBottomColor: "#222",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: palette.primary }}>← Volver</Text>
          </TouchableOpacity>
          <Text
            style={{ color: palette.primary, fontWeight: "900", fontSize: 18 }}
          >
            🛍️ Admin Tienda
          </Text>
          {tab === "products" ? (
            <TouchableOpacity
              onPress={openNew}
              style={{
                backgroundColor: palette.primary,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#000", fontWeight: "700" }}>+ Nuevo</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          {(["products", "orders"] as const).map((tabId) => (
            <TouchableOpacity
              key={tabId}
              onPress={() => setTab(tabId)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                alignItems: "center",
                backgroundColor: tab === tabId ? palette.primary : "#1a1a1a",
                borderWidth: 1,
                borderColor: tab === tabId ? palette.primary : "#333",
              }}
            >
              <Text
                style={{
                  color: tab === tabId ? "#000" : "#888",
                  fontWeight: "700",
                }}
              >
                {tabId === "products" ? "📦 Productos" : "🛒 Pedidos"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        >
          {/* ── PRODUCTOS ── */}
          {tab === "products" &&
            products.map((p) => {
              let imgs: string[] = [];
              try {
                const parsed = JSON.parse(p.image_url || "[]");
                imgs = Array.isArray(parsed)
                  ? parsed
                  : p.image_url
                    ? [p.image_url]
                    : [];
              } catch {
                imgs = p.image_url ? [p.image_url] : [];
              }

              return (
                <View
                  key={p.id}
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderRadius: 10,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: p.is_active ? palette.primary + "44" : "#333",
                    opacity: p.is_active ? 1 : 0.5,
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {/* Imagen miniatura */}
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        overflow: "hidden",
                        backgroundColor: "#0d1520",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {imgs[0] ? (
                        <Image
                          source={{ uri: imgs[0] }}
                          style={{ width: 64, height: 64 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={{ fontSize: 28 }}>🛍️</Text>
                      )}
                      {imgs.length > 1 && (
                        <View
                          style={{
                            position: "absolute",
                            bottom: 0,
                            right: 0,
                            backgroundColor: "#000000bb",
                            paddingHorizontal: 4,
                            paddingVertical: 1,
                          }}
                        >
                          <Text style={{ color: "#fff", fontSize: 8 }}>
                            +{imgs.length - 1}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: palette.text,
                          fontWeight: "700",
                          fontSize: 15,
                        }}
                      >
                        {p.name}
                      </Text>
                      <Text
                        style={{ color: "#555", fontSize: 11, marginTop: 1 }}
                      >
                        {p.category}
                      </Text>
                      <Text
                        style={{
                          color: palette.primary,
                          fontWeight: "900",
                          marginTop: 4,
                        }}
                      >
                        ${Number(p.price).toLocaleString("es-CO")} COP
                      </Text>
                      <Text
                        style={{
                          color:
                            p.stock > 5
                              ? "#4caf50"
                              : p.stock > 0
                                ? "#FF9800"
                                : "#dd0000",
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        Stock: {p.stock} |{" "}
                        {p.is_active ? "✅ Activo" : "❌ Inactivo"}
                      </Text>
                    </View>

                    <View style={{ gap: 6, justifyContent: "center" }}>
                      <TouchableOpacity
                        onPress={() => openEdit(p)}
                        style={{
                          backgroundColor: "#1a2a3a",
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: "#2196F3",
                        }}
                      >
                        <Text style={{ color: "#2196F3", fontSize: 12 }}>
                          ✏️ Editar
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(p)}
                        style={{
                          backgroundColor: "#2a0a0a",
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: "#dd0000",
                        }}
                      >
                        <Text style={{ color: "#dd0000", fontSize: 12 }}>
                          🗑️ Eliminar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {p.description && (
                    <Text
                      style={{ color: "#666", fontSize: 12, marginTop: 8 }}
                      numberOfLines={2}
                    >
                      {p.description}
                    </Text>
                  )}
                </View>
              );
            })}

          {/* ── PEDIDOS ── */}
          {tab === "orders" &&
            orders.map((order) => (
              <View
                key={order.id}
                style={{
                  backgroundColor: "#1a1a1a",
                  borderRadius: 10,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#333",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ color: palette.text, fontWeight: "700" }}>
                    Pedido #{order.id}
                  </Text>
                  <Text style={{ color: palette.primary, fontWeight: "900" }}>
                    ${Number(order.total).toLocaleString("es-CO")}
                  </Text>
                </View>
                <Text style={{ color: "#888", fontSize: 12 }}>
                  👤 {order.user_name || "Cliente"}
                  {order.user_phone ? ` · ${order.user_phone}` : ""}
                </Text>
                <Text style={{ color: "#888", fontSize: 12 }}>
                  📍 {order.address}
                </Text>
                <Text style={{ color: "#888", fontSize: 12 }}>
                  💳 {order.payment_method} ·{" "}
                  {new Date(order.created_at).toLocaleDateString("es-CO")}
                </Text>
                {order.items
                  ?.filter((i: any) => i.product_name)
                  .map((item: any, idx: number) => (
                    <Text
                      key={idx}
                      style={{ color: "#666", fontSize: 11, marginTop: 2 }}
                    >
                      • {item.product_name} ×{item.quantity} — $
                      {Number(item.subtotal).toLocaleString("es-CO")}
                    </Text>
                  ))}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 10 }}
                >
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {ORDER_STATUSES.map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => handleOrderStatus(order, s)}
                        style={{
                          paddingVertical: 4,
                          paddingHorizontal: 10,
                          borderRadius: 16,
                          backgroundColor:
                            order.status === s ? palette.primary : "#2a2a2a",
                          borderWidth: 1,
                          borderColor:
                            order.status === s ? palette.primary : "#444",
                        }}
                      >
                        <Text
                          style={{
                            color: order.status === s ? "#000" : "#888",
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {STATUS_LABEL[s]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ))}
        </ScrollView>
      )}

      {/* ── MODAL PRODUCTO ── */}
      <Modal visible={showModal} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "#000000aa",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#111",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              maxHeight: "95%",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: palette.primary,
                  fontWeight: "900",
                  fontSize: 18,
                }}
              >
                {editing ? "✏️ Editar producto" : "➕ Nuevo producto"}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={{ color: "#555", fontSize: 24 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* ── IMÁGENES ── */}
              <Text
                style={{
                  color: palette.primary,
                  fontWeight: "700",
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                Imágenes del producto ({images.length}/{MAX_IMAGES}) *
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                {/* Imágenes existentes */}
                {images.map((img, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 10,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <TouchableOpacity onPress={() => handlePickImage(idx)}>
                      <Image
                        source={{ uri: img }}
                        style={{ width: 90, height: 90 }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeImage(idx)}
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        backgroundColor: "#dd0000",
                        borderRadius: 10,
                        width: 20,
                        height: 20,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: "900",
                        }}
                      >
                        ✕
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {/* Botón agregar */}
                {images.length < MAX_IMAGES && (
                  <TouchableOpacity
                    onPress={() => handlePickImage()}
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderStyle: "dashed",
                      borderColor: palette.primary + "66",
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: "#0d1520",
                    }}
                  >
                    <Text style={{ fontSize: 28, color: palette.primary }}>
                      +
                    </Text>
                    <Text
                      style={{
                        color: palette.primary,
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      Agregar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={{ color: "#555", fontSize: 11, marginBottom: 14 }}>
                Mínimo 1 imagen · Máximo {MAX_IMAGES} · JPG/PNG · max 600KB cada
                una
              </Text>

              {/* Campos de texto */}
              {[
                { label: "Nombre *", key: "name", keyboard: "default" },
                {
                  label: "Descripción",
                  key: "description",
                  keyboard: "default",
                },
                { label: "Precio (COP) *", key: "price", keyboard: "numeric" },
                { label: "Stock", key: "stock", keyboard: "numeric" },
              ].map((field) => (
                <View key={field.key} style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      color: palette.primary,
                      fontWeight: "700",
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    {field.label}
                  </Text>
                  <TextInput
                    value={String(form[field.key] || "")}
                    onChangeText={(v) =>
                      setForm((p: any) => ({ ...p, [field.key]: v }))
                    }
                    keyboardType={field.keyboard as any}
                    placeholder={field.label}
                    placeholderTextColor="#444"
                    multiline={field.key === "description"}
                    numberOfLines={field.key === "description" ? 3 : 1}
                    style={{
                      backgroundColor: "#1a1a1a",
                      borderWidth: 1,
                      borderColor: palette.primary + "44",
                      borderRadius: 8,
                      padding: 12,
                      color: palette.text,
                      textAlignVertical:
                        field.key === "description" ? "top" : "center",
                      minHeight: field.key === "description" ? 70 : undefined,
                    }}
                  />
                </View>
              ))}

              {/* Categoría */}
              <Text
                style={{
                  color: palette.primary,
                  fontWeight: "700",
                  fontSize: 12,
                  marginBottom: 6,
                }}
              >
                Categoría
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() =>
                        setForm((p: any) => ({ ...p, category: cat }))
                      }
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 14,
                        borderRadius: 20,
                        backgroundColor:
                          form.category === cat ? palette.primary : "#1a1a1a",
                        borderWidth: 1,
                        borderColor:
                          form.category === cat ? palette.primary : "#333",
                      }}
                    >
                      <Text
                        style={{
                          color: form.category === cat ? "#000" : "#888",
                          fontWeight: "700",
                        }}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Activo */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                  backgroundColor: "#1a1a1a",
                  padding: 14,
                  borderRadius: 10,
                }}
              >
                <View>
                  <Text style={{ color: palette.text, fontWeight: "700" }}>
                    Producto activo
                  </Text>
                  <Text style={{ color: "#555", fontSize: 11 }}>
                    {form.is_active
                      ? "Visible en la tienda"
                      : "Oculto en la tienda"}
                  </Text>
                </View>
                <Switch
                  value={form.is_active !== false}
                  onValueChange={(v) =>
                    setForm((p: any) => ({ ...p, is_active: v }))
                  }
                  trackColor={{ false: "#333", true: "#1a4d1a" }}
                  thumbColor={form.is_active ? "#4caf50" : "#666"}
                />
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: saving ? "#333" : palette.primary,
                  padding: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  marginBottom: 30,
                }}
              >
                <Text
                  style={{
                    color: saving ? "#666" : "#000",
                    fontWeight: "900",
                    fontSize: 16,
                  }}
                >
                  {saving
                    ? "Guardando..."
                    : editing
                      ? "Actualizar producto"
                      : "Crear producto"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
