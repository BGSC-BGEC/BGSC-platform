import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Defs,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { DEFAULT_ASTRONAUT_IMAGE } from '../assets/astronaut';

export { DEFAULT_ASTRONAUT_IMAGE };

function WebCosmicStarfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    };
    window.addEventListener('resize', handleResize);

    interface Star {
      x: number;
      y: number;
      size: number;
      opacity: number;
      baseOpacity: number;
      twinkleSpeed: number;
      color: string;
      isSparkle?: boolean;
    }

    let stars: Star[] = [];
    const starColors = ['#ffffff', '#e0f2fe', '#fdf4ff', '#fbcfe8', '#bae6fd', '#fed7aa'];

    const initStars = () => {
      stars = [];
      const count = Math.floor((width * height) / 2800);
      for (let i = 0; i < count; i++) {
        const isSparkle = Math.random() < 0.1;
        const color = starColors[Math.floor(Math.random() * starColors.length)];
        const baseOpacity = isSparkle ? 0.6 + Math.random() * 0.4 : 0.2 + Math.random() * 0.7;
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: isSparkle ? Math.random() * 1.8 + 1.2 : Math.random() * 1.3 + 0.5,
          opacity: baseOpacity,
          baseOpacity,
          twinkleSpeed: 0.008 + Math.random() * 0.02,
          color,
          isSparkle,
        });
      }
    };
    initStars();

    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX - width / 2) * 0.03;
      targetMouseY = (e.clientY - height / 2) * 0.03;
    };
    window.addEventListener('mousemove', handleMouseMove);

    interface ShootingStar {
      x: number;
      y: number;
      length: number;
      speed: number;
      angle: number;
      opacity: number;
      life: number;
    }

    let shootingStars: ShootingStar[] = [];

    const maybeAddShootingStar = () => {
      if (Math.random() < 0.02 && shootingStars.length < 3) {
        shootingStars.push({
          x: Math.random() * width,
          y: Math.random() * (height * 0.55),
          length: Math.random() * 90 + 45,
          speed: Math.random() * 9 + 7,
          angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1),
          opacity: 1,
          life: 1,
        });
      }
    };

    let tick = 0;

    const render = () => {
      tick++;
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.opacity = star.baseOpacity + Math.sin(tick * star.twinkleSpeed + i) * 0.35;
        const boundedOpacity = Math.max(0.1, Math.min(1, star.opacity));

        const posX = star.x + currentMouseX * (star.size * 0.8);
        const posY = star.y + currentMouseY * (star.size * 0.8);

        ctx.fillStyle = star.color;
        ctx.globalAlpha = boundedOpacity;

        if (star.isSparkle) {
          const s = star.size * 2.2;
          ctx.beginPath();
          ctx.moveTo(posX, posY - s);
          ctx.lineTo(posX + s * 0.25, posY - s * 0.25);
          ctx.lineTo(posX + s, posY);
          ctx.lineTo(posX + s * 0.25, posY + s * 0.25);
          ctx.lineTo(posX, posY + s);
          ctx.lineTo(posX - s * 0.25, posY + s * 0.25);
          ctx.lineTo(posX - s, posY);
          ctx.lineTo(posX - s * 0.25, posY - s * 0.25);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.arc(posX, posY, star.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(posX, posY, star.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      maybeAddShootingStar();

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.life -= 0.015;

        if (ss.life <= 0 || ss.x > width + 100 || ss.y > height + 100) {
          shootingStars.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = `rgba(255, 255, 255, ${ss.life * 0.85})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(
          ss.x - Math.cos(ss.angle) * ss.length,
          ss.y - Math.sin(ss.angle) * ss.length
        );
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return React.createElement('canvas', {
    ref: canvasRef,
    style: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 0,
    },
  });
}

export function CosmicSpaceBackground({
  showAstronaut = true,
  astronautTop = 40,
  astronautRight = 10,
  astronautScale = 1,
}: {
  showAstronaut?: boolean;
  astronautTop?: number;
  astronautRight?: number;
  astronautScale?: number;
}) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -12,
          duration: 3500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim, pulseAnim]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#03060f' }]} />

      {Platform.OS === 'web' && <WebCosmicStarfield />}

      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="horizon-glow" cx="195" cy="844" rx="260" ry="240" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#f97316" stopOpacity="0.85" />
            <Stop offset="0.3" stopColor="#ea580c" stopOpacity="0.6" />
            <Stop offset="0.6" stopColor="#0891b2" stopOpacity="0.15" />
            <Stop offset="1" stopColor="#03060f" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="550" width="390" height="294" fill="url(#horizon-glow)" />
      </Svg>

      {showAstronaut && (
        <Animated.View
          style={[
            styles.astronautWrap,
            {
              top: astronautTop,
              right: astronautRight,
              transform: [{ translateY: floatAnim }, { scale: astronautScale }],
            },
          ]}
        >
          <Image source={{ uri: DEFAULT_ASTRONAUT_IMAGE }} style={styles.astronautImage} resizeMode="contain" />
          <Animated.View style={[styles.sparkleStar, { transform: [{ scale: pulseAnim }] }]}>
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="#ff4bb8">
              <Path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </Svg>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

export function GlassCard({
  children,
  style,
  borderRadius = 20,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  borderRadius?: number;
}) {
  return (
    <View style={[styles.glassBorder, { borderRadius }, style]}>
      <BlurView intensity={30} tint="dark" style={[styles.glassBlur, { borderRadius }]}>
        <View style={styles.glassTint}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  astronautWrap: {
    position: 'absolute',
    width: 130,
    height: 130,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  astronautImage: {
    width: 110,
    height: 110,
  },
  sparkleStar: {
    position: 'absolute',
    top: 24,
    right: 14,
  },
  glassBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  glassBlur: {
    overflow: 'hidden',
  },
  glassTint: {
    backgroundColor: 'rgba(10, 15, 28, 0.65)',
    padding: 16,
  },
});
