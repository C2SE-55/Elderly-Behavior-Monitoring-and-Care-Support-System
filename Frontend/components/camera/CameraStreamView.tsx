import React from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

const WebView =
  Platform.OS === "web"
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports -- WebView không dùng trên web
      require("react-native-webview").WebView;

const DEMO_SOURCES: Record<string, number> = {
  video3: require("../../assets/videos/video3.mp4"),
  videofall: require("../../assets/videos/videofall.mp4"),
};

function buildStreamHtml(streamUrl: string, fit: "cover" | "contain") {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
      img { width: 100%; height: 100%; object-fit: ${fit}; display: block; background: #000; }
    </style>
  </head>
  <body>
    <img src="${streamUrl}" alt="Camera Live" />
  </body>
</html>`;
}

type Props = {
  style: object;
  fit: "cover" | "contain";
  /** Khóa từ API: video3 | videofall */
  assetKey: string | null;
  mjpegUrl: string;
};

export default function CameraStreamView({ style, fit, assetKey, mjpegUrl }: Props) {
  const bundled = assetKey && DEMO_SOURCES[assetKey] ? DEMO_SOURCES[assetKey] : null;

  if (bundled) {
    return (
      <Video
        source={bundled}
        style={style}
        resizeMode={fit === "cover" ? ResizeMode.COVER : ResizeMode.CONTAIN}
        shouldPlay
        isLooping
        isMuted
      />
    );
  }

  if (Platform.OS === "web") {
    return <Image source={{ uri: mjpegUrl }} style={style as any} resizeMode={fit} />;
  }

  if (!WebView) {
    return (
      <View style={[style as any, styles.placeholder]}>
        <Ionicons name="videocam-outline" size={48} color="#999" />
        <Text style={styles.placeholderText}>Không hỗ trợ WebView</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ html: buildStreamHtml(mjpegUrl, fit) }}
      style={style as any}
      scrollEnabled={false}
      originWhitelist={["*"]}
      mixedContentMode="compatibility"
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: "#666",
  },
});
