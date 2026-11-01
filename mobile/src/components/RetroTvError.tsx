import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';
import { FONT_FAMILIES } from '../theme/typography';
import { withAlpha } from '../theme/colors';

export interface RetroTvErrorProps {
  /** Error code digits to display in background & on screen, e.g. "404", "500", "403" */
  errorCode?: string;
  /** Primary message displayed inside the CRT screen, defaults to "NOT FOUND" */
  errorMessage?: string;
  /** Subtitle / channel tag displayed on the CRT screen header (default: "CH 404") */
  channelTag?: string;
  /** Scale factor to resize the TV component cleanly (default: 1.0) */
  scale?: number;
  /** Whether to play vintage CRT scanline and flicker animations (default: true) */
  animated?: boolean;
  /** Optional custom accent color (defaults to theme primary: warm orange) */
  accentColor?: string;
  /** Optional container style override */
  style?: StyleProp<ViewStyle>;
}

/**
 * Retro TV illustration component with CRT scanline and flicker effects.
 */
export const RetroTvError: React.FC<RetroTvErrorProps> = ({
  errorCode = '404',
  errorMessage = 'NOT FOUND',
  channelTag,
  scale = 1.0,
  animated = true,
  accentColor,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const themeAccent = accentColor ?? colors.primary;

  // Animation values
  const flickerAnim = useRef(new Animated.Value(1)).current;
  const jitterAnim = useRef(new Animated.Value(0)).current;
  const scanlineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!animated) return;

    const flickerSequence = Animated.loop(
      Animated.sequence([
        Animated.timing(flickerAnim, {
          toValue: 0.88,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(flickerAnim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(flickerAnim, {
          toValue: 0.65,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(jitterAnim, {
          toValue: 1.2,
          duration: 40,
          useNativeDriver: true,
        }),
        Animated.timing(jitterAnim, {
          toValue: -1,
          duration: 40,
          useNativeDriver: true,
        }),
        Animated.timing(jitterAnim, {
          toValue: 0,
          duration: 40,
          useNativeDriver: true,
        }),
        Animated.timing(flickerAnim, {
          toValue: 0.95,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(flickerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    const scanlineLoop = Animated.loop(
      Animated.timing(scanlineAnim, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const ledPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    flickerSequence.start();
    scanlineLoop.start();
    ledPulse.start();

    return () => {
      flickerSequence.stop();
      scanlineLoop.stop();
      ledPulse.stop();
    };
  }, [animated, flickerAnim, jitterAnim, scanlineAnim, pulseAnim]);

  const digits = errorCode.split('');
  const displayedChannel = channelTag ?? `CH-${errorCode}`;

  // Chassis colors based on theme
  const cabinetBg = isDark ? '#24292E' : '#32383E';
  const cabinetBorder = isDark ? '#3D444C' : '#4E5761';
  const cabinetBezel = isDark ? '#16191D' : '#1C2025';
  const crtScreenBg = '#0B0E13';
  const knobBg = isDark ? '#333A42' : '#434B54';
  const knobHighlight = isDark ? '#4D5660' : '#5C6672';
  const legColor = isDark ? '#1C2024' : '#2A3036';
  const digitColor = isDark ? withAlpha('#FFFFFF', 0.08) : withAlpha(colors.text, 0.06);

  // Scanline translate interpolation
  const scanlineTranslateY = scanlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 120],
  });

  return (
    <View
      style={[
        styles.mainWrapper,
        {
          transform: [{ scale }],
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={`Retro TV displaying error ${errorCode}: ${errorMessage}`}
    >
      <View style={styles.text404} pointerEvents="none">
        {digits.map((digit, idx) => (
          <Text
            key={idx}
            style={[
              styles.digitText,
              {
                color: digitColor,
                marginHorizontal: idx === 1 ? 16 : 4,
              },
            ]}
          >
            {digit}
          </Text>
        ))}
      </View>

      <View style={styles.main}>
        <View style={styles.antennaContainer}>
          <View style={styles.antennaShadow} />

          <View style={[styles.antennaRod, styles.antennaLeft]}>
            <View style={[styles.antennaTip, { backgroundColor: isDark ? '#BAC2CB' : '#DDE3EA' }]} />
          </View>

          <View style={[styles.antennaRod, styles.antennaRight]}>
            <View style={[styles.antennaTip, { backgroundColor: isDark ? '#BAC2CB' : '#DDE3EA' }]} />
          </View>

          <View style={[styles.antennaBase, { backgroundColor: cabinetBorder }]}>
            <View style={[styles.antennaBaseInner, { backgroundColor: knobBg }]} />
          </View>
        </View>

        <View
          style={[
            styles.tvCabinet,
            {
              backgroundColor: cabinetBg,
              borderColor: cabinetBorder,
            },
          ]}
        >
          <View style={styles.topVents}>
            <View style={[styles.ventLine, { backgroundColor: cabinetBezel }]} />
            <View style={[styles.ventLine, { backgroundColor: cabinetBezel }]} />
            <View style={[styles.ventLine, { backgroundColor: cabinetBezel }]} />
          </View>

          <View style={styles.frontPanel}>
            <View style={[styles.displayDiv, { backgroundColor: cabinetBezel }]}>
              <View style={styles.screenOut}>
                <View style={[styles.screenInner, { backgroundColor: crtScreenBg }]}>
                  <View style={styles.scanlinesGrid} pointerEvents="none">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <View key={i} style={styles.scanlineRow} />
                    ))}
                  </View>

                  {animated && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.activeScanline,
                        {
                          transform: [{ translateY: scanlineTranslateY }],
                        },
                      ]}
                    />
                  )}

                  <View style={styles.cruve} pointerEvents="none">
                    <Svg
                      viewBox="0 0 189.929 189.929"
                      width={84}
                      height={84}
                      style={styles.curveSvg}
                    >
                      <Defs>
                        <LinearGradient id="crtGlare" x1="0%" y1="0%" x2="100%" y2="100%">
                          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
                          <Stop offset="65%" stopColor="#FFFFFF" stopOpacity="0.08" />
                          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                        </LinearGradient>
                      </Defs>
                      <Path
                        d="M70.343,70.343c-30.554,30.553-44.806,72.7-39.102,115.635l-29.738,3.951C-5.442,137.659,11.917,86.34,49.129,49.13C86.34,11.918,137.664-5.445,189.928,1.502l-3.95,29.738C143.041,25.54,100.895,39.789,70.343,70.343z"
                        fill="url(#crtGlare)"
                      />
                    </Svg>
                  </View>

                  <View style={styles.screenHeader}>
                    <Text style={[styles.channelTagText, { color: withAlpha(themeAccent, 0.75) }]}>
                      {displayedChannel}
                    </Text>
                    <View style={styles.staticSignalDots}>
                      <View style={[styles.signalDot, { backgroundColor: '#34D27B' }]} />
                      <View style={[styles.signalDot, { backgroundColor: withAlpha(themeAccent, 0.8) }]} />
                    </View>
                  </View>

                  <View style={styles.screenMessageContainer}>
                    <Animated.Text
                      style={[
                        styles.screenText,
                        styles.chromaticCyan,
                        {
                          opacity: Animated.multiply(flickerAnim, 0.6),
                          transform: [{ translateX: Animated.add(jitterAnim, 1.2) }],
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {errorMessage}
                    </Animated.Text>

                    <Animated.Text
                      style={[
                        styles.screenText,
                        {
                          color: themeAccent,
                          opacity: flickerAnim,
                          transform: [{ translateX: jitterAnim }],
                          textShadowColor: withAlpha(themeAccent, 0.65),
                          textShadowOffset: { width: 0, height: 0 },
                          textShadowRadius: 8,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {errorMessage}
                    </Animated.Text>
                  </View>

                  <View style={styles.screenFooter}>
                    <Text style={styles.screenFooterText}>SIGNAL LOST • AUTO TUNING</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.buttonsDiv}>
              <View style={[styles.knobOuter, { backgroundColor: knobBg, borderColor: knobHighlight }]}>
                <View style={[styles.knobInner, { backgroundColor: cabinetBezel }]}>
                  <View style={[styles.knobNotch, { backgroundColor: themeAccent }]} />
                </View>
              </View>

              <View style={[styles.knobOuterSmall, { backgroundColor: knobBg, borderColor: knobHighlight }]}>
                <View style={[styles.knobInnerSmall, { backgroundColor: cabinetBezel }]}>
                  <View style={[styles.knobDot, { backgroundColor: isDark ? '#8A94A0' : '#A2ACB8' }]} />
                </View>
              </View>

              <View style={styles.ledWrapper}>
                <Animated.View
                  style={[
                    styles.powerLed,
                    {
                      backgroundColor: themeAccent,
                      opacity: pulseAnim,
                      shadowColor: themeAccent,
                      shadowOpacity: 0.8,
                      shadowRadius: 6,
                    },
                  ]}
                />
              </View>

              <View style={styles.speakers}>
                <View style={[styles.speakerSlot, { backgroundColor: cabinetBezel }]} />
                <View style={[styles.speakerSlot, { backgroundColor: cabinetBezel }]} />
                <View style={[styles.speakerSlot, { backgroundColor: cabinetBezel }]} />
                <View style={[styles.speakerSlot, { backgroundColor: cabinetBezel }]} />
                <View style={[styles.speakerSlot, { backgroundColor: cabinetBezel }]} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.standContainer}>
          <View style={[styles.pegLeg, styles.pegLegLeft, { backgroundColor: legColor }]}>
            <View style={[styles.pegFoot, { backgroundColor: cabinetBorder }]} />
          </View>

          <View style={[styles.groundShadow, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.14)' }]} />

          <View style={[styles.pegLeg, styles.pegLegRight, { backgroundColor: legColor }]}>
            <View style={[styles.pegFoot, { backgroundColor: cabinetBorder }]} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 16,
    minHeight: 280,
  },

  text404: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    top: 36,
    zIndex: 0,
  },
  digitText: {
    fontFamily: FONT_FAMILIES.mono,
    fontSize: 110,
    lineHeight: 120,
    fontWeight: '900',
    letterSpacing: -2,
    includeFontPadding: false,
  },

  main: {
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },

  antennaContainer: {
    width: 140,
    height: 64,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    marginBottom: -4,
    zIndex: 3,
  },
  antennaShadow: {
    position: 'absolute',
    bottom: -2,
    width: 60,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  antennaRod: {
    position: 'absolute',
    bottom: 8,
    width: 3.5,
    borderRadius: 2,
    backgroundColor: '#9AA4AE',
    alignItems: 'center',
  },
  antennaLeft: {
    height: 58,
    left: 44,
    transform: [{ rotate: '-32deg' }, { translateY: -10 }],
    transformOrigin: 'bottom center',
  },
  antennaRight: {
    height: 68,
    right: 44,
    transform: [{ rotate: '32deg' }, { translateY: -12 }],
    transformOrigin: 'bottom center',
  },
  antennaTip: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    position: 'absolute',
    top: -5,
  },
  antennaBase: {
    width: 34,
    height: 12,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  antennaBaseInner: {
    width: 22,
    height: 6,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },

  tvCabinet: {
    width: 268,
    height: 184,
    borderRadius: 28,
    borderWidth: 3,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 2,
  },

  topVents: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  ventLine: {
    width: 26,
    height: 2.5,
    borderRadius: 1.5,
    opacity: 0.8,
  },

  frontPanel: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },

  displayDiv: {
    flex: 1,
    borderRadius: 18,
    padding: 6,
    justifyContent: 'center',
  },
  screenOut: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  screenInner: {
    flex: 1,
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
    padding: 8,
    justifyContent: 'space-between',
  },

  scanlinesGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    opacity: 0.18,
  },
  scanlineRow: {
    height: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  activeScanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  cruve: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 4,
  },
  curveSvg: {
    opacity: 0.9,
  },

  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 5,
  },
  channelTagText: {
    fontFamily: FONT_FAMILIES.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  staticSignalDots: {
    flexDirection: 'row',
    gap: 4,
  },
  signalDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  screenMessageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
    zIndex: 5,
  },
  screenText: {
    fontFamily: FONT_FAMILIES.mono,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  chromaticCyan: {
    position: 'absolute',
    color: '#00F0FF',
    textShadowColor: 'rgba(0, 240, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  screenFooter: {
    alignItems: 'center',
    zIndex: 5,
  },
  screenFooterText: {
    fontFamily: FONT_FAMILIES.mono,
    fontSize: 7.5,
    color: 'rgba(255, 255, 255, 0.35)',
    letterSpacing: 0.5,
  },

  buttonsDiv: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  knobOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    paddingTop: 2,
  },
  knobNotch: {
    width: 3,
    height: 6,
    borderRadius: 1.5,
  },
  knobOuterSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobInnerSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  ledWrapper: {
    paddingVertical: 2,
  },
  powerLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  speakers: {
    width: '100%',
    gap: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  speakerSlot: {
    width: 32,
    height: 2.5,
    borderRadius: 1.5,
    opacity: 0.9,
  },

  standContainer: {
    width: 240,
    height: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    position: 'relative',
    marginTop: -2,
    zIndex: 1,
  },
  pegLeg: {
    width: 14,
    height: 26,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pegLegLeft: {
    marginLeft: 32,
    transform: [{ rotate: '22deg' }],
  },
  pegLegRight: {
    marginRight: 32,
    transform: [{ rotate: '-22deg' }],
  },
  pegFoot: {
    width: 10,
    height: 5,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    opacity: 0.7,
  },
  groundShadow: {
    position: 'absolute',
    bottom: 2,
    left: 36,
    right: 36,
    height: 8,
    borderRadius: 12,
  },
});
