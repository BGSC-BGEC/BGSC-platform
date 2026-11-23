// From reacticx (MIT): https://github.com/rit3zh/reacticx/tree/main/src/components/organisms/aura-lift
import React, { memo, useCallback, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  type ViewStyle,
  type LayoutChangeEvent,
  type ScaledSize,
} from "react-native";
import {
  Canvas,
  Fill,
  Shader,
  ImageShader,
  Skia,
  makeImageFromView,
  type SkImage,
} from "@shopify/react-native-skia";
import Animated, {
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
  useAnimatedStyle,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { IAuraLiftContext, IAuraLiftProvider } from "./types";
import { AuraLiftContext, useAuraLiftContext } from "./context";
import { AURA_LIFT_SHADER } from "./conf";

// null if the shader fails to compile on a device: the effect is then skipped, not a crash.
const SHADER_SOURCE = Skia.RuntimeEffect.Make(AURA_LIFT_SHADER);
if (!SHADER_SOURCE) console.warn("[AuraLift] shader failed to compile; effect disabled");

/**
 * Wraps content; `toggle()` (from useAuraLiftContext) snapshots it and plays a GPU
 * "lift" — a soft colour wash and blur sweeping up the view — then fades back out.
 * Idle otherwise: the Canvas only exists while the effect runs.
 */
export const AuraLiftGlobalContextProvider = memo(
  ({ children, duration = 2000, style }: IAuraLiftProvider) => {
    const viewRef = useRef<React.ComponentRef<typeof View>>(null);
    const [snapshot, setSnapshot] = useState<SkImage | null>(null);
    const [isActive, setIsActive] = useState<boolean>(false);
    const [layout, setLayout] = useState<Pick<ScaledSize, "width" | "height">>({
      width: 0,
      height: 0,
    });
    const overlayOpacity = useSharedValue(0);
    const progress = useSharedValue(0);

    const uniforms = useDerivedValue(() => ({
      iProgress: progress.value,
      iResolution: [layout.width, layout.height],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
      opacity: overlayOpacity.value,
    }));

    const hideOverlay = useCallback(() => {
      setIsActive(false);
      setSnapshot(null);
    }, []);

    const toggleAuraLift = useCallback(async () => {
      if (isActive || !SHADER_SOURCE) return;
      if (!viewRef.current) return;

      try {
        // Skia's ref type predates RN's element refs; the runtime object is the same.
        const image = await makeImageFromView(
          viewRef as unknown as Parameters<typeof makeImageFromView>[0],
        );
        if (!image) return;

        setSnapshot(image);
        setIsActive(true);
        progress.value = 0;
        overlayOpacity.value = 1;

        progress.value = withTiming(
          1,
          { duration, easing: Easing.linear },
          (finished) => {
            if (finished) {
              overlayOpacity.value = withTiming(0, { duration: 400 }, (fadeFinished) => {
                if (fadeFinished) scheduleOnRN(hideOverlay);
              });
            }
          },
        );
      } catch (err) {
        console.warn("[AuraLiftContextProvider] Failed to capture view:", err);
      }
    }, [isActive, duration, progress, overlayOpacity, hideOverlay]);

    const contextValue: IAuraLiftContext = {
      toggle: toggleAuraLift,
      isRunning: isActive,
    };

    return (
      <AuraLiftContext.Provider value={contextValue}>
        <View style={[styles.root, style]}>
          <View
            ref={viewRef}
            style={styles.container}
            collapsable={false}
            onLayout={(e: LayoutChangeEvent) => {
              const { width, height } = e.nativeEvent.layout;
              setLayout({ width, height });
            }}
          >
            {children}
          </View>

          {isActive && snapshot && SHADER_SOURCE && layout.width > 0 && (
            <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none">
              <Canvas style={{ width: layout.width, height: layout.height }}>
                <Fill>
                  <Shader source={SHADER_SOURCE} uniforms={uniforms}>
                    <ImageShader
                      image={snapshot}
                      fit="cover"
                      width={layout.width}
                      height={layout.height}
                    />
                  </Shader>
                </Fill>
              </Canvas>
            </Animated.View>
          )}
        </View>
      </AuraLiftContext.Provider>
    );
  },
);

export default AuraLiftGlobalContextProvider;
export { useAuraLiftContext };

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  container: {
    flexGrow: 1,
    flexBasis: "auto",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
});
