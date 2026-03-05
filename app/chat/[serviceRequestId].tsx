// app/chat/[serviceRequestId].tsx
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import database from "@react-native-firebase/database";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type Message = {
  id: string;
  text: string;
  senderId: number;
  senderName: string;
  timestamp: number;
};

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const params = useLocalSearchParams<{
    serviceRequestId: string;
    otherUserName?: string;
  }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const chatPath = `chats/service_${params.serviceRequestId}`;
  const otherName = params.otherUserName || "Usuario";

  useEffect(() => {
    if (!params.serviceRequestId) return;

    const ref = database().ref(chatPath).orderByChild("timestamp").limitToLast(100);

    const onValue = ref.on("value", (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        setLoading(false);
        return;
      }
      const parsed: Message[] = Object.entries(data).map(([key, val]: any) => ({
        id: key,
        ...val,
      }));
      parsed.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(parsed);
      setLoading(false);
      // Scroll al final
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => ref.off("value", onValue);
  }, [params.serviceRequestId]);

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    setText("");
    try {
      await database().ref(chatPath).push({
        text: trimmed,
        senderId: user.id,
        senderName: user.name || user.email || "Usuario",
        timestamp: Date.now(),
      });
    } catch (err) {
      console.log("Error enviando mensaje:", err);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  const isMe = (msg: Message) => msg.senderId === user?.id;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.background }}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* HEADER */}
      <View style={{
        flexDirection: "row", alignItems: "center", padding: 16,
        borderBottomWidth: 1, borderBottomColor: palette.primary + "44",
        backgroundColor: palette.card,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ color: palette.primary, fontSize: 22, fontWeight: "700" }}>{"<"}</Text>
        </TouchableOpacity>
        <View style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", marginRight: 10,
        }}>
          <Text style={{ color: "#000", fontWeight: "900", fontSize: 16 }}>
            {otherName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={{ color: palette.text, fontWeight: "700", fontSize: 15 }}>{otherName}</Text>
          <Text style={{ color: "#888", fontSize: 11 }}>Servicio #{params.serviceRequestId}</Text>
        </View>
      </View>

      {/* MENSAJES */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ color: "#555", fontSize: 14 }}>
              Inicia la conversacion con {otherName}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = isMe(item);
          return (
            <View style={{
              alignSelf: mine ? "flex-end" : "flex-start",
              maxWidth: "78%",
              marginBottom: 4,
            }}>
              {!mine && (
                <Text style={{ color: "#888", fontSize: 11, marginBottom: 2, marginLeft: 4 }}>
                  {item.senderName}
                </Text>
              )}
              <View style={{
                backgroundColor: mine ? palette.primary : palette.card,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 18,
                borderBottomRightRadius: mine ? 4 : 18,
                borderBottomLeftRadius: mine ? 18 : 4,
                borderWidth: mine ? 0 : 1,
                borderColor: "#333",
              }}>
                <Text style={{ color: mine ? "#000" : palette.text, fontSize: 15 }}>
                  {item.text}
                </Text>
                <Text style={{
                  color: mine ? "#00000088" : "#666",
                  fontSize: 10,
                  textAlign: "right",
                  marginTop: 4,
                }}>
                  {formatTime(item.timestamp)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* INPUT */}
      <View style={{
        flexDirection: "row",
        padding: 12,
        paddingBottom: Platform.OS === "ios" ? 24 : 12,
        borderTopWidth: 1,
        borderTopColor: palette.primary + "44",
        backgroundColor: palette.card,
        gap: 8,
        alignItems: "flex-end",
      }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribe un mensaje..."
          placeholderTextColor="#555"
          multiline
          maxLength={500}
          style={{
            flex: 1,
            backgroundColor: "#1a1a1a",
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingVertical: 10,
            color: palette.text,
            borderWidth: 1,
            borderColor: palette.primary + "55",
            maxHeight: 100,
            fontSize: 15,
          }}
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!text.trim()}
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: text.trim() ? palette.primary : "#333",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: text.trim() ? "#000" : "#666", fontWeight: "900", fontSize: 18 }}>
            {">"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}