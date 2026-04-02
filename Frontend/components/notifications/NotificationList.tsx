import React, { useRef } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import type { NotificationLogEntry } from "@/services/notificationLog";
import NotificationItem from "./NotificationItem";

export default function NotificationList({
  logs,
  onOpenDetail,
  onMarkRead,
  onDelete,
  onOptimisticRead,
}: {
  logs: NotificationLogEntry[];
  onOpenDetail: (it: NotificationLogEntry) => void;
  onOptimisticRead: (id: string) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const openSwipeIdRef = useRef<string | null>(null);

  const closeOpenSwipe = () => {
    const openId = openSwipeIdRef.current;
    if (!openId) return;
    swipeRefs.current.get(openId)?.close();
    openSwipeIdRef.current = null;
  };

  return (
    <FlatList
      data={logs}
      keyExtractor={(it) => it.id}
      contentContainerStyle={[styles.container, logs.length === 0 && { flex: 1, justifyContent: "center" }]}
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={closeOpenSwipe}
      onMomentumScrollBegin={closeOpenSwipe}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item: it }) => (
        <View style={styles.swipeRow}>
          <Swipeable
            ref={(ref) => {
              swipeRefs.current.set(it.id, ref);
            }}
            friction={1}
            rightThreshold={0}
            overshootRight={false}
            overshootFriction={12}
            useNativeAnimations
            animationOptions={{ duration: 80 }}
            onSwipeableWillOpen={() => {
              const openId = openSwipeIdRef.current;
              if (openId && openId !== it.id) {
                swipeRefs.current.get(openId)?.close();
              }
              openSwipeIdRef.current = it.id;
            }}
            onSwipeableWillClose={() => {
              if (openSwipeIdRef.current === it.id) openSwipeIdRef.current = null;
            }}
            renderRightActions={() => (
              <View style={styles.swipeActions}>
                <TouchableOpacity
                  style={[styles.swipeBtn, styles.swipeReadBtn, it.read && styles.swipeReadBtnDisabled]}
                  activeOpacity={0.9}
                  onPress={() => {
                    swipeRefs.current.get(it.id)?.close();
                    onMarkRead(it.id);
                  }}
                  disabled={it.read}
                >
                  <Text style={[styles.swipeBtnText, it.read && styles.swipeBtnTextDisabled]}>Đã đọc</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.swipeBtn, styles.swipeDeleteBtn]}
                  activeOpacity={0.9}
                  onPress={() => {
                    swipeRefs.current.get(it.id)?.close();
                    onDelete(it.id);
                  }}
                >
                  <Text style={[styles.swipeBtnText, styles.swipeDeleteText]}>Xóa</Text>
                </TouchableOpacity>
              </View>
            )}
          >
            <NotificationItem
              item={it}
              onPressIn={() => {
                if (!it.read) onOptimisticRead(it.id);
              }}
              onPress={() => {
                closeOpenSwipe();
                onOpenDetail(it);
              }}
            />
          </Swipeable>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.subtitle}>Chưa có thông báo.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 24 },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 30 },
  swipeRow: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFF",
  },
  swipeActions: {
    flexDirection: "row",
    alignItems: "stretch",
    height: "100%",
  },
  swipeBtn: {
    width: 86,
    justifyContent: "center",
    alignItems: "center",
  },
  swipeReadBtn: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRightWidth: 0,
  },
  swipeReadBtnDisabled: { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
  swipeDeleteBtn: { backgroundColor: "#EF4444" },
  swipeBtnText: { fontSize: 12, fontWeight: "900", color: "#1D4ED8" },
  swipeBtnTextDisabled: { color: "#9CA3AF" },
  swipeDeleteText: { color: "#FFFFFF" },
});

