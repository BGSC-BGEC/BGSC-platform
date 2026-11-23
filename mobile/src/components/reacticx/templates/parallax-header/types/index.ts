import { BlurTint } from "expo-blur";
import type {
  FlatListProps,
  ImageStyle,
  ScrollViewProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";
import { Animated, type ImageSourcePropType } from "react-native";
import type { JSX } from "react";

type AnimatedViewProps = {
  renderHeaderNavBarComponent?: () => JSX.Element;
  renderTopNavBarComponent?: () => JSX.Element;
  renderOveralComponent?: () => JSX.Element;

  OverlayHeaderContent?: React.ReactNode;
  /**
   * Rendered on top of the screen as a navbar when scrolling to the top
   */
  TopNavBarComponent?: JSX.Element;

  /**
   * A component to use on top of header image. It can also be used
   * without header image to render a custom component as header.
   */
  HeaderComponent?: JSX.Element;

  /**
   *
   * @returns A component to use on top of header image. It can also be used
   * @function renderHeaderComponent
   * without header image to render a custom component as header.
   */

  renderHeaderComponent?: () => JSX.Element;

  /**
   * Rendered on top of the header. Transitions to TopNavbarComponent as you scroll
   */
  HeaderNavbarComponent?: JSX.Element;

  /**
   * Height of the header (headerImage or HeaderComponent). Default value is 300
   */
  headerMaxHeight?: number;

  /**
   * Height of the top navbar. Default value is 90
   */
  topBarHeight?: number;

  /**
   * [ANDROID ONLY] Elevation of the top navbar. Default value is 0
   */
  topBarElevation?: number;

  /**
   * @see https://reactnative.dev/docs/image#source
   */
  headerImage?: ImageSourcePropType;

  /**
   * Disables header scaling when scrolling
   */
  disableScale?: boolean;

  /**
   * Keep the header (and its overlay content) still while scrolling up: the content below slides
   * over it like a sheet, with no parallax drift or fade. Pull-down stretch still works.
   */
  pinHeader?: boolean;

  /**
   * Called on the JS thread with the vertical scroll offset. Use this instead of
   * `onScroll`, which would replace the parallax scroll handler.
   */
  onScrollOffset?: (y: number) => void;

  /**
   * Image styles
   */
  imageStyle?: StyleProp<ImageStyle>;
};

export type AnimatedScrollViewProps = AnimatedViewProps & ScrollViewProps;

export type AnimatedFlatListViewProps = AnimatedViewProps;

export type AnimatedNavbarProps = {
  scroll: Animated.Value;
  OverflowHeaderComponent?: JSX.Element;
  TopNavbarComponent?: JSX.Element;
  imageHeight: number;
  headerHeight: number;
  headerElevation: number;
};

export type AnimatedHeaderProps = {
  imageHeight: number;
  OverlayHeaderContent?: React.ReactNode;
  translateYUp: Animated.AnimatedInterpolation<string | number> | 0;
  translateYDown: Animated.AnimatedInterpolation<string | number> | 0 | any;
  scale: Animated.AnimatedInterpolation<string | number> | 1;
  /** Counter-scroll offset that holds the header still (pinHeader); 0 when not pinned. */
  pin: Animated.AnimatedInterpolation<string | number> | 0;

  imageStyle?: StyleProp<ImageStyle>;
  HeaderComponent?: JSX.Element;
  headerImage?: ImageSourcePropType;
};

export interface AnimatedScrollViewTitleProps {
  children: React.ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
}

export interface HeaderComponentWrapperProps extends ViewStyle {
  children: React.ReactNode;
  useGradient?: boolean;
  gradientColors?: string[];
  gradientHeight?: number;
}

export interface HeaderNavBarProps extends ViewStyle {
  children: React.ReactNode;
  headerHeight?: number | 100;
  intensity?: number | 50;
  tint?: BlurTint;
}
