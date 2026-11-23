import { useRef } from "react";
import { Animated } from "react-native";
import { HEADER_HEIGHT } from "../constants";

export const useAnimateScrollView = (
  imageHeight: number,
  disableScale?: boolean,
  onScrollOffset?: (y: number) => void,
  pinHeader?: boolean,
) => {
  const scroll = useRef(new Animated.Value(0)).current;
  // Latest callback in a ref: the Animated.event below is created once per render but
  // must always call the current one.
  const offsetListener = useRef(onScrollOffset);
  offsetListener.current = onScrollOffset;

  const scale = scroll.interpolate({
    inputRange: [-imageHeight, 0, imageHeight],
    outputRange: [2.5, 1, 1],
    extrapolate: "clamp",
  });

  // Pinned: no downward drift (the pin below holds the header still instead).
  const translateYDown = scroll.interpolate({
    inputRange: [-imageHeight, 0, imageHeight],
    outputRange: [-imageHeight * 0.6, 0, pinHeader ? 0 : imageHeight * 0.5],
    extrapolate: "clamp",
  });

  // Moves the header down exactly as far as the page has scrolled up, so it stays put on screen.
  const pin = scroll.interpolate({
    inputRange: [0, imageHeight],
    outputRange: [0, imageHeight],
    extrapolate: "clamp",
  });

  const translateYUp = scroll.interpolate({
    inputRange: [-imageHeight, 0, imageHeight],
    outputRange: [imageHeight * 0.3, 0, 0],
    extrapolate: "clamp",
  });

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scroll } } }],
    {
      useNativeDriver: true,
      listener: (e: { nativeEvent: { contentOffset: { y: number } } }) =>
        offsetListener.current?.(e.nativeEvent.contentOffset.y),
    }
  );

  return [
    scroll,
    onScroll,
    disableScale ? 1 : scale,
    translateYDown,
    translateYUp,
    pinHeader ? pin : 0,
  ] as const;
};
