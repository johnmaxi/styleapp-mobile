// app/store/index.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
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
  is_active?: boolean;
};

type CartItem = Product & { quantity: number };

const CATEGORIES = [
  "Todos",
  "Cabello",
  "Uñas",
  "Equipos",
  "Maquillaje",
  "Pies",
];

const PAYMENT_OPTIONS = [
  { id: "efectivo", label: "💵 Efectivo contraentrega" },
  { id: "nequi", label: "📱 Nequi contraentrega" },
  { id: "mercadopago", label: "💳 MercadoPago (online)" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "⏳ Pendiente",
  confirmed: "✅ Confirmado",
  shipped: "🚚 En camino",
  delivered: "📦 Entregado",
  cancelled: "❌ Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#D4AF37",
  confirmed: "#2196F3",
  shipped: "#9C27B0",
  delivered: "#4caf50",
  cancelled: "#555",
};

export default function StoreScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const palette = getPalette(user?.gender);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [gettingLoc, setGettingLoc] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);

  // Checkout
  const [address, setAddress] = useState(user?.address || "");
  const [phone, setPhone] = useState("");
  const [payMethod, setPayMethod] = useState("efectivo");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (category !== "Todos") params.category = category;
      if (search.trim()) params.search = search.trim();
      const res = await api.get("/store/products", { params });
      setProducts(res.data.data || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts]),
  );

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await api.get("/store/orders/mine");
      setOrders(res.data.data || []);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  // ── GPS para dirección de entrega ─────────────────────────────────
  const useCurrentLocation = async () => {
    setGettingLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso requerido",
          "Activa la ubicación en tu dispositivo",
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const rev = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (rev?.length > 0) {
        const r = rev[0];
        const parts = [r.street, r.streetNumber, r.district, r.city]
          .filter(Boolean)
          .join(", ");
        setAddress(
          parts ||
            `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`,
        );
      }
    } catch {
      Alert.alert("Error", "No se pudo obtener la ubicación");
    } finally {
      setGettingLoc(false);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      Alert.alert("Sin stock", "Este producto no está disponible.");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          Alert.alert(
            "Stock máximo",
            `Solo hay ${product.stock} unidades disponibles.`,
          );
          return prev;
        }
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: number) =>
    setCart((prev) => prev.filter((i) => i.id !== id));
  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(id);
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)),
    );
  };

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!address.trim()) {
      Alert.alert("Falta dirección", "Ingresa la dirección de entrega");
      return;
    }
    setPlacing(true);
    try {
      const res = await api.post("/store/orders", {
        items: cart.map((i) => ({ product_id: i.id, quantity: i.quantity })),
        payment_method: payMethod,
        address: address.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (res.data.ok) {
        setCart([]);
        setShowCheckout(false);
        setShowCart(false);
        Alert.alert(
          "✅ Pedido confirmado",
          `Tu pedido #${res.data.data.id} fue recibido.\n\nTotal: $${Number(res.data.data.total).toLocaleString("es-CO")} COP\n\nTe contactaremos para coordinar la entrega.`,
          [
            {
              text: "Ver mis pedidos",
              onPress: () => {
                setShowOrders(true);
                loadOrders();
              },
            },
          ],
        );
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || "No se pudo procesar el pedido",
      );
    } finally {
      setPlacing(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      (category === "Todos" || p.category === category) &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase())),
  );

  const getCategoryIcon = (cat?: string) => {
    if (cat === "Cabello") return "💇";
    if (cat === "Uñas") return "💅";
    if (cat === "Equipos") return "⚙️";
    if (cat === "Pies") return "🦶";
    if (cat === "Maquillaje") return "💄";
    return "🛍️";
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      {/* ── HEADER ── */}
      <View
        style={{
          padding: 20,
          paddingTop: 50,
          paddingBottom: 12,
          backgroundColor: palette.background,
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
            <Text style={{ color: palette.primary, fontSize: 16 }}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <Text
            style={{ fontSize: 18, fontWeight: "900", color: palette.primary }}
          >
            🛍️ Tienda
          </Text>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => {
                setShowOrders(true);
                loadOrders();
              }}
            >
              <Text style={{ color: palette.text, fontSize: 13 }}>
                Mis pedidos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowCart(true)}
              style={{ position: "relative" }}
            >
              <Text style={{ fontSize: 24 }}>🛒</Text>
              {cartCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: "#dd0000",
                    borderRadius: 9,
                    width: 18,
                    height: 18,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}
                  >
                    {cartCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          placeholder="Buscar productos..."
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
          style={{
            marginTop: 12,
            backgroundColor: "#141414",
            borderWidth: 1,
            borderColor: palette.primary + "44",
            borderRadius: 8,
            padding: 10,
            color: palette.text,
            fontSize: 14,
          }}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                  backgroundColor:
                    category === cat ? palette.primary : "#1a1a1a",
                  borderWidth: 1,
                  borderColor: category === cat ? palette.primary : "#333",
                }}
              >
                <Text
                  style={{
                    color: category === cat ? "#000" : "#888",
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ── PRODUCTOS ── */}
      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {filteredProducts.length === 0 && (
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Text style={{ fontSize: 40 }}>🛍️</Text>
              <Text style={{ color: "#555", marginTop: 8 }}>
                Sin productos disponibles
              </Text>
            </View>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {filteredProducts.map((product) => {
              const inCart = cart.find((i) => i.id === product.id);
              // Soporte múltiples imágenes — image_url puede ser JSON array o string
              let images: string[] = [];
              try {
                const parsed = JSON.parse(product.image_url || "[]");
                images = Array.isArray(parsed)
                  ? parsed
                  : [product.image_url!].filter(Boolean);
              } catch {
                if (product.image_url) images = [product.image_url];
              }
              const firstImage = images[0];

              return (
                <View
                  key={product.id}
                  style={{
                    width: "47%",
                    backgroundColor: palette.card,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#222",
                    overflow: "hidden",
                  }}
                >
                  {/* Toca imagen para ver detalle */}
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedProduct(product);
                      setSelectedImgIdx(0);
                    }}
                  >
                    <View
                      style={{
                        height: 120,
                        backgroundColor: "#0d1520",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {firstImage ? (
                        <Image
                          source={{ uri: firstImage }}
                          style={{ width: "100%", height: 120 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={{ fontSize: 40 }}>
                          {getCategoryIcon(product.category)}
                        </Text>
                      )}
                      {images.length > 1 && (
                        <View
                          style={{
                            position: "absolute",
                            bottom: 4,
                            right: 4,
                            backgroundColor: "#000000aa",
                            borderRadius: 10,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ color: "#fff", fontSize: 9 }}>
                            +{images.length - 1} fotos
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  <View style={{ padding: 10, gap: 4 }}>
                    {product.category && (
                      <Text
                        style={{
                          color: "#555",
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                        }}
                      >
                        {product.category}
                      </Text>
                    )}
                    <Text
                      style={{
                        color: palette.text,
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                      numberOfLines={2}
                    >
                      {product.name}
                    </Text>
                    <Text
                      style={{
                        color: palette.primary,
                        fontWeight: "900",
                        fontSize: 15,
                      }}
                    >
                      ${Number(product.price).toLocaleString("es-CO")}
                    </Text>
                    <Text
                      style={{
                        color:
                          product.stock > 5
                            ? "#4caf50"
                            : product.stock > 0
                              ? "#FF9800"
                              : "#dd0000",
                        fontSize: 10,
                      }}
                    >
                      {product.stock > 0
                        ? `${product.stock} disponibles`
                        : "Sin stock"}
                    </Text>

                    {inCart ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: 4,
                          backgroundColor: "#1a1a1a",
                          borderRadius: 8,
                          padding: 4,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() =>
                            updateQty(product.id, inCart.quantity - 1)
                          }
                          style={{
                            width: 28,
                            height: 28,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: "#dd0000",
                              fontSize: 18,
                              fontWeight: "900",
                            }}
                          >
                            −
                          </Text>
                        </TouchableOpacity>
                        <Text
                          style={{ color: palette.text, fontWeight: "700" }}
                        >
                          {inCart.quantity}
                        </Text>
                        <TouchableOpacity
                          onPress={() => addToCart(product)}
                          style={{
                            width: 28,
                            height: 28,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: "#4caf50",
                              fontSize: 18,
                              fontWeight: "900",
                            }}
                          >
                            +
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => addToCart(product)}
                        disabled={product.stock <= 0}
                        style={{
                          marginTop: 4,
                          backgroundColor:
                            product.stock > 0 ? palette.primary : "#222",
                          padding: 8,
                          borderRadius: 8,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: product.stock > 0 ? "#000" : "#555",
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          {product.stock > 0 ? "Agregar 🛒" : "Sin stock"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ── MODAL DETALLE PRODUCTO ── */}
      <Modal visible={!!selectedProduct} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "#000000cc",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#111",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "92%",
              overflow: "hidden",
            }}
          >
            {selectedProduct &&
              (() => {
                let imgs: string[] = [];
                try {
                  const parsed = JSON.parse(selectedProduct.image_url || "[]");
                  imgs = Array.isArray(parsed)
                    ? parsed
                    : selectedProduct.image_url
                      ? [selectedProduct.image_url]
                      : [];
                } catch {
                  imgs = selectedProduct.image_url
                    ? [selectedProduct.image_url]
                    : [];
                }
                const inCart = cart.find((i) => i.id === selectedProduct.id);

                return (
                  <ScrollView bounces={false}>
                    {/* Imagen grande */}
                    <View style={{ position: "relative" }}>
                      {imgs.length > 0 ? (
                        <Image
                          source={{ uri: imgs[selectedImgIdx] }}
                          style={{ width: "100%", height: 300 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: "100%",
                            height: 300,
                            backgroundColor: "#0d1520",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: 80 }}>
                            {getCategoryIcon(selectedProduct.category)}
                          </Text>
                        </View>
                      )}
                      {/* Botón cerrar */}
                      <TouchableOpacity
                        onPress={() => setSelectedProduct(null)}
                        style={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          backgroundColor: "#000000bb",
                          borderRadius: 20,
                          width: 36,
                          height: 36,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
                      </TouchableOpacity>
                      {/* Indicadores de imagen */}
                      {imgs.length > 1 && (
                        <View
                          style={{
                            position: "absolute",
                            bottom: 12,
                            left: 0,
                            right: 0,
                            flexDirection: "row",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          {imgs.map((_, idx) => (
                            <TouchableOpacity
                              key={idx}
                              onPress={() => setSelectedImgIdx(idx)}
                            >
                              <View
                                style={{
                                  width: idx === selectedImgIdx ? 20 : 8,
                                  height: 8,
                                  borderRadius: 4,
                                  backgroundColor:
                                    idx === selectedImgIdx
                                      ? palette.primary
                                      : "#ffffff88",
                                }}
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      {/* Miniaturas si hay más de 1 */}
                      {imgs.length > 1 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={{
                            position: "absolute",
                            bottom: 32,
                            left: 12,
                            right: 12,
                          }}
                        >
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            {imgs.map((img, idx) => (
                              <TouchableOpacity
                                key={idx}
                                onPress={() => setSelectedImgIdx(idx)}
                              >
                                <Image
                                  source={{ uri: img }}
                                  style={{
                                    width: 50,
                                    height: 50,
                                    borderRadius: 8,
                                    borderWidth: 2,
                                    borderColor:
                                      idx === selectedImgIdx
                                        ? palette.primary
                                        : "transparent",
                                  }}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      )}
                    </View>

                    {/* Info producto */}
                    <View style={{ padding: 20, gap: 10 }}>
                      {selectedProduct.category && (
                        <Text
                          style={{
                            color: "#555",
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: 2,
                          }}
                        >
                          {selectedProduct.category}
                        </Text>
                      )}
                      <Text
                        style={{
                          color: palette.text,
                          fontWeight: "900",
                          fontSize: 22,
                          lineHeight: 28,
                        }}
                      >
                        {selectedProduct.name}
                      </Text>
                      <Text
                        style={{
                          color: palette.primary,
                          fontWeight: "900",
                          fontSize: 28,
                        }}
                      >
                        ${Number(selectedProduct.price).toLocaleString("es-CO")}
                        <Text
                          style={{
                            fontSize: 14,
                            color: "#888",
                            fontWeight: "400",
                          }}
                        >
                          {" "}
                          COP
                        </Text>
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor:
                              selectedProduct.stock > 0 ? "#4caf50" : "#dd0000",
                          }}
                        />
                        <Text
                          style={{
                            color:
                              selectedProduct.stock > 5
                                ? "#4caf50"
                                : selectedProduct.stock > 0
                                  ? "#FF9800"
                                  : "#dd0000",
                            fontSize: 13,
                          }}
                        >
                          {selectedProduct.stock > 0
                            ? `${selectedProduct.stock} unidades disponibles`
                            : "Sin stock"}
                        </Text>
                      </View>

                      {selectedProduct.description ? (
                        <View
                          style={{
                            backgroundColor: "#0d1520",
                            borderRadius: 12,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: "#1a2a3a",
                          }}
                        >
                          <Text
                            style={{
                              color: "#888",
                              fontSize: 11,
                              fontWeight: "700",
                              marginBottom: 6,
                              textTransform: "uppercase",
                            }}
                          >
                            Descripción
                          </Text>
                          <Text
                            style={{
                              color: "#ccc",
                              fontSize: 14,
                              lineHeight: 22,
                            }}
                          >
                            {selectedProduct.description}
                          </Text>
                        </View>
                      ) : null}

                      {/* Botón agregar al carrito */}
                      {inCart ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: "#1a1a1a",
                            borderRadius: 12,
                            padding: 8,
                            marginTop: 4,
                          }}
                        >
                          <TouchableOpacity
                            onPress={() =>
                              updateQty(selectedProduct.id, inCart.quantity - 1)
                            }
                            style={{
                              width: 44,
                              height: 44,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#2a0a0a",
                              borderRadius: 10,
                            }}
                          >
                            <Text
                              style={{
                                color: "#dd0000",
                                fontSize: 22,
                                fontWeight: "900",
                              }}
                            >
                              −
                            </Text>
                          </TouchableOpacity>
                          <View style={{ alignItems: "center" }}>
                            <Text
                              style={{
                                color: palette.text,
                                fontWeight: "900",
                                fontSize: 20,
                              }}
                            >
                              {inCart.quantity}
                            </Text>
                            <Text style={{ color: "#555", fontSize: 11 }}>
                              en el carrito
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => addToCart(selectedProduct)}
                            style={{
                              width: 44,
                              height: 44,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#0a2a0a",
                              borderRadius: 10,
                            }}
                          >
                            <Text
                              style={{
                                color: "#4caf50",
                                fontSize: 22,
                                fontWeight: "900",
                              }}
                            >
                              +
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            addToCart(selectedProduct);
                          }}
                          disabled={selectedProduct.stock <= 0}
                          style={{
                            backgroundColor:
                              selectedProduct.stock > 0
                                ? palette.primary
                                : "#222",
                            padding: 16,
                            borderRadius: 12,
                            alignItems: "center",
                            marginTop: 4,
                          }}
                        >
                          <Text
                            style={{
                              color:
                                selectedProduct.stock > 0 ? "#000" : "#555",
                              fontWeight: "900",
                              fontSize: 16,
                            }}
                          >
                            {selectedProduct.stock > 0
                              ? "🛒 Agregar al carrito"
                              : "Sin stock"}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {inCart && (
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedProduct(null);
                            setShowCart(true);
                          }}
                          style={{
                            borderWidth: 1,
                            borderColor: palette.primary,
                            padding: 14,
                            borderRadius: 12,
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: palette.primary,
                              fontWeight: "700",
                            }}
                          >
                            Ver carrito ({cartCount} items) →
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </ScrollView>
                );
              })()}
          </View>
        </View>
      </Modal>

      {/* ── MODAL CARRITO ── */}
      <Modal visible={showCart} transparent animationType="slide">
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
              maxHeight: "80%",
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
                🛒 Mi carrito ({cartCount})
              </Text>
              <TouchableOpacity onPress={() => setShowCart(false)}>
                <Text style={{ color: "#555", fontSize: 24 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {cart.length === 0 ? (
              <View style={{ alignItems: "center", padding: 40 }}>
                <Text style={{ fontSize: 40 }}>🛒</Text>
                <Text style={{ color: "#555", marginTop: 8 }}>
                  El carrito está vacío
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {cart.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: "#222",
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.text, fontWeight: "700" }}>
                        {item.name}
                      </Text>
                      <Text style={{ color: palette.primary, fontSize: 13 }}>
                        ${Number(item.price).toLocaleString("es-CO")} ×{" "}
                        {item.quantity}
                      </Text>
                    </View>
                    <Text style={{ color: palette.primary, fontWeight: "900" }}>
                      ${(item.price * item.quantity).toLocaleString("es-CO")}
                    </Text>
                    <TouchableOpacity onPress={() => removeFromCart(item.id)}>
                      <Text style={{ color: "#dd0000", fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            {cart.length > 0 && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    borderTopWidth: 1,
                    borderTopColor: "#333",
                    marginTop: 8,
                  }}
                >
                  <Text
                    style={{
                      color: palette.text,
                      fontWeight: "700",
                      fontSize: 16,
                    }}
                  >
                    Total
                  </Text>
                  <Text
                    style={{
                      color: palette.primary,
                      fontWeight: "900",
                      fontSize: 18,
                    }}
                  >
                    ${cartTotal.toLocaleString("es-CO")} COP
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowCart(false);
                    setShowCheckout(true);
                  }}
                  style={{
                    backgroundColor: palette.primary,
                    padding: 14,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ color: "#000", fontWeight: "900", fontSize: 16 }}
                  >
                    Proceder al pago →
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL CHECKOUT ── */}
      <Modal visible={showCheckout} transparent animationType="slide">
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
              maxHeight: "92%",
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
                Finalizar pedido
              </Text>
              <TouchableOpacity onPress={() => setShowCheckout(false)}>
                <Text style={{ color: "#555", fontSize: 24 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {/* Resumen */}
              <View
                style={{
                  backgroundColor: "#0d1520",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: palette.primary + "44",
                }}
              >
                <Text style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>
                  Resumen del pedido
                </Text>
                {cart.map((i) => (
                  <View
                    key={i.id}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 2,
                    }}
                  >
                    <Text style={{ color: "#aaa", fontSize: 13 }}>
                      {i.name} ×{i.quantity}
                    </Text>
                    <Text style={{ color: palette.primary, fontSize: 13 }}>
                      ${(i.price * i.quantity).toLocaleString("es-CO")}
                    </Text>
                  </View>
                ))}
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: "#222",
                    marginTop: 8,
                    paddingTop: 8,
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: palette.text, fontWeight: "700" }}>
                    Total
                  </Text>
                  <Text
                    style={{
                      color: palette.primary,
                      fontWeight: "900",
                      fontSize: 16,
                    }}
                  >
                    ${cartTotal.toLocaleString("es-CO")} COP
                  </Text>
                </View>
              </View>

              {/* Dirección + GPS */}
              <Text
                style={{
                  color: palette.primary,
                  fontWeight: "700",
                  marginBottom: 6,
                }}
              >
                Dirección de entrega *
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Calle, número, barrio, ciudad"
                  placeholderTextColor="#555"
                  style={{
                    flex: 1,
                    backgroundColor: "#141414",
                    borderWidth: 1,
                    borderColor: palette.primary + "44",
                    borderRadius: 8,
                    padding: 12,
                    color: palette.text,
                  }}
                />
                <TouchableOpacity
                  onPress={useCurrentLocation}
                  disabled={gettingLoc}
                  style={{
                    backgroundColor: "#141414",
                    borderWidth: 1,
                    borderColor: palette.primary + "44",
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: gettingLoc ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>📍</Text>
                  <Text style={{ color: palette.primary, fontSize: 9 }}>
                    {gettingLoc ? "..." : "GPS"}
                  </Text>
                </TouchableOpacity>
              </View>
              {address.trim().length > 0 && (
                <Text
                  style={{ color: "#4caf50", fontSize: 11, marginBottom: 8 }}
                >
                  ✓ {address}
                </Text>
              )}

              {/* Teléfono */}
              <Text
                style={{
                  color: palette.primary,
                  fontWeight: "700",
                  marginBottom: 6,
                }}
              >
                Teléfono de contacto
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="3001234567"
                placeholderTextColor="#555"
                keyboardType="numeric"
                style={{
                  backgroundColor: "#141414",
                  borderWidth: 1,
                  borderColor: palette.primary + "44",
                  borderRadius: 8,
                  padding: 12,
                  color: palette.text,
                  marginBottom: 12,
                }}
              />

              {/* Pago */}
              <Text
                style={{
                  color: palette.primary,
                  fontWeight: "700",
                  marginBottom: 8,
                }}
              >
                Método de pago
              </Text>
              {PAYMENT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setPayMethod(opt.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor:
                      payMethod === opt.id ? palette.primary : "#333",
                    backgroundColor:
                      payMethod === opt.id
                        ? palette.primary + "22"
                        : "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: palette.primary,
                      backgroundColor:
                        payMethod === opt.id ? palette.primary : "transparent",
                    }}
                  />
                  <Text style={{ color: palette.text }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}

              {/* Notas */}
              <Text
                style={{
                  color: palette.primary,
                  fontWeight: "700",
                  marginTop: 8,
                  marginBottom: 6,
                }}
              >
                Notas adicionales (opcional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Instrucciones de entrega..."
                placeholderTextColor="#555"
                multiline
                numberOfLines={2}
                style={{
                  backgroundColor: "#141414",
                  borderWidth: 1,
                  borderColor: palette.primary + "44",
                  borderRadius: 8,
                  padding: 12,
                  color: palette.text,
                  marginBottom: 16,
                }}
              />

              <TouchableOpacity
                onPress={handlePlaceOrder}
                disabled={placing}
                style={{
                  backgroundColor: palette.primary,
                  padding: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  marginBottom: 20,
                  opacity: placing ? 0.7 : 1,
                }}
              >
                <Text
                  style={{ color: "#000", fontWeight: "900", fontSize: 16 }}
                >
                  {placing
                    ? "Procesando..."
                    : `Confirmar pedido — $${cartTotal.toLocaleString("es-CO")}`}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL MIS PEDIDOS ── */}
      <Modal visible={showOrders} transparent animationType="slide">
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
              maxHeight: "85%",
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
                📦 Mis pedidos
              </Text>
              <TouchableOpacity onPress={() => setShowOrders(false)}>
                <Text style={{ color: "#555", fontSize: 24 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {ordersLoading ? (
              <ActivityIndicator color={palette.primary} />
            ) : orders.length === 0 ? (
              <View style={{ alignItems: "center", padding: 40 }}>
                <Text style={{ fontSize: 40 }}>📦</Text>
                <Text style={{ color: "#555", marginTop: 8 }}>
                  Sin pedidos aún
                </Text>
              </View>
            ) : (
              <ScrollView>
                {orders.map((order) => (
                  <View
                    key={order.id}
                    style={{
                      backgroundColor: "#1a1a1a",
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: STATUS_COLOR[order.status] || "#333",
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
                      <View
                        style={{
                          backgroundColor:
                            (STATUS_COLOR[order.status] || "#555") + "22",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 12,
                        }}
                      >
                        <Text
                          style={{
                            color: STATUS_COLOR[order.status] || "#888",
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          {STATUS_LABEL[order.status]}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: "#888", fontSize: 12 }}>
                      📅{" "}
                      {new Date(order.created_at).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                    {order.items
                      ?.filter((i: any) => i.product_name)
                      .map((item: any, idx: number) => (
                        <Text
                          key={idx}
                          style={{ color: "#aaa", fontSize: 12, marginTop: 2 }}
                        >
                          • {item.product_name} ×{item.quantity} — $
                          {Number(item.subtotal).toLocaleString("es-CO")}
                        </Text>
                      ))}
                    <Text
                      style={{
                        color: palette.primary,
                        fontWeight: "700",
                        marginTop: 6,
                      }}
                    >
                      Total: ${Number(order.total).toLocaleString("es-CO")} COP
                    </Text>
                    <Text style={{ color: "#555", fontSize: 11, marginTop: 2 }}>
                      💳 {order.payment_method} · 📍 {order.address}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
