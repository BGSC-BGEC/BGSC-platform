import React from "react";
import { StyleSheet, Animated } from "react-native";
import { useAnimateNavbar } from "../hooks/useAnimatedNavBar";
import type { AnimatedNavbarProps } from "../types/index";

const AnimatedNavbar = ({
  scroll,
  imageHeight,
  OverflowHeaderComponent,
  TopNavbarComponent,
  headerHeight,
  headerElevation,
}: AnimatedNavbarProps) => {
  const [headerOpacity, overflowHeaderOpacity] = useAnimateNavbar(
    scroll,
    imageHeight,
    headerHeight,
  );

  return (
    <>
      {/* zIndex is static: the scroll value runs on the native driver, which
          cannot animate zIndex. box-none lets touches reach whatever is visible. */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.container,
          {
            zIndex: 2,
            height: headerHeight,
            opacity: headerOpacity,
            elevation: headerElevation,
          },
        ]}
      >
        {TopNavbarComponent}
      </Animated.View>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.container,
          styles.overflowHeader,
          {
            zIndex: 1,
            height: headerHeight,
            opacity: overflowHeaderOpacity,
          },
        ]}
      >
        {OverflowHeaderComponent}
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    width: "100%",
    backgroundColor: "transparent",
  },
  overflowHeader: {
    backgroundColor: "transparent",
  },
});

export default AnimatedNavbar;
