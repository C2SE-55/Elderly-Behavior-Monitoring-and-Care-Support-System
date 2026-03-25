import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

type Payload = {
  heading?: string;
  title: string;
  description?: string | null;
};

export const useMealToast = () => {
  const anim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<Payload | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  const showMealToast = useCallback((nextPayload: Payload) => {
    setPayload(nextPayload);
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 5000);
  }, []);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [anim, visible]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const toast = (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-28, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{payload?.heading || "Đã tới giờ ăn!"}</Text>
        </View>
        {!!payload?.title && <Text style={styles.bodyTitle}>{payload.title}</Text>}
        {!!payload?.description && <Text style={styles.bodyText}>{payload.description}</Text>}
      </View>
    </Animated.View>
  );

  return { showMealToast, hideToast, toast };
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 8,
    left: 10,
    right: 10,
    zIndex: 40,
  },
  card: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 4,
  },
  title: { color: "#F8FAFC", fontSize: 14, fontWeight: "700" },
  bodyTitle: { color: "#E2E8F0", fontSize: 13, fontWeight: "700" },
  bodyText: { color: "#CBD5E1", fontSize: 12, marginTop: 2 },
});
