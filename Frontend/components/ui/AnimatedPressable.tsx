import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";

type AnimatedPressableProps = PressableProps & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export function AnimatedPressable({
  children,
  onPressIn,
  onPressOut,
  style,
  pressedScale = 0.97,
  ...rest
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number, duration: number) => {
    Animated.timing(scale, {
      toValue,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    animateTo(pressedScale, 90);
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    animateTo(1, 120);
    onPressOut?.(event);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable {...rest} onPressIn={handlePressIn} onPressOut={handlePressOut} style={style}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

type ScreenEnterProps = {
  children: React.ReactNode;
  duration?: number;
  fromY?: number;
  style?: StyleProp<ViewStyle>;
};

export function ScreenEnter({ children, duration = 320, fromY = 14, style }: ScreenEnterProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [duration, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

