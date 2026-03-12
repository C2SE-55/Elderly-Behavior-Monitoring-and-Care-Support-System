import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from "react-native";

type NotificationItem = {
  id: string;
  type: "meal" | "assistant" | "reminder" | "health";
  title: string;
  body: string;
  time: string;
  read: boolean;
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "1",
    type: "meal",
    title: "Nhắc nhở dinh dưỡng",
    body: "Đã đến giờ ghi nhận bữa ăn hôm nay. Bạn hãy cập nhật thực đơn để theo dõi sức khỏe tốt hơn.",
    time: "09:00",
    read: false,
  },
  {
    id: "2",
    type: "assistant",
    title: "Thực đơn tuần mới",
    body: "Trợ lý ảo đã gợi ý thực đơn mới phù hợp với hồ sơ của bạn.",
    time: "Hôm qua",
    read: true,
  },
  {
    id: "3",
    type: "reminder",
    title: "Nhắc uống thuốc",
    body: "Đã đến giờ uống thuốc theo lịch đã đặt.",
    time: "08:30",
    read: false,
  },
];

const TYPE_LABELS: Record<NotificationItem["type"], string> = {
  meal: "Dinh dưỡng",
  assistant: "Trợ lý ảo",
  reminder: "Nhắc nhở",
  health: "Sức khỏe",
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<NotificationItem | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const list =
    filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  const handleDeleteNotification = (item: NotificationItem) => {
    setConfirmDeleteItem(item);
  };

  const handleDeleteAll = () => {
    if (notifications.length > 0) setConfirmDeleteAll(true);
  };

  const showConfirmModal = confirmDeleteItem !== null || confirmDeleteAll;
  const isDeleteAll = confirmDeleteAll;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      {/* Header: Giao diện thông báo trong app */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Thông báo</Text>
          <Text style={styles.headerSubtitle}>Trong ứng dụng</Text>
        </View>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleDeleteAll} style={styles.deleteAllBtn}>
            <Text style={styles.deleteAllText}>Xóa tất cả</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab: Tất cả / Chưa đọc */}
      {notifications.length > 0 && (
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, filter === "all" && styles.tabActive]}
            onPress={() => setFilter("all")}
          >
            <Text style={[styles.tabText, filter === "all" && styles.tabTextActive]}>
              Tất cả
            </Text>
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{notifications.length}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filter === "unread" && styles.tabActive]}
            onPress={() => setFilter("unread")}
          >
            <Text style={[styles.tabText, filter === "unread" && styles.tabTextActive]}>
              Chưa đọc
            </Text>
            {unreadCount > 0 && (
              <View style={[styles.tabBadge, styles.tabBadgeUnread]}>
                <Text style={styles.tabBadgeTextUnread}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={
          list.length === 0 ? styles.emptyContent : styles.listContent
        }
        showsVerticalScrollIndicator={false}
      >
        {list.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>
              {notifications.length === 0
                ? "Chưa có thông báo nào"
                : "Không có thông báo chưa đọc"}
            </Text>
            <Text style={styles.emptyDesc}>
              {notifications.length === 0
                ? "Các thông báo từ ứng dụng sẽ hiển thị tại đây."
                : "Khi có thông báo mới, bạn sẽ thấy ở đây."}
            </Text>
          </View>
        ) : (
          list.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, !item.read && styles.cardUnread]}
              activeOpacity={0.8}
              onPress={() => markAsRead(item.id)}
            >
              <View style={styles.cardLeft}>
                <View style={[styles.cardIcon, styles[`icon_${item.type}` as keyof typeof styles]]}>
                  <Text style={styles.cardIconText}>
                    {item.type === "meal" ? "🍽️" : item.type === "assistant" ? "🤖" : item.type === "reminder" ? "⏰" : "❤️"}
                  </Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardType}>{TYPE_LABELS[item.type]}</Text>
                    <Text style={styles.cardTime}>{item.time}</Text>
                  </View>
                  <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.body}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteNotification(item)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal xác nhận xóa — giao diện trong app */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setConfirmDeleteItem(null);
            setConfirmDeleteAll(false);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modalCard}
          >
            <Text style={styles.modalTitle}>
              {isDeleteAll ? "Xóa tất cả thông báo" : "Xóa thông báo"}
            </Text>
            <Text style={styles.modalMessage}>
              {isDeleteAll
                ? "Bạn có chắc muốn xóa toàn bộ thông báo trong ứng dụng không?"
                : "Bạn có chắc muốn xóa thông báo này không?"}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setConfirmDeleteItem(null);
                  setConfirmDeleteAll(false);
                }}
              >
                <Text style={styles.modalBtnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnDelete}
                onPress={() => {
                  if (isDeleteAll) {
                    setNotifications([]);
                    setConfirmDeleteAll(false);
                  } else if (confirmDeleteItem) {
                    setNotifications((prev) => prev.filter((n) => n.id !== confirmDeleteItem.id));
                    setConfirmDeleteItem(null);
                  }
                }}
              >
                <Text style={styles.modalBtnDeleteText}>
                  {isDeleteAll ? "Xóa tất cả" : "Xóa"}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7FB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  deleteAllBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deleteAllText: {
    fontSize: 14,
    color: "#5B3A9E",
    fontWeight: "600",
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  tabActive: {
    backgroundColor: "#EDE9F7",
  },
  tabText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#5B3A9E",
    fontWeight: "600",
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  tabBadgeUnread: {
    backgroundColor: "#5B3A9E",
  },
  tabBadgeText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  tabBadgeTextUnread: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyWrap: {
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: "#5B3A9E",
    backgroundColor: "#FAFAFF",
  },
  cardLeft: {
    flex: 1,
    flexDirection: "row",
    marginRight: 10,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  icon_meal: { backgroundColor: "#FEF3C7" },
  icon_assistant: { backgroundColor: "#EDE9F7" },
  icon_reminder: { backgroundColor: "#DBEAFE" },
  icon_health: { backgroundColor: "#FCE7F3" },
  cardIconText: {
    fontSize: 22,
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardType: {
    fontSize: 11,
    color: "#5B3A9E",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cardTime: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  cardTitleUnread: {
    color: "#1F2937",
    fontWeight: "700",
  },
  cardDesc: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "600",
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
    backgroundColor: "#FFFFFF",
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
    color: "#1F2937",
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 15,
    color: "#6B7280",
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
    backgroundColor: "#F3F4F6",
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
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
