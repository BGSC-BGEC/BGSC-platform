import React, { useMemo, useSyncExternalStore } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { Gesture, GestureDetector, type LegacyPanGesture, type PanGesture } from 'react-native-gesture-handler';

/*
 * The drawer opens on a rightward pan. A horizontal carousel scrolled back to its start (or
 * flicked right) produces exactly that pan, so the drawer took the swipe instead of the list.
 * The drawer hands its pan gesture to `configureDrawerGesture`; `DrawerSafeScrollView` wraps a
 * horizontal ScrollView in a native gesture that blocks that pan while a touch is on the list.
 */

let drawerPan: PanGesture | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => drawerPan;

/** Drawer `configureGestureHandler`: remembers the pan (it is rebuilt on open/close). */
export function configureDrawerGesture(gesture: PanGesture): PanGesture {
  if (gesture !== drawerPan) {
    drawerPan = gesture;
    // Called while the drawer renders: tell carousels after that render, not during it.
    queueMicrotask(() => listeners.forEach((l) => l()));
  }
  return gesture;
}

/** Horizontal ScrollView whose swipes never open the drawer. */
export function DrawerSafeScrollView(props: ScrollViewProps) {
  const pan = useSyncExternalStore(subscribe, snapshot);
  const gesture = useMemo(() => {
    const native = Gesture.Native();
    // The drawer types its pan with RNGH 3's `PanGesture`, but builds it with `Gesture.Pan()`.
    return pan ? native.blocksExternalGesture(pan as unknown as LegacyPanGesture) : native;
  }, [pan]);
  return (
    <GestureDetector gesture={gesture}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} {...props} />
    </GestureDetector>
  );
}
