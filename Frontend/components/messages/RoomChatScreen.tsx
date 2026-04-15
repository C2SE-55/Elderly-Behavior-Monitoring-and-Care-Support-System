import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { AxiosError } from "axios";
import dayjs from "dayjs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createRoomNote,
  deleteRoomNote,
  getCurrentUser,
  getMyRoom,
  getMyRooms,
  getRoomMessages,
  getRoomNotes,
  markRoomMessagesRead,
  RoomChatMessage,
  RoomNote,
  sendRoomMessage,
  updateRoomNote,
} from "@/services/api";
import { connectRoomChatSocket, getRoomChatSocket } from "@/services/roomChatSocket";

const TYPING_IDLE_MS = 2200;
const COLORS = {
  bg: "#F5F6FF",
  card: "rgba(255,255,255,0.92)",
  border: "rgba(148,163,184,0.22)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  primarySoft: "rgba(167,139,250,0.16)",
  primaryBorder: "rgba(167,139,250,0.30)",
};

const fmt = (iso?: string | null) => {
  if (!iso) return "";
  const d = dayjs(iso);
  if (!d.isValid()) return "";
  return d.format("HH:mm DD/MM");
};

type PinnedMessage = {
  id: number;
  sender_name: string;
  content: string;
  created_at: string | null;
};

const pinnedKeyFor = (roomId: number) => `ebms.roomchat.pinnedMessage.v1.${String(roomId || 0)}`;

export default function RoomChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ roomId?: string; roomName?: string }>();
  const roomId = Number(params.roomId || 0);
  const roomName = String(params.roomName || `Room #${roomId}`);
  const me = getCurrentUser();
  const myUserId = Number(me?.id || 0);
  const myName = String(me?.fullName || me?.username || "Thanh vien");

  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [notes, setNotes] = useState<RoomNote[]>([]);
  const [role, setRole] = useState<"host" | "caretaker" | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState("");
  const [typingText, setTypingText] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [notePinned, setNotePinned] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<PinnedMessage | null>(null);
  const [noteDetailVisible, setNoteDetailVisible] = useState(false);

  const beforeIdRef = useRef<number | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<RoomChatMessage> | null>(null);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subShow = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const subHide = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subShow = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const subHide = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!roomId) {
        setPinnedMessage(null);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(pinnedKeyFor(roomId));
        if (cancelled) return;
        if (!raw) {
          setPinnedMessage(null);
          return;
        }
        const v = JSON.parse(raw);
        if (!v || typeof v !== "object") {
          setPinnedMessage(null);
          return;
        }
        const id = Number((v as any).id || 0);
        if (!id) {
          setPinnedMessage(null);
          return;
        }
        setPinnedMessage({
          id,
          sender_name: String((v as any).sender_name || ""),
          content: String((v as any).content || ""),
          created_at: (v as any).created_at != null ? String((v as any).created_at) : null,
        });
      } catch {
        setPinnedMessage(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const loadInitial = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const [page, noteRows, roomInfo, roomList] = await Promise.all([
        getRoomMessages(roomId, { limit: 100 }),
        getRoomNotes(roomId),
        getMyRoom(),
        getMyRooms().catch(() => []),
      ]);
      setMessages(page.items || []);
      setHasMore(!!page.has_more);
      beforeIdRef.current = page.next_before_id;
      setNotes(noteRows);
      const byCurrentRoom = Array.isArray(roomList)
        ? roomList.find((r) => Number(r?.id || 0) === Number(roomId))?.member_role
        : null;
      const resolvedRole = String(byCurrentRoom || roomInfo?.member_role || "").toLowerCase();
      setRole((resolvedRole as any) || null);
      const latestId = Number(page.items?.[page.items.length - 1]?.id || 0);
      if (latestId > 0) {
        await markRoomMessagesRead(roomId, { read_until_id: latestId });
      }
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const loadOlder = useCallback(async () => {
    if (!roomId || !hasMore || loadingMore) return;
    const before = Number(beforeIdRef.current || 0);
    if (!before) return;
    setLoadingMore(true);
    try {
      const page = await getRoomMessages(roomId, { limit: 100, before_id: before });
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
  }, [hasMore, loadingMore, roomId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!messages.length) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  useEffect(() => {
    if (!roomId) return;
    const socket = connectRoomChatSocket();
    if (!socket) return;
    socket.emit("room:join", { roomId });

    const onNew = (payload: any) => {
      const msg = payload?.message as RoomChatMessage | undefined;
      if (!msg || Number(msg.room_id) !== roomId) return;
      setMessages((prev) => {
        if (prev.some((x) => x.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (Number(msg.sender_user_id) !== myUserId) {
        void markRoomMessagesRead(roomId, { message_ids: [msg.id] });
      }
    };

    const onTyping = (payload: any) => {
      if (Number(payload?.roomId || 0) !== roomId) return;
      if (!payload?.isTyping) {
        setTypingText("");
        return;
      }
      const userId = Number(payload?.userId || 0);
      if (userId === myUserId) return;
      const typingName = String(payload?.userName || "Ai đó").trim();
      setTypingText(`${typingName} đang gõ...`);
    };

    const onSeen = (payload: any) => {
      if (Number(payload?.roomId || 0) !== roomId) return;
      const messageId = Number(payload?.message_id || 0);
      const seenBy = Array.isArray(payload?.seen_by) ? payload.seen_by : [];
      if (!messageId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, seen_by: seenBy } : m))
      );
    };

    const onNoteCreated = (payload: any) => {
      if (Number(payload?.roomId || 0) !== roomId) return;
      const note = payload?.note as RoomNote;
      if (!note) return;
      setNotes((prev) => [note, ...prev.filter((x) => x.id !== note.id)]);
    };

    const onNoteUpdated = (payload: any) => {
      if (Number(payload?.roomId || 0) !== roomId) return;
      const note = payload?.note as RoomNote;
      if (!note) return;
      setNotes((prev) => prev.map((x) => (x.id === note.id ? note : x)));
    };

    const onNoteDeleted = (payload: any) => {
      if (Number(payload?.roomId || 0) !== roomId) return;
      const id = Number(payload?.note?.id || 0);
      if (!id) return;
      setNotes((prev) => prev.filter((x) => x.id !== id));
    };

    socket.on("message:new", onNew);
    socket.on("message:typing", onTyping);
    socket.on("message:seen", onSeen);
    socket.on("note:created", onNoteCreated);
    socket.on("note:updated", onNoteUpdated);
    socket.on("note:deleted", onNoteDeleted);

    return () => {
      const live = getRoomChatSocket();
      live?.off("message:new", onNew);
      live?.off("message:typing", onTyping);
      live?.off("message:seen", onSeen);
      live?.off("note:created", onNoteCreated);
      live?.off("note:updated", onNoteUpdated);
      live?.off("note:deleted", onNoteDeleted);
    };
  }, [roomId, myUserId]);

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      const socket = getRoomChatSocket();
      if (!socket || !roomId) return;
      socket.emit("message:typing", { roomId, isTyping, userName: myName });
    },
    [myName, roomId]
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
    if (!content || !roomId) return;
    setDraft("");
    emitTyping(false);
    await sendRoomMessage(roomId, content);
  };

  const roleKey = String(role || "").toLowerCase();
  const canEditNotes = roleKey === "host";

  const submitNote = async () => {
    if (!roomId || !canEditNotes) return;
    if (!noteContent.trim()) {
      Alert.alert("Thiếu nội dung", "Vui lòng nhập nội dung note.");
      return;
    }
    const payload = {
      title: noteTitle.trim(),
      content: noteContent.trim(),
      is_pinned: notePinned,
    };
    try {
      const latest = [...notes].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
      const targetId = editingNoteId || latest?.id || 0;
      if (targetId) {
        await updateRoomNote(roomId, targetId, payload);
      } else {
        await createRoomNote(roomId, payload);
      }

      setEditingNoteId(null);
      setNoteTitle("");
      setNoteContent("");
      setNotePinned(false);
      setShowComposer(false);
      const rows = await getRoomNotes(roomId);
      setNotes(rows);
    } catch (e) {
      const ax = e as AxiosError<{ message?: string }>;
      const status = Number(ax?.response?.status || 0);
      const msg =
        (typeof ax.response?.data === "object" && ax.response?.data?.message) ||
        (status === 403
          ? "Bạn chưa có quyền sửa ghi chú trong phòng này."
          : "Không lưu được ghi chú. Vui lòng thử lại.");
      showErr("Lỗi lưu ghi chú", String(msg));
    }
  };

  const onEditNote = (note: RoomNote) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title || "");
    setNoteContent(note.content || "");
    setNotePinned(!!note.is_pinned);
    setShowComposer(true);
  };

  const showErr = (title: string, msg: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(`${title}\n${msg}`);
      return;
    }
    Alert.alert(title, msg);
  };

  const runDeleteNote = async (note: RoomNote) => {
    const nid = Number(note.id);
    if (!roomId || !nid) return;
    try {
      await deleteRoomNote(roomId, nid);
      setNotes((prev) => prev.filter((x) => Number(x.id) !== nid));
    } catch (e) {
      const ax = e as AxiosError<{ message?: string }>;
      const msg =
        (typeof ax.response?.data === "object" && ax.response?.data?.message) ||
        ax.message ||
        "Không xóa được note. Bạn có phải Host của phòng không?";
      showErr("Lỗi xóa note", String(msg));
    }
  };

  const onDeleteNote = (note: RoomNote) => {
    const doDelete = () => void runDeleteNote(note);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Xóa note này?")) doDelete();
      return;
    }
    Alert.alert("Xóa note", "Bạn chắc chắn muốn xóa note này?", [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: doDelete },
    ]);
  };

  const goBackToRoomList = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(screens)/family-chat");
  };

  const pinMessage = async (msg: RoomChatMessage) => {
    if (!roomId) return;
    const next: PinnedMessage = {
      id: Number(msg.id),
      sender_name: String(msg.sender_name || ""),
      content: String(msg.content || ""),
      created_at: msg.created_at ? String(msg.created_at) : null,
    };
    setPinnedMessage(next);
    try {
      await AsyncStorage.setItem(pinnedKeyFor(roomId), JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const unpinMessage = async () => {
    if (!roomId) return;
    setPinnedMessage(null);
    try {
      await AsyncStorage.removeItem(pinnedKeyFor(roomId));
    } catch {
      // ignore
    }
  };

  const scrollToPinned = () => {
    if (!pinnedMessage) return;
    const idx = messages.findIndex((m) => Number(m.id) === Number(pinnedMessage.id));
    if (idx < 0) return;
    try {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.2 });
    } catch {
      // ignore
    }
  };

  const openMessageActions = (msg: RoomChatMessage) => {
    const isPinned = pinnedMessage?.id === Number(msg.id);
    Alert.alert("Tùy chọn tin nhắn", String(msg.content || "").slice(0, 120), [
      isPinned
        ? { text: "Bỏ ghim", style: "destructive", onPress: () => void unpinMessage() }
        : { text: "Ghim lên đầu", onPress: () => void pinMessage(msg) },
      { text: "Đóng", style: "cancel" },
    ]);
  };

  const renderMessage = ({ item }: { item: RoomChatMessage }) => {
    const mine = Number(item.sender_user_id) === myUserId;
    const seenText = mine
      ? (item.seen_by || [])
          .filter((x) => Number(x.user_id) !== myUserId)
          .map((x) => x.user_name)
          .join(", ")
      : "";
    return (
      <View style={[styles.messageWrap, mine ? styles.messageMineWrap : styles.messageOtherWrap]}>
        {!mine && <Text style={styles.sender}>{item.sender_name}</Text>}
        <TouchableOpacity activeOpacity={0.9} onLongPress={() => openMessageActions(item)}>
          <View style={[styles.bubble, mine ? styles.mine : styles.other]}>
            <Text style={[styles.messageText, mine && { color: "#FFFFFF" }]}>{item.content}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.meta}>{fmt(item.created_at)}</Text>
        {!!seenText && <Text style={styles.seen}>Đã xem bởi: {seenText}</Text>}
      </View>
    );
  };

  const latestNote = useMemo(() => {
    if (!notes.length) return null;
    const rows = [...notes].sort((a, b) => {
      const ta = Date.parse(a.updated_at || a.created_at || "");
      const tb = Date.parse(b.updated_at || b.created_at || "");
      return tb - ta;
    });
    return rows[0] || null;
  }, [notes]);

  useEffect(() => {
    setNoteDetailVisible(false);
  }, [latestNote?.id, latestNote?.updated_at]);

  const notesPanel = (
    <View style={styles.notesStickyOuter}>
      <View style={styles.notesSection}>
        <View style={styles.notesHeader}>
          <View style={styles.notesHeaderSide}>
            <TouchableOpacity style={styles.notesBackBtn} onPress={goBackToRoomList} accessibilityRole="button">
              <Feather name="chevron-left" size={22} color="#56328C" />
            </TouchableOpacity>
          </View>
          <Text style={styles.notesTitle}>Ghi chú</Text>
          <View style={styles.notesHeaderSide}>
            {canEditNotes ? (
              <TouchableOpacity
                style={styles.noteBtn}
                onPress={() => {
                  if (latestNote) {
                    onEditNote(latestNote);
                    return;
                  }
                  setEditingNoteId(null);
                  setNoteTitle("");
                  setNoteContent("");
                  setNotePinned(false);
                  setShowComposer((v) => !v);
                }}
              >
                <Text style={styles.noteBtnText}>{showComposer ? "Đóng" : latestNote ? "Sửa note" : "Tạo note"}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.notesHeaderSpacer} />
            )}
          </View>
        </View>

        {showComposer && canEditNotes && (
          <View style={styles.noteComposer}>
            <TextInput
              value={noteTitle}
              onChangeText={setNoteTitle}
              placeholder="Tiêu đề"
              placeholderTextColor="#111827"
              style={styles.noteInput}
            />
            <TextInput
              value={noteContent}
              onChangeText={setNoteContent}
              placeholder="Nội dung note..."
              placeholderTextColor="#111827"
              style={[styles.noteInput, styles.noteContentInput]}
              multiline
              scrollEnabled
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.submitNoteBtn} onPress={() => void submitNote()}>
              <Text style={styles.submitNoteText}>{editingNoteId ? "Cập nhật" : "Lưu"}</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          style={styles.notesScroll}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {latestNote ? (
            <View key={latestNote.id} style={[styles.noteCard, latestNote.is_pinned && styles.noteCardPinned]}>
              <View style={styles.noteCardTop}>
                <Text style={styles.noteTitleText}>{latestNote.title || "Ghi chú truyền đạt"}</Text>
                {latestNote.is_pinned && <Text style={styles.pinBadge}>GHIM</Text>}
              </View>
              {(() => {
                const raw = String(latestNote.content || "");
                const text = raw.trim();
                const lineCount = text ? text.split(/\r?\n/).length : 0;
                // Show "Xem chi tiết" when note likely over 3 visible lines
                // (explicit newlines or long content that can wrap).
                const longNote = lineCount > 3 || text.length > 80;
                return (
                  <>
                    <Text style={styles.noteContent} numberOfLines={3}>
                      {text}
                    </Text>
                    {longNote ? (
                      <TouchableOpacity onPress={() => setNoteDetailVisible(true)} activeOpacity={0.85}>
                        <Text style={styles.noteDetailText}>Xem chi tiết</Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                );
              })()}
              <Text style={styles.noteMeta}>
                Cập nhật lần gần nhất: {fmt(latestNote.updated_at)} · {latestNote.created_by_name}
              </Text>
              {canEditNotes && (
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => onEditNote(latestNote)}>
                    <Text style={styles.editText}>Sửa</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noteMeta}>Chưa có ghi chú truyền đạt cho người thân trong room này.</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.room} numberOfLines={1}>
                {roomName}
              </Text>
              <Text style={styles.typing} numberOfLines={1}>
                {typingText || " "}
              </Text>
            </View>
          </View>
        </View>

        {notesPanel}

        {!!pinnedMessage && (
          <TouchableOpacity style={styles.pinnedBar} activeOpacity={0.85} onPress={scrollToPinned} onLongPress={() => void unpinMessage()}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinnedTitle} numberOfLines={1}>
                Tin nhắn đã ghim
              </Text>
              <Text style={styles.pinnedContent} numberOfLines={1}>
                {pinnedMessage.sender_name ? `${pinnedMessage.sender_name}: ` : ""}
                {pinnedMessage.content}
              </Text>
            </View>
            <TouchableOpacity onPress={() => void unpinMessage()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Bỏ ghim">
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        <FlatList
          ref={(r) => {
            listRef.current = r;
          }}
          style={styles.messageList}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 12, paddingBottom: 18 }}
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
              <Text style={styles.empty}>Chưa có tin nhắn</Text>
            )
          }
        />

        <View style={[styles.composer, { paddingBottom: keyboardVisible ? 10 : Math.max(insets.bottom, 10) }]}>
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

        <Modal
          visible={noteDetailVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setNoteDetailVisible(false)}
        >
          <View style={styles.noteDetailBackdrop}>
            <View style={styles.noteDetailCard}>
              <View style={styles.noteDetailHeader}>
                <Text style={styles.noteDetailTitle}>{latestNote?.title || "Ghi chú truyền đạt"}</Text>
                <TouchableOpacity onPress={() => setNoteDetailVisible(false)} hitSlop={10}>
                  <Text style={styles.noteDetailClose}>Đóng</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.noteDetailScroll} showsVerticalScrollIndicator>
                <Text style={styles.noteDetailBody}>{latestNote?.content || ""}</Text>
              </ScrollView>
              <Text style={styles.noteMeta}>
                Cập nhật lần gần nhất: {latestNote ? fmt(latestNote.updated_at) : ""} ·{" "}
                {latestNote?.created_by_name || ""}
              </Text>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: 12,
    backgroundColor: COLORS.bg,
  },
  headerTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  room: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  typing: { marginTop: 3, color: COLORS.sub, fontSize: 12, minHeight: 16, fontWeight: "700" },
  notesStickyOuter: {
    backgroundColor: COLORS.bg,
    paddingBottom: 8,
  },
  notesSection: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 0 },
  notesScroll: { maxHeight: 220 },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 6,
  },
  notesHeaderSide: {
    width: 104,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  notesBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: 4,
  },
  notesBackText: { fontSize: 12, fontWeight: "900", color: COLORS.primary, marginLeft: -2 },
  notesTitle: { flex: 1, fontSize: 15, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  notesHeaderSpacer: { width: 88 },
  pinnedBar: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 0,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pinnedTitle: { fontSize: 11, fontWeight: "900", color: "#334155" },
  pinnedContent: { marginTop: 2, fontSize: 12, fontWeight: "800", color: COLORS.text },
  messageList: { flex: 1 },
  noteBtn: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexShrink: 0,
    minWidth: 88,
    alignItems: "center",
  },
  noteBtnText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  noteComposer: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 12, marginBottom: 10 },
  noteInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    color: COLORS.text,
    fontWeight: "700",
  },
  noteContentInput: {
    height: 96,
    maxHeight: 96,
  },
  pinBtn: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#F1F5F9" },
  pinText: { color: "#334155", fontWeight: "600", fontSize: 12 },
  submitNoteBtn: { marginTop: 8, alignSelf: "flex-start", backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  submitNoteText: { color: "#FFFFFF", fontWeight: "900" },
  noteCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
  },
  noteCardPinned: {
    backgroundColor: "rgba(167,139,250,0.14)",
    borderColor: "rgba(167,139,250,0.55)",
  },
  noteCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  noteTitleText: { fontWeight: "900", color: COLORS.text, flex: 1, marginRight: 8 },
  pinBadge: { fontSize: 10, fontWeight: "900", color: "#FFFFFF", backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  noteContent: { color: "#334155", marginTop: 6, fontWeight: "600" },
  noteDetailText: { marginTop: 6, color: COLORS.primary, fontSize: 12, fontWeight: "900" },
  noteMeta: { marginTop: 6, color: COLORS.sub, fontSize: 11, fontWeight: "700" },
  noteDetailBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
  },
  noteDetailCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 14,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noteDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  noteDetailTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: COLORS.text },
  noteDetailClose: { fontSize: 13, fontWeight: "900", color: COLORS.primary },
  noteDetailScroll: { maxHeight: 360 },
  noteDetailBody: { fontSize: 15, lineHeight: 22, color: "#111827" },
  noteActions: { marginTop: 8, flexDirection: "row", gap: 12 },
  editText: { color: "#4F46E5", fontWeight: "700" },
  deleteText: { color: "#DC2626", fontWeight: "700" },
  messageWrap: { marginBottom: 10, maxWidth: "88%" },
  messageMineWrap: { alignSelf: "flex-end", alignItems: "flex-end" },
  messageOtherWrap: { alignSelf: "flex-start", alignItems: "flex-start" },
  sender: { fontSize: 11, color: COLORS.sub, marginBottom: 3, fontWeight: "800" },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
  },
  mine: { backgroundColor: COLORS.primary, borderColor: "rgba(167,139,250,0.55)" },
  other: { backgroundColor: COLORS.card, borderColor: COLORS.border },
  messageText: { color: COLORS.text, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  meta: { marginTop: 4, color: "#64748B", fontSize: 10 },
  seen: { marginTop: 2, color: "#0EA5E9", fontSize: 10 },
  empty: { marginTop: 16, textAlign: "center", color: "#64748B" },
  loadingMore: { textAlign: "center", color: "#64748B", fontSize: 12, marginVertical: 10 },
  composer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: COLORS.text,
    fontWeight: "700",
  },
  sendBtn: { height: 42, width: 44, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sendText: { color: "#FFFFFF", fontWeight: "900" },
});
