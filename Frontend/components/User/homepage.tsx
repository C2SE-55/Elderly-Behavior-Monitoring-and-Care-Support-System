import React from "react";
import {
    SafeAreaView,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import FloatingAssistant from "@/components/assistant/FloatingAssistant";
import { getCurrentUser, logoutUser } from "../../services/api";

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
    { id: "medicine-reminder", title: "Nhắc nhở uống\nthuốc", emoji: "💊" },
    { id: "family", title: "Kết nối với\nngười thân", emoji: "🧑‍🤝‍🧑" },
    { id: "personal-info", title: "Thông tin cá\nnhân", emoji: "🫃" },
    { id: "behavior", title: "Giám sát và phát\nhiện hành vi", emoji: "📷" },
    { id: "schedule", title: "Quản lý lịch sinh\nhoạt", emoji: "📅" },
    { id: "health", title: "Quản lý thông\ntin sức khỏe", emoji: "💼" },
];

const HomepageUserScreen = () => {
    const router = useRouter();
    const user = getCurrentUser();

    const displayName =
        user?.fullName || user?.username || "A";
    const avatarLetter = (displayName || "A").charAt(0).toUpperCase();

    const handleLogout = () => {
        logoutUser();
        router.replace("/(auths)/login");
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTextWrapper}>
                    <Text style={styles.wave}>👋</Text>
                    <Text style={styles.greeting}>Xin chào {displayName}</Text>
                </View>

                <View style={styles.headerActions}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{avatarLetter}</Text>
                    </View>
                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                        <Text style={styles.logoutText}>Đăng xuất</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* List */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            >
                {OPTIONS.map((item) => {
                    const handlePress = () => {
                        if (item.id === "medicine-reminder") {
                            router.push("/(tabs)/medicine-reminder");
                        } else if (item.id === "personal-info") {
                            router.push("/(profiles)/profile");
                        } else if (item.id === "health") {
                            router.push("/(healths)/health");
                        } else if (item.id === "behavior") {
                            router.push("/(cameras)/camera");
                        } else if (item.id === "schedule") {
                            router.push("/(tabs)/weekly-schedule");
                        } else if (item.id === "family") {
                            router.push("/(tabs)/room-access");
                        }
                    };

                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.card}
                            activeOpacity={0.85}
                            onPress={handlePress}
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
        paddingHorizontal: 24,
        paddingTop: 60,
    },

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 6, 
        marginBottom: 24,
    },

    headerTextWrapper: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: 12,
    },

    wave: {
        fontSize: scaleFont(24),
        marginRight: 8,
    },

    greeting: {
        fontSize: scaleFont(22),
        fontWeight: "800",
        color: "#4B2E83",
        letterSpacing: 0.5,
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
    headerActions: {
        alignItems: "center",
        gap: 6,
    },
    logoutBtn: {
        backgroundColor: "#FEE2E2",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    logoutText: {
        color: "#991B1B",
        fontSize: scaleFont(12),
        fontWeight: "700",
    },

    listContent: {
        paddingBottom: 100,
        gap: 16,
        alignItems: "center",
    },

    card: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",

        width: "80%",
        maxWidth: 300,

        paddingVertical: 20,
        paddingHorizontal: 18,

        borderRadius: 16,

        backgroundColor: "#DDE3F0",

        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },

        elevation: 3,
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