import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Animated,
} from "react-native";
import {
  sendChatMessage,
  getCurrentUser,
  getChatSessionMessages,
  getChatSessions,
  deleteChatSession,
  getLastChatSessionId,
  setLastChatSessionId,
  type ChatSessionSummary,
} from "@/services/api";

const { width, height } = Dimensions.get("window");

const BOT_SIZE = 53;
const BOTTOM_SAFE_OFFSET = 100; // để không đè lên thanh menu

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Xin chào, mình là trợ lý ảo. Mình có thể giúp gì cho bạn?",
};

const FloatingAssistant: React.FC = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionList, setSessionList] = useState<ChatSessionSummary[]>([]);
  const [initializing, setInitializing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const resolveUserId = useCallback(() => {
    const user = getCurrentUser() as any;
    return user?.id ?? user?.user_id ?? undefined;
  }, []);

  const initialPos = {
    x: width - BOT_SIZE - 24,
    y: height - BOTTOM_SAFE_OFFSET - BOT_SIZE,
  };

  // Lưu toạ độ logic
  const positionRef = useRef(initialPos);
  // Animated value để di chuyển mượt mà
  const animatedPos = useRef(new Animated.ValueXY(initialPos)).current;

  const gestureRef = useRef({ startX: 0, startY: 0, moved: false });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          gestureRef.current = { startX: positionRef.current.x, startY: positionRef.current.y, moved: false };
        },
        onPanResponderMove: (_evt, gestureState) => {
          gestureRef.current.moved = true;

          let nextX = gestureRef.current.startX + gestureState.dx;
          let nextY = gestureRef.current.startY + gestureState.dy;

          const margin = 8;
          nextX = Math.max(margin, Math.min(nextX, width - BOT_SIZE - margin));
          nextY = Math.max(margin, Math.min(nextY, height - BOT_SIZE - BOTTOM_SAFE_OFFSET));

          positionRef.current = { x: nextX, y: nextY };
          animatedPos.setValue({ x: nextX, y: nextY });
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const distance = Math.abs(gestureState.dx) + Math.abs(gestureState.dy);

          // Snap về cạnh gần nhất giống chat-head iOS
          const margin = 8;
          const middleX = width / 2;
          const currentX = positionRef.current.x;
          const snappedX =
            currentX + BOT_SIZE / 2 < middleX
              ? margin
              : width - BOT_SIZE - margin;

          positionRef.current = { x: snappedX, y: positionRef.current.y };

          Animated.spring(animatedPos, {
            toValue: { x: snappedX, y: positionRef.current.y },
            useNativeDriver: true,
            friction: 7,
            tension: 40,
          }).start();

          // Nếu gần như không kéo thì coi như click để mở chat
          if (distance < 5) {
            setChatOpen((prev) => !prev);
          }
        },
      }),
    []
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || initializing) return;
    setInput("");
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const userId = resolveUserId();
      const res = await sendChatMessage(text, {
        user_id: userId,
        session_id: sessionId ?? undefined,
      });
      if (res.session_id) {
        setSessionId(res.session_id);
        setLastChatSessionId(res.session_id);
      }
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: res.reply },
      ]);
      if (userId) {
        const sessions = await getChatSessions(userId);
        setSessionList(sessions);
      }
    } catch (_e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "Không thể kết nối trợ lý. Bạn kiểm tra Chatbot Service (port 8000) và thử lại.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, initializing, sessionId, resolveUserId]);

  const handleStartNewSession = useCallback(async () => {
    setSessionId(null);
    setLastChatSessionId(null);
    setMessages([INITIAL_MESSAGE]);
  }, []);

  const loadLatestSession = useCallback(async () => {
    const userId = resolveUserId();
    setInitializing(true);
    try {
      const rememberedSessionId = getLastChatSessionId();
      if (rememberedSessionId) {
        setSessionId(rememberedSessionId);
        const rememberedRows = await getChatSessionMessages(rememberedSessionId, userId);
        if (rememberedRows.length) {
          setMessages(
            rememberedRows.map((m, idx) => ({
              id: String(m.id ?? `${m.role}-${idx}`),
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            }))
          );
          return;
        }
      }

      const sessions = await getChatSessions(userId);
      setSessionList(sessions);
      if (!sessions.length) {
        setSessionId(null);
        setLastChatSessionId(null);
        setMessages([INITIAL_MESSAGE]);
        return;
      }
      const sid = Number(sessions[0].id);
      setSessionId(sid);
      setLastChatSessionId(sid);
      const rows = await getChatSessionMessages(sid, userId);
      if (!rows.length) {
        setMessages([INITIAL_MESSAGE]);
      } else {
        setMessages(
          rows.map((m, idx) => ({
            id: String(m.id ?? `${m.role}-${idx}`),
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          }))
        );
      }
    } catch {
      setSessionId(null);
      setMessages([INITIAL_MESSAGE]);
    } finally {
      setInitializing(false);
    }
  }, [resolveUserId]);

  const handleSelectSession = useCallback(
    async (sid: number) => {
      const userId = resolveUserId();
      setLoading(true);
      try {
        setSessionId(sid);
        setLastChatSessionId(sid);
        const rows = await getChatSessionMessages(sid, userId);
        if (!rows.length) {
          setMessages([INITIAL_MESSAGE]);
          return;
        }
        setMessages(
          rows.map((m, idx) => ({
            id: String(m.id ?? `${m.role}-${idx}`),
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          }))
        );
      } finally {
        setLoading(false);
      }
    },
    [resolveUserId]
  );

  const handleDeleteSession = useCallback(
    async (sid: number) => {
      const doDelete = async () => {
        const userId = resolveUserId();
        setLoading(true);
        try {
          await deleteChatSession(sid, userId);
          const sessions = await getChatSessions(userId);
          setSessionList(sessions);

          if (sessionId === sid) {
            if (sessions.length > 0) {
              const nextId = Number(sessions[0].id);
              setSessionId(nextId);
              setLastChatSessionId(nextId);
              const rows = await getChatSessionMessages(nextId, userId);
              if (!rows.length) {
                setMessages([INITIAL_MESSAGE]);
              } else {
                setMessages(
                  rows.map((m, idx) => ({
                    id: String(m.id ?? `${m.role}-${idx}`),
                    role: m.role === "user" ? "user" : "assistant",
                    content: m.content,
                  }))
                );
              }
            } else {
              setSessionId(null);
              setLastChatSessionId(null);
              setMessages([INITIAL_MESSAGE]);
            }
          }
        } catch {
          // Web không có Alert native ổn định, dùng confirm + fallback bằng chat message.
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: "Không thể xóa phiên chat. Bạn thử lại nhé.",
            },
          ]);
        } finally {
          setLoading(false);
        }
      };

      if (Platform.OS === "web") {
        const confirmed = typeof window !== "undefined" ? window.confirm("Bạn có chắc muốn xóa phiên chat này không?") : true;
        if (!confirmed) return;
        await doDelete();
        return;
      }

      // Native: xóa trực tiếp để tránh lỗi chặn thao tác trên một số môi trường.
      await doDelete();
    },
    [resolveUserId, sessionId]
  );

  useEffect(() => {
    if (chatOpen) {
      loadLatestSession();
    }
  }, [chatOpen, loadLatestSession]);

  return (
    <>
      {/* Nút trợ lý ảo trôi nổi */}
      <Animated.View
        style={[
          styles.botContainer,
          { transform: animatedPos.getTranslateTransform() },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.botShadow}>
          <View style={styles.botCircle}>
            <View style={styles.botInnerCircle}>
              <Text style={styles.botEmoji}>🤖</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Overlay hộp chat */}
      {chatOpen && (
        <View style={styles.overlay}>
          <View style={styles.chatCard}>
            {/* Header */}
            <View style={styles.chatHeader}>
              <View>
                <Text style={styles.chatTitle}>Trợ lý ảo</Text>
                <View style={styles.chatStatusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Online</Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity onPress={handleStartNewSession} disabled={loading || initializing}>
                  <Text style={styles.newSessionText}>Phiên mới</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChatOpen(false)}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Nội dung chat */}
            {sessionList.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sessionList}
              >
                {sessionList.map((s) => (
                  <View
                    key={String(s.id)}
                    style={[
                      styles.sessionChip,
                      sessionId === Number(s.id) && styles.sessionChipActive,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.sessionMainBtn}
                      onPress={() => handleSelectSession(Number(s.id))}
                      disabled={loading || initializing}
                    >
                      <Text
                        style={[
                          styles.sessionChipText,
                          sessionId === Number(s.id) && styles.sessionChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {s.title || `Phiên #${s.id}`}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sessionDeleteBtn}
                      onPress={() => {
                        void handleDeleteSession(Number(s.id));
                      }}
                      disabled={loading || initializing}
                    >
                      <Text style={styles.sessionDeleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <ScrollView
              ref={scrollRef}
              style={styles.chatBody}
              contentContainerStyle={styles.chatBodyContent}
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({ animated: true })
              }
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((msg) =>
                msg.role === "assistant" ? (
                  <View key={msg.id} style={styles.messageRowLeft}>
                    <View style={styles.messageBubbleLeft}>
                      <Text style={styles.messageTextLeft}>{msg.content}</Text>
                    </View>
                  </View>
                ) : (
                  <View key={msg.id} style={styles.messageRowRight}>
                    <View style={styles.messageBubbleRight}>
                      <Text style={styles.messageTextRight}>{msg.content}</Text>
                    </View>
                  </View>
                )
              )}
              {loading && (
                <View style={styles.messageRowLeft}>
                  <View style={styles.messageBubbleLeft}>
                    <ActivityIndicator size="small" color="#4B2E83" />
                  </View>
                </View>
              )}
              {initializing && (
                <View style={styles.messageRowLeft}>
                  <View style={styles.messageBubbleLeft}>
                    <Text style={styles.messageTextLeft}>Đang tải lịch sử phiên chat...</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Thanh nhập tin nhắn */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Nhập tin nhắn của bạn..."
                placeholderTextColor="#9CA3AF"
                value={input}
                onChangeText={setInput}
                editable={!loading}
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={loading}
              >
                <Text style={styles.sendIcon}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
};

export default FloatingAssistant;

const styles = StyleSheet.create({
  botContainer: {
    position: "absolute",
    zIndex: 50,
  },
  botShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  botCircle: {
    width: BOT_SIZE,
    height: BOT_SIZE,
    borderRadius: BOT_SIZE / 2,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C4B5FD",
  },
  botInnerCircle: {
    width: BOT_SIZE - 10,
    height: BOT_SIZE - 10,
    borderRadius: (BOT_SIZE - 10) / 2,
    backgroundColor: "#4B2E83",
    alignItems: "center",
    justifyContent: "center",
  },
  botEmoji: {
    fontSize: 26,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  chatCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  chatHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#4B2E83",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  chatStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 4,
  },
  statusText: {
    color: "#E5E7EB",
    fontSize: 12,
  },
  closeText: {
    color: "#E5E7EB",
    fontSize: 18,
    marginLeft: 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  newSessionText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "600",
  },
  chatBody: {
    maxHeight: 320,
    backgroundColor: "#F3F4F6",
  },
  sessionList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  sessionChip: {
    maxWidth: 170,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  sessionMainBtn: {
    flexShrink: 1,
    marginRight: 6,
  },
  sessionDeleteBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  sessionDeleteText: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 13,
  },
  sessionChipActive: {
    backgroundColor: "#E9E2FB",
  },
  sessionChipText: {
    fontSize: 12,
    color: "#374151",
  },
  sessionChipTextActive: {
    color: "#4B2E83",
    fontWeight: "700",
  },
  chatBodyContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  messageRowLeft: {
    alignItems: "flex-start",
    marginBottom: 10,
  },
  messageRowRight: {
    alignItems: "flex-end",
    marginBottom: 4,
  },
  messageBubbleLeft: {
    maxWidth: "80%",
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
  },
  messageBubbleRight: {
    maxWidth: "80%",
    backgroundColor: "#4B2E83",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderBottomRightRadius: 4,
  },
  messageTextLeft: {
    color: "#111827",
    fontSize: 13,
  },
  messageTextRight: {
    color: "#FFFFFF",
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  input: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    marginRight: 8,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#4B2E83",
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    color: "#FFFFFF",
    fontSize: 16,
  },
});

