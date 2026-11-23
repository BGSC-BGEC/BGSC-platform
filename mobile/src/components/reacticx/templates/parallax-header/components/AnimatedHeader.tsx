import {
  Animated,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import React from "react";
import type { AnimatedHeaderProps } from "../types";

export const AnimatedHeader = ({
  HeaderComponent,
  headerImage,
  imageHeight,
  translateYUp,
  translateYDown,
  scale,
  pin,
  imageStyle,
  OverlayHeaderContent,
}: AnimatedHeaderProps) => {
  const pinned = pin !== 0;
  const { width } = useWindowDimensions();
  // Pinned: no fade on scroll-up (the sheet covers it instead); the pull-down fade stays.
  const opacity = translateYDown.interpolate({
    inputRange: [-imageHeight * 0.3, 0, imageHeight * 0.3],
    outputRange: [0, 1, pinned ? 1 : 0],
    extrapolate: "clamp",
  });

  const headerOpacity = pinned
    ? 1
    : translateYDown.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0],
        extrapolate: "clamp",
      });

  return (
    <View
      style={[
        styles.imgContainer,
        {
          marginTop: -imageHeight * 4,
          paddingTop: imageHeight * 4,
        },
      ]}
    >
      {HeaderComponent ? (
        <>
          {headerImage ? (
            // ImageBackground is deprecated: an Animated.View with an absolutely
            // positioned Image behind the children does the same job.
            <Animated.View
              style={[
                { height: imageHeight, width: width * 1.2 },
                {
                  transform: [
                    { scale: scale },
                    { translateY: translateYUp },
                    { translateY: translateYDown },
                  ],
                },
              ]}
            >
              <Image
                source={headerImage}
                style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }, imageStyle]}
              />
              {HeaderComponent}
            </Animated.View>
          ) : (
            <>
              <Animated.View
                style={[
                  { height: imageHeight, width },
                  {
                    transform: [
                      { translateY: pin },
                      { scale },
                      { translateY: translateYUp },
                      { translateY: translateYDown },
                    ],
                    opacity: headerOpacity,
                  },
                ]}
              >
                {HeaderComponent}

                {/*
                   <Animated.View
            style={[
              {
                position: "absolute",
                bottom: 0,

                width: "100%",
              },
            ]}
          >
            <Animated.View style={[{}]}>{OverlayHeaderContent}</Animated.View>
          </Animated.View> */}
              </Animated.View>

              <Animated.View
                style={[
                  {
                    position: "absolute",
                    bottom: 0,

                    width: "100%",
                    transform: [{ translateY: pin }],
                  },
                ]}
              >
                <Animated.View
                  style={[
                    {
                      opacity,
                    },
                  ]}
                >
                  {OverlayHeaderContent}
                </Animated.View>
              </Animated.View>
            </>
          )}
        </>
      ) : (
        <Animated.Image
          source={headerImage}
          style={[
            { height: imageHeight, width: width * 1.2 },
            {
              transform: [
                { scale },
                { translateY: translateYUp },
                { translateY: translateYDown },
              ],
            },
            imageStyle,
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  imgContainer: {
    alignItems: "center",
    overflow: "hidden",
  },
  overlayContainer: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    pointerEvents: "box-none", // allows scroll under overlay
  },
});
