import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    SafeAreaView,
    Dimensions,
    Platform,
} from "react-native";
import { useRouter } from "expo-router";
import Logo from "../../assets/images/Logo.png";

const { width } = Dimensions.get("window");
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const scale = clamp(width / 375, 0.92, 1.15);
const scaleFont = (size: number) => Math.round(size * scale);

const WelcomeScreen = () => {
    const router = useRouter();
    return (
        <SafeAreaView style={styles.container}>
            {/* Decorative blobs */}
            <View pointerEvents="none" style={[styles.blob, styles.blobTop]} />
            <View pointerEvents="none" style={[styles.blob, styles.blobBottom]} />

            <View style={styles.stage}>
                <View style={styles.content}>

                    <Image
                        source={Logo}
                        style={styles.image}
                        resizeMode="contain"
                    />

                    <Text style={styles.title}>WELCOME</Text>

                    <Text style={styles.mainText}>
                        Chăm sóc người cao tuổi trở nên đơn giản và luôn trong tầm tay bạn!
                    </Text>

                    <Text style={styles.subText}>
                        Theo dõi từ xa qua camera, phát hiện kịp thời các dấu hiệu bất thường,
                        gửi cảnh báo ngay khi cần và hỗ trợ chăm sóc hiệu quả. Thật dễ dàng!
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.button}
                    activeOpacity={0.9}
                    onPress={() => router.navigate("/(auths)/welcome")}
                >
                    <Text style={styles.buttonText}>Bắt đầu</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F7F7FB",
        paddingHorizontal: 24,
    },

    stage: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 12,
    },

    content: {
        width: "100%",
        maxWidth: 520,
        alignItems: "center",
        paddingHorizontal: 4,
    },

    image: {
        width: clamp(width * 0.7, 220, 290),
        height: clamp(width * 0.7, 220, 290),
        marginBottom: 18,
    },

    title: {
        fontSize: scaleFont(12),
        letterSpacing: 2.4,
        color: "#6D28D9",
        fontWeight: "800",
        marginBottom: 10,
    },

    mainText: {
        fontSize: scaleFont(18),
        textAlign: "center",
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 10,
        lineHeight: scaleFont(26),
    },

    subText: {
        fontSize: scaleFont(13),
        textAlign: "center",
        color: "#475569",
        lineHeight: scaleFont(20),
        paddingHorizontal: 14,
    },

    button: {
        backgroundColor: "#4B2E83",
        width: "100%",
        maxWidth: 360,
        alignSelf: "center",
        paddingVertical: 16,
        borderRadius: 14,
        marginTop: 22,
        shadowColor: "#4B2E83",
        shadowOpacity: 0.24,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
    },

    buttonText: {
        color: "white",
        textAlign: "center",
        fontSize: scaleFont(15),
        fontWeight: "800",
    },

    blob: {
        position: "absolute",
        width: 260,
        height: 260,
        borderRadius: 260,
        backgroundColor: "#DDD6FE",
        opacity: 0.55,
    },
    blobTop: {
        top: -120,
        left: -110,
        backgroundColor: "#EDE9FE",
        ...Platform.select({
            ios: { shadowColor: "#A78BFA", shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
            android: { elevation: 1 },
            default: {},
        }),
    },
    blobBottom: {
        bottom: -130,
        right: -120,
        backgroundColor: "#DBEAFE",
        ...Platform.select({
            ios: { shadowColor: "#60A5FA", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
            android: { elevation: 1 },
            default: {},
        }),
    },
});