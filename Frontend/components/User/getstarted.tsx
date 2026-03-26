import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    SafeAreaView,
    Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import Logo from "../../assets/images/Logo.png";

const { width } = Dimensions.get("window");
const scaleFont = (size: number) => size * (width / 375);

const WelcomeScreen = () => {
    const router = useRouter();
    return (
        <SafeAreaView style={styles.container}>
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
                onPress={() => router.navigate("/(tabs)")}
            >
                <Text style={styles.buttonText}>Bắt đầu</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F7F7FB",
        justifyContent: "space-between",
        paddingHorizontal: 24,
    },

    content: {
        alignItems: "center",
        marginTop: 60,
    },

    image: {
        width: 260,
        height: 260,
        marginBottom: 30,
    },

    title: {
        fontSize: scaleFont(12),
        letterSpacing: 2,
        color: "#6A5ACD",
        fontWeight: "700",
        marginBottom: 12,
    },

    mainText: {
        fontSize: scaleFont(18),
        textAlign: "center",
        fontWeight: "600",
        color: "#222",
        marginBottom: 10,
        lineHeight: 26,
    },

    subText: {
        fontSize: scaleFont(13),
        textAlign: "center",
        color: "#777",
        lineHeight: 20,
        paddingHorizontal: 10,
    },

    button: {
        backgroundColor: "#4B2E83",
        paddingVertical: 16,
        borderRadius: 10,
        marginBottom: 30,
    },

    buttonText: {
        color: "white",
        textAlign: "center",
        fontSize: scaleFont(15),
        fontWeight: "700",
    },
});