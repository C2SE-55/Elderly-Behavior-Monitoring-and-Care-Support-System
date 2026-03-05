import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Animated,
} from "react-native";

const { width, height } = Dimensions.get("window");

const BOT_SIZE = 53;
const BOTTOM_SAFE_OFFSET = 100; // để không đè lên thanh menu

const FloatingAssistant: React.FC = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");

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

              <TouchableOpacity onPress={() => setChatOpen(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Nội dung chat mẫu */}
            <View style={styles.chatBody}>
              <View style={styles.messageRowLeft}>
                <View style={styles.messageBubbleLeft}>
                  <Text style={styles.messageTextLeft}>
                    Xin chào, mình là trợ lý ảo. Mình có thể giúp gì cho bạn?
                  </Text>
                </View>
              </View>

              <View style={styles.messageRowRight}>
                <View style={styles.messageBubbleRight}>
                  <Text style={styles.messageTextRight}>
                    Mình muốn được hướng dẫn sử dụng ứng dụng.
                  </Text>
                </View>
              </View>
            </View>

            {/* Thanh nhập tin nhắn */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Nhập tin nhắn của bạn..."
                placeholderTextColor="#9CA3AF"
                value={input}
                onChangeText={setInput}
              />
              <TouchableOpacity style={styles.sendButton}>
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
  },
  chatBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#F3F4F6",
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

