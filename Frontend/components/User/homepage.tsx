import React, { useState } from "react";
import {
    SafeAreaView,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from "react-native";
import FloatingAssistant from "@/components/assistant/FloatingAssistant";

const { width } = Dimensions.get("window");

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const scale = clamp(width / 375, 0.95, 1.2);
const scaleFont = (size: number) => Math.round(size * scale);

type HomeOption = {
    id: string;
    title: string;
    emoji: string;
};

const OPTIONS: HomeOption[] = [
    { id: "family", title: "Kết nối với\nngười thân", emoji: "🧑‍🤝‍🧑" },
    { id: "personal-info", title: "Thông tin cá\nnhân", emoji: "🫃" },
    { id: "behavior", title: "Giám sát và phát\nhiện hành vi", emoji: "📷" },
    { id: "schedule", title: "Quản lý lịch sinh\nhoạt", emoji: "📅" },
    { id: "health", title: "Quản lý thông\ntin sức khỏe", emoji: "💼" },
];

const HomepageUserScreen = () => {
    const [selectedId, setSelectedId] = useState<string>("personal-info");

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTextWrapper}>
                    <Text style={styles.wave}>👋</Text>
                    <Text style={styles.greeting}>Xin chào A</Text>
                </View>

                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>A</Text>
                </View>
            </View>

            {/* List */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            >
                {OPTIONS.map((item) => {
                    const isSelected = item.id === selectedId;

                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.card, isSelected && styles.cardSelected]}
                            activeOpacity={0.85}
                            onPress={() => setSelectedId(item.id)}
                        >
                            <View style={styles.cardTextWrapper}>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                            </View>

                            <Text style={styles.cardEmoji}>{item.emoji}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <FloatingAssistant />
        </SafeAreaView>
    );
};

export default HomepageUserScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F7F7FB",
        paddingHorizontal: 20,
        paddingTop: 40,
    },

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },

    headerTextWrapper: {
        flexDirection: "row",
        alignItems: "center",
    },

    wave: {
        fontSize: scaleFont(24),
        marginRight: 8,
    },

    greeting: {
        fontSize: scaleFont(22),
        fontWeight: "800",
        color: "#4B2E83",
    },

    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#111827",
        alignItems: "center",
        justifyContent: "center",
    },

    avatarText: {
        color: "#FFF",
        fontSize: scaleFont(16),
        fontWeight: "700",
    },

    listContent: {
        paddingBottom: 100,
        gap: 16,
    },

    card: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",

        paddingVertical: 22,
        paddingHorizontal: 20,

        borderRadius: 16,

        backgroundColor: "#DDE3F0",

        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },

        elevation: 3,
    },

    cardSelected: {
        borderWidth: 2,
        borderColor: "#2563EB",
        backgroundColor: "#E8EDFF",
    },

    cardTextWrapper: {
        flex: 1,
        marginRight: 14,
    },

    cardTitle: {
        fontSize: scaleFont(18),
        fontWeight: "700",
        lineHeight: scaleFont(24),
        color: "#111827",
    },

    cardEmoji: {
        fontSize: scaleFont(36),
    },
});