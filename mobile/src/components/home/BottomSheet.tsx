import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { useColors } from '@/hooks/use-colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Sheet height. Defaults to 75% of screen height. */
  heightRatio?: number;
  children: ReactNode;
}

const SCREEN_H = Dimensions.get('window').height;

export function BottomSheet({ visible, onClose, heightRatio = 0.75, children }: Props) {
  const colors = useColors();
  const sheetH = SCREEN_H * heightRatio;
  const translateY = useRef(new Animated.Value(sheetH)).current;
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
    } else {
      Animated.timing(translateY, {
        toValue: sheetH,
        duration: 260,
        useNativeDriver: true,
      }).start(() => setModalVisible(false));
    }
  }, [visible, sheetH, translateY]);

  // Animate in once the modal mounts
  useEffect(() => {
    if (modalVisible) {
      translateY.setValue(sheetH);
      Animated.spring(translateY, {
        toValue: 0,
        tension: 90,
        friction: 14,
        useNativeDriver: true,
      }).start();
    }
  }, [modalVisible, sheetH, translateY]);

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          { height: sheetH, backgroundColor: colors.surface },
          { transform: [{ translateY }] },
        ]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
});
