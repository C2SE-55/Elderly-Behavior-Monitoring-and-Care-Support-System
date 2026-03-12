import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatbotLogo from "./ChatbotLogo";
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

/** Chuẩn hóa danh sách phiên từ API — đảm bảo mỗi phiên có id và title hiển thị được */
function normalizeSessionList(
  sessions: ChatSessionSummary[] | null | undefined
): ChatSessionSummary[] {
  if (!Array.isArray(sessions)) return [];
  return sessions
    .map((s) => {
      const id = Number(s?.id) || 0;
      const rawTitle = s?.title;
      const title =
        typeof rawTitle === "string" && rawTitle.trim()
          ? rawTitle.trim()
          : id
            ? `Phiên #${id}`
            : "Phiên chat";
      return { ...s, id: id || (s?.id as number), title };
    })
    .filter((s) => s.id > 0);
}

const BOT_SIZE = 56;
const BOTTOM_SAFE_OFFSET = 100;

// Màu chủ đạo — giao diện hiện đại, dễ đọc
const COLORS = {
  primary: "#5B3A9E",
  primaryLight: "#7C5CBF",
  primarySoft: "#EDE9F7",
  surface: "#F8F7FC",
  card: "#FFFFFF",
  bubbleUser: "#5B3A9E",
  bubbleAssistant: "#FFFFFF",
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#E5E7EB",
  online: "#10B981",
  shadow: "rgba(91, 58, 158, 0.12)",
};

/** Phát hiện dòng là tiêu đề section (vd: "GIỮA CHIỀU (15 h)", "TỐI (17-18 h)") */
function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // Tiêu đề thường ngắn, có thể viết hoa hoặc có dạng (X h) / (X–Y h)
  return t.length < 55 && (/\(\d+[\s–-]*\d*\s*h\)/.test(t) || /^[A-ZÀ-Ỹ\s\d()–-]+$/.test(t));
}

/** Render nội dung tin nhắn — tách section để dễ đọc (meal plan, v.v.) */
function MessageContent({ content, style }: { content: string; style: { section: object; paragraph: object; text: object } }) {
  const lines = content.split(/\n/);
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isSectionHeader(line)) {
      const isFirst = nodes.length === 0;
      nodes.push(
        <Text key={`h-${i}`} style={[style.text, style.section, isFirst && { marginTop: 0 }]}>
          {line.trim()}
        </Text>
      );
      i++;
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && !isSectionHeader(lines[i])) {
      if (lines[i].trim()) paragraph.push(lines[i].trim());
      i++;
    }
    if (paragraph.length) {
      nodes.push(
        <Text key={`p-${i}`} style={[style.text, style.paragraph]}>
          {paragraph.join("\n")}
        </Text>
      );
    }
  }
  if (nodes.length === 0) return <Text style={style.text}>{content}</Text>;
  return <>{nodes}</>;
}

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Xin chào bạn 👋 Hôm nay bạn thế nào? Mình là trợ lý dinh dưỡng, có thể giúp bạn gợi ý thực đơn, khẩu phần ăn hay tư vấn sức khỏe.",
};

/** Gợi ý tin nhắn khi mới vào trang chatbot */
const MESSAGE_SUGGESTIONS = [
  { id: "1", label: "Gợi ý thực đơn", icon: "🍽️", prompt: "Gợi ý thực đơn dinh dưỡng cho tôi", color: "#5B3A9E" },
  { id: "2", label: "Nhắc uống thuốc", icon: "💊", prompt: "Nhắc tôi uống thuốc", color: "#059669" },
  { id: "3", label: "Tư vấn dinh dưỡng", icon: "❤️", prompt: "Tư vấn dinh dưỡng phù hợp sức khỏe", color: "#DC2626" },
  { id: "4", label: "Khẩu phần ăn", icon: "📋", prompt: "Gợi ý khẩu phần ăn trong ngày", color: "#D97706" },
];

const FloatingAssistant: React.FC = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [inputHeight, setInputHeight] = useState(44);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionList, setSessionList] = useState<ChatSessionSummary[]>([]);
  const [initializing, setInitializing] = useState(false);
  const [sessionIdToDelete, setSessionIdToDelete] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

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
    setInputHeight(44);
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
        setSessionList(normalizeSessionList(sessions));
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

  /** Gửi tin nhắn từ gợi ý (chips) */
  const sendMessage = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || loading || initializing) return;
      setInputHeight(44);
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: t,
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      try {
        const userId = resolveUserId();
        const res = await sendChatMessage(t, {
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
          setSessionList(normalizeSessionList(sessions));
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
    },
    [loading, initializing, sessionId, resolveUserId]
  );

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
      setSessionList(normalizeSessionList(sessions));
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

  const doDeleteSession = useCallback(
    async (sid: number) => {
      const userId = resolveUserId();
      setLoading(true);
      try {
        await deleteChatSession(sid, userId);
        const sessions = await getChatSessions(userId);
        setSessionList(normalizeSessionList(sessions));

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
    },
    [resolveUserId, sessionId]
  );

  const handleDeleteSession = useCallback(
    (sid: number) => {
      if (Platform.OS === "web") {
        const confirmed =
          typeof window !== "undefined"
            ? window.confirm("Bạn có chắc muốn xóa phiên chat này không?")
            : true;
        if (confirmed) void doDeleteSession(sid);
        return;
      }
      setSessionIdToDelete(sid);
    },
    [doDeleteSession]
  );

  useEffect(() => {
    if (chatOpen) {
      loadLatestSession();
    }
  }, [chatOpen, loadLatestSession]);

  return (
    <>
      {/* Nút trợ lý ảo trôi nổi — thiết kế mới */}
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
              <ChatbotLogo size={36} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </Animated.View>

      {chatOpen && (
        <View
          style={[
            styles.overlay,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom + 16,
              paddingLeft: Math.max(8, insets.left),
              paddingRight: Math.max(8, insets.right),
            },
          ]}
        >
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 50 : 0}
          >
            <View
              style={[
                styles.chatCard,
                {
                  width: Math.min(width * 0.8, 440),
                  height: Math.min((height - insets.top - insets.bottom) * 0.8, 760),
                },
              ]}
            >
              {/* Header hiện đại */}
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <View style={styles.avatarSmall}>
                    <ChatbotLogo size={28} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.chatTitle}>Bé Bụt</Text>
                    <View style={styles.chatStatusRow}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>Online</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={handleStartNewSession}
                    disabled={loading || initializing}
                  >
                    <Text style={styles.headerBtnText}>Phiên mới</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setChatOpen(false)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {sessionList.length > 0 && (
                <ScrollView
                  horizontal
                  style={styles.sessionListWrap}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sessionList}
                >
                  {sessionList.map((s) => {
                    const sid = Number(s.id) || 0;
                    const sessionTitle =
                      (typeof s.title === "string" && s.title.trim()) || `Phiên #${sid || "?"}`;
                    return (
                      <View
                        key={String(sid)}
                        style={[
                          styles.sessionChip,
                          sessionId === sid && styles.sessionChipActive,
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.sessionMainBtn}
                          onPress={() => handleSelectSession(sid)}
                          disabled={loading || initializing}
                        >
                          <Text
                            style={[
                              styles.sessionChipText,
                              sessionId === sid && styles.sessionChipTextActive,
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {sessionTitle || "Phiên chat"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.sessionDeleteBtn}
                          onPress={() => void handleDeleteSession(sid)}
                          disabled={loading || initializing}
                        >
                          <Text style={styles.sessionDeleteText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              <View style={styles.chatBodyWrap}>
                <ScrollView
                  ref={scrollRef}
                  style={styles.chatBody}
                  contentContainerStyle={styles.chatBodyContent}
                  onContentSizeChange={() =>
                    scrollRef.current?.scrollToEnd({ animated: true })
                  }
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {messages.map((msg) =>
                    msg.role === "assistant" ? (
                      <View key={msg.id} style={styles.messageRowLeft}>
                        <View style={styles.messageBubbleLeft}>
                          <MessageContent
                            content={msg.content}
                            style={{
                              section: styles.assistantSectionHeader,
                              paragraph: styles.assistantParagraph,
                              text: styles.messageTextLeft,
                            }}
                          />
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

                  {/* Gợi ý tin nhắn khi mới vào — chỉ hiện khi mới bắt đầu (chỉ có tin welcome) */}
                  {messages.length === 1 && !loading && !initializing && (
                    <View style={styles.suggestionsBlock}>
                      <Text style={styles.suggestionsTitle}>Bạn có thể hỏi nhanh:</Text>
                      <View style={styles.suggestionsGrid}>
                        {MESSAGE_SUGGESTIONS.map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            style={[styles.suggestionChip, { backgroundColor: s.color + "22" }]}
                            onPress={() => sendMessage(s.prompt)}
                            activeOpacity={0.8}
                            disabled={loading}
                          >
                            <Text style={styles.suggestionIcon}>{s.icon}</Text>
                            <Text style={[styles.suggestionLabel, { color: s.color }]} numberOfLines={2}>
                              {s.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {loading && (
                    <View style={styles.messageRowLeft}>
                      <View style={[styles.messageBubbleLeft, { flexDirection: "row", alignItems: "center" }]}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Đang trả lời...</Text>
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
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { height: inputHeight }]}
                  placeholder="Nhập tin nhắn..."
                  placeholderTextColor={COLORS.textMuted}
                  value={input}
                  onChangeText={setInput}
                  multiline
                  textAlignVertical="top"
                  onContentSizeChange={(e) => {
                    const next = Math.max(44, Math.min(110, e.nativeEvent.contentSize.height + 14));
                    setInputHeight(next);
                  }}
                  editable={!loading}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sendIcon}>➤</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Modal xác nhận xóa phiên chat — giao diện trong app, không dùng thông báo hệ thống */}
      <Modal
        visible={sessionIdToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSessionIdToDelete(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSessionIdToDelete(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Xóa phiên chat</Text>
            <Text style={styles.modalMessage}>
              Bạn có chắc muốn xóa phiên chat này không?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setSessionIdToDelete(null)}
              >
                <Text style={styles.modalBtnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnDelete}
                onPress={() => {
                  if (sessionIdToDelete !== null) {
                    doDeleteSession(sessionIdToDelete);
                    setSessionIdToDelete(null);
                  }
                }}
              >
                <Text style={styles.modalBtnDeleteText}>Xóa</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  botCircle: {
    width: BOT_SIZE,
    height: BOT_SIZE,
    borderRadius: BOT_SIZE / 2,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.primarySoft,
  },
  botInnerCircle: {
    width: BOT_SIZE - 12,
    height: BOT_SIZE - 12,
    borderRadius: (BOT_SIZE - 12) / 2,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  keyboardAvoid: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  chatCard: {
    width: "80%",
    height: "80%",
    maxWidth: 440,
    minWidth: 300,
    minHeight: 460,
    maxHeight: "90%",
    alignSelf: "center",
    marginHorizontal: 0,

    borderRadius: 28,
    backgroundColor: COLORS.card,

    overflow: "hidden",

    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10   },

    elevation: 6,
  },
  chatHeader: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  chatStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.online,
    marginRight: 6,
  },
  statusText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  chatBodyWrap: {
    flex: 1,
    minHeight: 0,
  },
  chatBody: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  sessionListWrap: {
    maxHeight: 68,
    backgroundColor: COLORS.card,
  },
  sessionList: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  sessionChip: {
    minWidth: 150,
    maxWidth: 220,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  sessionMainBtn: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  sessionDeleteBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.border,
  },
  sessionDeleteText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  sessionChipActive: {
    backgroundColor: COLORS.primarySoft,
  },
  sessionChipText: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  sessionChipTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  chatBodyContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  suggestionsBlock: {
    marginTop: 8,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  suggestionChip: {
    width: "48%",
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  suggestionIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  suggestionLabel: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  messageRowLeft: {
    alignItems: "flex-start",
    marginBottom: 12,
  },
  messageRowRight: {
    alignItems: "flex-end",
    marginBottom: 12,
  },
  messageBubbleLeft: {
    maxWidth: "88%",
    width: "88%",
    backgroundColor: COLORS.bubbleAssistant,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  messageBubbleRight: {
    maxWidth: "88%",
    width: "88%",
    backgroundColor: COLORS.bubbleUser,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  messageTextLeft: {
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 22,
  },
  messageTextRight: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
  },
  assistantSectionHeader: {
    fontWeight: "700",
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 10,
    marginBottom: 4,
  },
  assistantParagraph: {
    marginBottom: 6,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    marginRight: 10,
    color: COLORS.textPrimary,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  modalBtnCancel: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  modalBtnDelete: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#DC2626",
  },
  modalBtnDeleteText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

