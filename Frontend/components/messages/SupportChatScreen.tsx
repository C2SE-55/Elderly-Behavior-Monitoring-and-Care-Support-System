import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import {
  getCurrentUser,
  getSupportMessages,
  markSupportMessagesRead,
  sendSupportMessage,
  SupportChatMessage,
} from "@/services/api";
import { connectRoomChatSocket, getRoomChatSocket } from "@/services/roomChatSocket";

const TYPING_IDLE_MS = 2200;
const COLORS = {
  bg: "#F3F4FB",
  card: "#FFFFFF",
  border: "rgba(148,163,184,0.2)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  softPrimary: "#EEE8FF",
  accent: "#0EA5E9",
};

const fmt = (iso?: string | null) => {
  if (!iso) return "";
  const d = dayjs(iso);
  if (!d.isValid()) return "";
  return d.format("HH:mm DD/MM");
};

export default function SupportChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId?: string; userName?: string; title?: string }>();
  const targetUserId = Number(params.userId || 0) || undefined;
  const title = String(params.title || "Hỗ trợ trực tiếp");
  const me = getCurrentUser();
  const myUserId = Number(me?.id || 0);
  const myName = String(me?.fullName || me?.username || "Thanh vien");
  const myRole = String(me?.role || "user").toLowerCase();
  const isAdmin = myRole === "admin";

  const [conversationId, setConversationId] = useState<number>(0);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState("");
  const [typingText, setTypingText] = useState("");

  const beforeIdRef = useRef<number | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<SupportChatMessage> | null>(null);
  const prevLoadingRef = useRef(true);

  const scrollToLatest = useCallback((animated: boolean) => {
    const run = () => listRef.current?.scrollToEnd({ animated });
    requestAnimationFrame(run);
    setTimeout(run, 80);
    setTimeout(run, 200);
  }, []);

  const loadInitial = useCallback(async () => {
    if (isAdmin && !targetUserId) {
      router.replace("/(screens)/admin-support-chat");
      return;
    }
    setLoading(true);
    try {
      const page = await getSupportMessages(targetUserId, { limit: 100 });
      const cid = Number(page.conversation?.id || 0);
      setConversationId(cid);
      setMessages(page.items || []);
      setHasMore(!!page.has_more);
      beforeIdRef.current = page.next_before_id;
      const latestId = Number(page.items?.[page.items.length - 1]?.id || 0);
      if (latestId > 0) {
        await markSupportMessagesRead({ read_until_id: latestId }, targetUserId);
      }
    } catch {
      setMessages([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, router, targetUserId]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const before = Number(beforeIdRef.current || 0);
    if (!before) return;
    setLoadingMore(true);
    try {
      const page = await getSupportMessages(targetUserId, { limit: 100, before_id: before });
      setMessages((prev) => {
        const ids = new Set(prev.map((x) => x.id));
        const older = (page.items || []).filter((x) => !ids.has(x.id));
        return [...older, ...prev];
      });
      setHasMore(!!page.has_more);
      beforeIdRef.current = page.next_before_id;
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, targetUserId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  /** Khi loadInitial xong (loading true → false), nhảy xuống tin mới nhất — không gọi khi chỉ prepend tin cũ. */
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;
    if (wasLoading && !loading && messages.length > 0) {
      scrollToLatest(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 320);
    }
  }, [loading, messages.length, scrollToLatest]);

  /** Mỗi lần vào màn hình, cuộn xuống cuối (sau khi đã có tin). */
  useFocusEffect(
    useCallback(() => {
      if (loading || messages.length === 0) return;
      scrollToLatest(false);
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 280);
      return () => clearTimeout(t);
    }, [loading, messages.length, scrollToLatest])
  );

  useEffect(() => {
    const socket = connectRoomChatSocket();
    if (!socket || !conversationId) return;
    socket.emit("support:join", { conversationId });

    const onNew = (payload: any) => {
      const msg = payload?.message as SupportChatMessage | undefined;
      if (!msg || Number(payload?.conversationId || msg.conversation_id || 0) !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((x) => x.id === msg.id)) return prev;
        return [...prev, msg];
      });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      if (Number(msg.sender_user_id) !== myUserId) {
        void markSupportMessagesRead({ message_ids: [msg.id] }, targetUserId);
      }
    };

    const onTyping = (payload: any) => {
      if (Number(payload?.conversationId || 0) !== conversationId) return;
      if (!payload?.isTyping) {
        setTypingText("");
        return;
      }
      const uid = Number(payload?.userId || 0);
      if (uid === myUserId) return;
      const name = String(payload?.userName || "Ai đó").trim();
      setTypingText(`${name} đang gõ...`);
    };

    const onSeen = (payload: any) => {
      if (Number(payload?.conversationId || 0) !== conversationId) return;
      const messageId = Number(payload?.message_id || 0);
      const seenBy = Array.isArray(payload?.seen_by) ? payload.seen_by : [];
      if (!messageId) return;
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, seen_by: seenBy } : m)));
    };

    socket.on("support:message:new", onNew);
    socket.on("support:typing", onTyping);
    socket.on("support:message:seen", onSeen);
    return () => {
      const live = getRoomChatSocket();
      live?.off("support:message:new", onNew);
      live?.off("support:typing", onTyping);
      live?.off("support:message:seen", onSeen);
    };
  }, [conversationId, myUserId, targetUserId]);

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      const socket = getRoomChatSocket();
      if (!socket || !conversationId) return;
      socket.emit("support:typing", { conversationId, isTyping, userName: myName });
    },
    [conversationId, myName]
  );

  const onDraftChange = (text: string) => {
    setDraft(text);
    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emitTyping(false);
    }, TYPING_IDLE_MS);
  };

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    emitTyping(false);
    try {
      await sendSupportMessage(content, targetUserId);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch {
      // keep UX stable; message list will sync from socket/poll
    }
  };

  const headerTitle = useMemo(() => {
    if (params.userName) return `Hỗ trợ: ${String(params.userName)}`;
    return title;
  }, [params.userName, title]);

  const renderMessage = ({ item }: { item: SupportChatMessage }) => {
    const mine = Number(item.sender_user_id) === myUserId;
    const seenText = mine
      ? (item.seen_by || [])
          .filter((x) => Number(x.user_id) !== myUserId)
          .map((x) => x.user_name)
          .join(", ")
      : "";
    return (
      <View style={[styles.messageWrap, mine ? styles.messageMineWrap : styles.messageOtherWrap]}>
        {!mine && (
          <View style={styles.senderBadge}>
            <Text style={styles.sender}>{item.sender_name}</Text>
          </View>
        )}
        <View style={[styles.bubble, mine ? styles.mine : styles.other]}>
          <Text style={[styles.messageText, mine && { color: "#FFFFFF" }]}>{item.content}</Text>
        </View>
        <View style={[styles.metaRow, mine ? styles.metaRowMine : styles.metaRowOther]}>
          <Text style={styles.meta}>{fmt(item.created_at)}</Text>
          {!!seenText && <Text style={styles.seen}>Đã xem bởi {seenText}</Text>}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.room}>{headerTitle}</Text>
            <Text style={styles.typing} numberOfLines={1}>
              {typingText || "Đang hoạt động"}
            </Text>
          </View>
        </View>

        <FlatList
          ref={(r) => {
            listRef.current = r;
          }}
          style={styles.messageList}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 18 }}
          onScrollToIndexFailed={() => {}}
          onScroll={({ nativeEvent }) => {
            if (nativeEvent.contentOffset.y < 40) void loadOlder();
          }}
          scrollEventThrottle={16}
          ListFooterComponent={
            loadingMore ? <Text style={styles.loadingMore}>Đang tải thêm tin cũ...</Text> : <View />
          }
          ListEmptyComponent={
            loading ? (
              <Text style={styles.empty}>Đang tải tin nhắn...</Text>
            ) : (
              <Text style={styles.empty}>Chưa có tin nhắn. Hãy gửi lời nhắn đầu tiên để bắt đầu.</Text>
            )
          }
        />

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={styles.input}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#94A3B8"
            value={draft}
            onChangeText={onDraftChange}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={() => void send()} activeOpacity={0.9}>
            <Feather name="send" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.18)",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#0B1220",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  room: { fontSize: 17, fontWeight: "900", color: COLORS.text },
  typing: { marginTop: 3, color: COLORS.sub, fontSize: 12, minHeight: 16, fontWeight: "700" },
  messageList: { flex: 1 },
  messageWrap: { marginBottom: 14, maxWidth: "88%" },
  messageMineWrap: { alignSelf: "flex-end", alignItems: "flex-end" },
  messageOtherWrap: { alignSelf: "flex-start", alignItems: "flex-start" },
  senderBadge: {
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
  },
  sender: { fontSize: 11, color: "#334155", fontWeight: "800" },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
  },
  mine: {
    backgroundColor: COLORS.primary,
    borderColor: "rgba(167,139,250,0.65)",
    borderBottomRightRadius: 8,
  },
  other: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 8,
    shadowColor: "#0B1220",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  messageText: { color: COLORS.text, fontSize: 14, fontWeight: "700", lineHeight: 21 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
  metaRowMine: { justifyContent: "flex-end" },
  metaRowOther: { justifyContent: "flex-start" },
  meta: { color: "#64748B", fontSize: 10, fontWeight: "600" },
  seen: { color: COLORS.accent, fontSize: 10, fontWeight: "700" },
  empty: { marginTop: 20, textAlign: "center", color: "#64748B", fontWeight: "600", lineHeight: 20, paddingHorizontal: 24 },
  loadingMore: { textAlign: "center", color: "#64748B", fontSize: 12, marginVertical: 10 },
  composer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.14)",
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontWeight: "600",
  },
  sendBtn: {
    height: 42,
    width: 44,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
