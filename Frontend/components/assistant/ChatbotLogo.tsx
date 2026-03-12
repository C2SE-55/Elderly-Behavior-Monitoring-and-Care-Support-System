import React from "react";
import Svg, { Path, G, Ellipse } from "react-native-svg";

const BLUE = "#2563EB";
const WHITE = "#FFFFFF";

type ChatbotLogoProps = {
  size?: number;
  color?: string;
};

/**
 * Logo chatbot: bong bóng chat + đầu robot (mắt miệng cười, tai nghe) — phong cách như ảnh mẫu.
 * Vẽ trong viewBox 0 0 48 48, scale theo prop size.
 */
const isLight = (c: string) => /^#([fF]{3}|[fF]{6})$/.test(c) || c.toLowerCase() === "white";

export default function ChatbotLogo({ size = 48, color = BLUE }: ChatbotLogoProps) {
  const strokeColor = isLight(color) ? "#5B3A9E" : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Bong bóng chat: hình bo tròn + đuôi tam giác trái dưới */}
      <Path
        fill={color}
        d="M24 4 C38 4 44 10 44 24 C44 38 38 44 24 44 C18 44 14 43 10 41 L10 44 L6 44 L8 40 C5 37 4 30 4 24 C4 10 10 4 24 4 Z"
      />
      {/* Mặt robot (hình chữ nhật bo tròn, trắng) */}
      <G transform="translate(12, 14)">
        <Path
          fill={WHITE}
          d="M4 2 L20 2 C22 2 24 4 24 6 L24 18 C24 20 22 22 20 22 L4 22 C2 22 0 20 0 18 L0 6 C0 4 2 2 4 2 Z"
        />
        {/* Mắt cười (hai nét cong hướng lên) */}
        <Path fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" d="M6 9 Q8 6 10 9" />
        <Path fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" d="M14 9 Q16 6 18 9" />
        {/* Miệng cười */}
        <Path fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" d="M8 15 Q12 19 16 15" />
      </G>
      {/* Tai nghe trái: vòng tròn + ăng-ten */}
      <Ellipse cx="12" cy="20" rx="4" ry="5" fill={color} />
      <Path stroke={color} strokeWidth="2" strokeLinecap="round" d="M12 15 L12 8" />
      {/* Tai nghe phải */}
      <Ellipse cx="36" cy="20" rx="4" ry="5" fill={color} />
      <Path stroke={color} strokeWidth="2" strokeLinecap="round" d="M36 15 L36 8" />
    </Svg>
  );
}
