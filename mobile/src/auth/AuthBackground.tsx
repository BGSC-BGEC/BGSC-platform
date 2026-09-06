import React from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  View,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AuthBackgroundProps {
  children: React.ReactNode;
  heroHeight?: number;
}

export function AuthBackground({
  children,
  heroHeight = SCREEN_HEIGHT * 0.38,
}: AuthBackgroundProps) {
  return (
    <View style={styles.container}>
      {/* Top Hero Pixel Art Image */}
      <View style={[styles.heroContainer, { height: heroHeight }]}>
        <Image
          source={require('../../assets/auth/cat.gif')}
          style={styles.heroImage}
          resizeMode="cover"
        />

        {/* Multi-stop smooth gradient fade to #FFF8F2 */}
        <View style={styles.gradientLayer4} />
        <View style={styles.gradientLayer3} />
        <View style={styles.gradientLayer2} />
        <View style={styles.gradientLayer1} />
      </View>

      {/* Foreground Content (Forms / Cards) */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F2',
  },
  heroContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  gradientLayer1: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 35,
    backgroundColor: '#FFF8F2',
    opacity: 0.95,
  },
  gradientLayer2: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
    height: 35,
    backgroundColor: '#FFF8F2',
    opacity: 0.70,
  },
  gradientLayer3: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    height: 35,
    backgroundColor: '#FFF8F2',
    opacity: 0.40,
  },
  gradientLayer4: {
    position: 'absolute',
    bottom: 75,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: '#FFF8F2',
    opacity: 0.15,
  },
  content: {
    flex: 1,
  },
});