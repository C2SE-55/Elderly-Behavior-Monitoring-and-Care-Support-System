import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { AxiosError } from "axios";
import dayjs from "dayjs";
import {
  createRoomNote,
  deleteRoomNote,
  getCurrentUser,
  getMyRoom,
  getRoomMessages,
  getRoomNotes,
  markRoomMessagesRead,
  RoomChatMessage,
  RoomNote,
  sendRoomMessage,
  setActiveRoomId,
  updateRoomNote,
} from "@/services/api";
import { connectRoomChatSocket, getRoomChatSocket } from "@/services/roomChatSocket";

const TYPING_IDLE_MS = 2200;

const fmt = (iso?: string | null) => {
  if (!iso) return "";
  const d = dayjs(iso);
  if (!d.isValid()) return "";
  return d.format("HH:mm DD/MM");
};

export default function RoomChatScreen() {
  const router = useRouter();
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
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [notePinned, setNotePinned] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [showComposer, setShowComposer] = useState(false);

  const beforeIdRef = useRef<number | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadInitial = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      setActiveRoomId(roomId);
      const [page, noteRows, roomInfo] = await Promise.all([
        getRoomMessages(roomId, { limit: 100 }),
        getRoomNotes(roomId),
        getMyRoom(),
      ]);
      setMessages(page.items || []);
      setHasMore(!!page.has_more);
      beforeIdRef.current = page.next_before_id;
      setNotes(noteRows);
      setRole(roomInfo?.member_role ?? null);
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

  const submitNote = async () => {
    if (!roomId || role !== "host") return;
    if (!noteContent.trim()) {
      Alert.alert("Thiếu nội dung", "Vui lòng nhập nội dung note.");
      return;
    }
    if (editingNoteId) {
      await updateRoomNote(roomId, editingNoteId, {
        title: noteTitle.trim(),
        content: noteContent.trim(),
        is_pinned: notePinned,
      });
    } else {
      await createRoomNote(roomId, {
        title: noteTitle.trim(),
        content: noteContent.trim(),
        is_pinned: notePinned,
      });
    }
    setEditingNoteId(null);
    setNoteTitle("");
    setNoteContent("");
    setNotePinned(false);
    setShowComposer(false);
    const rows = await getRoomNotes(roomId);
    setNotes(rows);
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
    router.replace("/(screens)/family-chat");
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
        <View style={[styles.bubble, mine ? styles.mine : styles.other]}>
          <Text style={[styles.messageText, mine && { color: "#FFFFFF" }]}>{item.content}</Text>
        </View>
        <Text style={styles.meta}>{fmt(item.created_at)}</Text>
        {!!seenText && <Text style={styles.seen}>Đã xem bởi: {seenText}</Text>}
      </View>
    );
  };

  const sortedNotes = useMemo(() => {
    const pinned = notes.filter((n) => n.is_pinned);
    const rest = notes.filter((n) => !n.is_pinned);
    return [...pinned, ...rest];
  }, [notes]);

  const notesPanel = (
    <View style={styles.notesStickyOuter}>
      <View style={styles.notesSection}>
        <View style={styles.notesHeader}>
          <TouchableOpacity style={styles.notesBackBtn} onPress={goBackToRoomList} accessibilityRole="button">
            <Feather name="chevron-left" size={22} color="#56328C" />
            <Text style={styles.notesBackText}>Danh sách phòng</Text>
          </TouchableOpacity>
          <Text style={styles.notesTitle}>Ghi chú</Text>
          {role === "host" ? (
            <TouchableOpacity style={styles.noteBtn} onPress={() => setShowComposer((v) => !v)}>
              <Text style={styles.noteBtnText}>{showComposer ? "Đóng" : "Tạo note"}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.notesHeaderSpacer} />
          )}
        </View>

        {showComposer && role === "host" && (
          <View style={styles.noteComposer}>
            <TextInput
              value={noteTitle}
              onChangeText={setNoteTitle}
              placeholder="Tiêu đề (tuỳ chọn)"
              style={styles.noteInput}
            />
            <TextInput
              value={noteContent}
              onChangeText={setNoteContent}
              placeholder="Nội dung note..."
              style={[styles.noteInput, { minHeight: 72 }]}
              multiline
            />
            <TouchableOpacity style={styles.pinBtn} onPress={() => setNotePinned((v) => !v)}>
              <Text style={styles.pinText}>{notePinned ? "Đang ghim đầu khung chat" : "Ghim lên đầu khung chat"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitNoteBtn} onPress={() => void submitNote()}>
              <Text style={styles.submitNoteText}>{editingNoteId ? "Cập nhật" : "Lưu"}</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          style={styles.notesScroll}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={sortedNotes.length > 2}
        >
          {sortedNotes.map((n) => (
            <View key={n.id} style={[styles.noteCard, n.is_pinned && styles.noteCardPinned]}>
              <View style={styles.noteCardTop}>
                <Text style={styles.noteTitleText}>{n.title || "Không tiêu đề"}</Text>
                {n.is_pinned && <Text style={styles.pinBadge}>GHIM</Text>}
              </View>
              <Text style={styles.noteContent}>{n.content}</Text>
              <Text style={styles.noteMeta}>
                {n.created_by_name} · {fmt(n.updated_at)}
              </Text>
              {role === "host" && (
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => onEditNote(n)}>
                    <Text style={styles.editText}>Sửa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDeleteNote(n)}>
                    <Text style={styles.deleteText}>Xóa</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.room}>{roomName}</Text>
          <Text style={styles.typing}>{typingText || " "}</Text>
        </View>

        {notesPanel}

        <FlatList
          style={styles.messageList}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
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

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Nhập tin nhắn..."
            value={draft}
            onChangeText={onDraftChange}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={() => void send()}>
            <Text style={styles.sendText}>Gửi</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  room: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  typing: { marginTop: 3, color: "#64748B", fontSize: 12, minHeight: 16 },
  notesStickyOuter: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  notesSection: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  notesScroll: { maxHeight: 220 },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 6,
  },
  notesBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "38%",
    paddingVertical: 4,
    paddingRight: 4,
  },
  notesBackText: { fontSize: 12, fontWeight: "700", color: "#56328C", marginLeft: -2 },
  notesTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: "#111827", textAlign: "center" },
  notesHeaderSpacer: { width: 88 },
  messageList: { flex: 1 },
  noteBtn: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    flexShrink: 0,
    minWidth: 88,
    alignItems: "center",
  },
  noteBtnText: { color: "#5B21B6", fontWeight: "700", fontSize: 12 },
  noteComposer: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 10, marginBottom: 10 },
  noteInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pinBtn: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#F1F5F9" },
  pinText: { color: "#334155", fontWeight: "600", fontSize: 12 },
  submitNoteBtn: { marginTop: 8, alignSelf: "flex-start", backgroundColor: "#4F46E5", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 },
  submitNoteText: { color: "#FFFFFF", fontWeight: "800" },
  noteCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  noteCardPinned: {
    backgroundColor: "#F5F3FF",
    borderColor: "#C4B5FD",
  },
  noteCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  noteTitleText: { fontWeight: "700", color: "#111827", flex: 1, marginRight: 8 },
  pinBadge: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", backgroundColor: "#8B5CF6", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  noteContent: { color: "#334155", marginTop: 6 },
  noteMeta: { marginTop: 6, color: "#64748B", fontSize: 11 },
  noteActions: { marginTop: 8, flexDirection: "row", gap: 12 },
  editText: { color: "#4F46E5", fontWeight: "700" },
  deleteText: { color: "#DC2626", fontWeight: "700" },
  messageWrap: { marginBottom: 10, maxWidth: "88%" },
  messageMineWrap: { alignSelf: "flex-end", alignItems: "flex-end" },
  messageOtherWrap: { alignSelf: "flex-start", alignItems: "flex-start" },
  sender: { fontSize: 11, color: "#64748B", marginBottom: 3 },
  bubble: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { backgroundColor: "#4F46E5" },
  other: { backgroundColor: "#E2E8F0" },
  messageText: { color: "#0F172A", fontSize: 14 },
  meta: { marginTop: 4, color: "#64748B", fontSize: 10 },
  seen: { marginTop: 2, color: "#0EA5E9", fontSize: 10 },
  empty: { marginTop: 16, textAlign: "center", color: "#64748B" },
  loadingMore: { textAlign: "center", color: "#64748B", fontSize: 12, marginVertical: 10 },
  composer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sendBtn: { height: 42, borderRadius: 10, paddingHorizontal: 16, backgroundColor: "#4F46E5", alignItems: "center", justifyContent: "center" },
  sendText: { color: "#FFFFFF", fontWeight: "800" },
});
