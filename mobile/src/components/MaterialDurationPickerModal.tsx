import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';

interface MaterialDurationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (hours: number, minutes: number) => void;
  initialHours?: number; // 0 - 23
  initialMinutes?: number; // 0 - 59
}

const ITEM_HEIGHT = 46;
const VISIBLE_ITEMS = 3;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 138

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export default function MaterialDurationPickerModal({
  visible,
  onClose,
  onConfirm,
  initialHours = 0,
  initialMinutes = 5,
}: MaterialDurationPickerModalProps) {
  const [selectedHours, setSelectedHours] = useState(initialHours);
  const [selectedMinutes, setSelectedMinutes] = useState(initialMinutes);

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      const h = Math.min(23, Math.max(0, initialHours));
      const m = Math.min(59, Math.max(0, initialMinutes));
      setSelectedHours(h);
      setSelectedMinutes(m);

      // Scroll to initial values smoothly
      setTimeout(() => {
        hourScrollRef.current?.scrollTo({ y: h * ITEM_HEIGHT, animated: false });
        minuteScrollRef.current?.scrollTo({ y: m * ITEM_HEIGHT, animated: false });
      }, 50);
    }
  }, [visible, initialHours, initialMinutes]);

  const handleHourScrollEnd = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.min(23, Math.max(0, index));
    setSelectedHours(clamped);
  };

  const handleMinuteScrollEnd = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.min(59, Math.max(0, index));
    setSelectedMinutes(clamped);
  };

  const handleConfirm = () => {
    onConfirm(selectedHours, selectedMinutes);
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.dialogContainer} onPress={(e) => e.stopPropagation()}>
          {/* ─── Two-Column Spinner: Hours : Minutes (media_1795478633764_6af877ff.jpg) ─── */}
          <View style={styles.spinnerWrapper}>
            {/* Horizontal selection divider lines with gap over the colon */}
            <View style={[styles.columnLine, { top: ITEM_HEIGHT, left: 18 }]} pointerEvents="none" />
            <View style={[styles.columnLine, { top: ITEM_HEIGHT * 2, left: 18 }]} pointerEvents="none" />

            <View style={[styles.columnLine, { top: ITEM_HEIGHT, right: 18 }]} pointerEvents="none" />
            <View style={[styles.columnLine, { top: ITEM_HEIGHT * 2, right: 18 }]} pointerEvents="none" />

            {/* Left Column: Hours */}
            <View style={styles.columnContainer}>
              <ScrollView
                ref={hourScrollRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
                onMomentumScrollEnd={handleHourScrollEnd}
                onScrollEndDrag={handleHourScrollEnd}
              >
                {HOURS.map((h) => {
                  const isSelected = h === selectedHours;
                  return (
                    <TouchableOpacity
                      key={`hour_${h}`}
                      style={styles.itemSlot}
                      onPress={() => {
                        setSelectedHours(h);
                        hourScrollRef.current?.scrollTo({ y: h * ITEM_HEIGHT, animated: true });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.numberText, isSelected && styles.numberTextSelected]}>
                        {h.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Middle Colon */}
            <View style={styles.colonContainer} pointerEvents="none">
              <Text style={styles.colonText}>:</Text>
            </View>

            {/* Right Column: Minutes */}
            <View style={styles.columnContainer}>
              <ScrollView
                ref={minuteScrollRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
                onMomentumScrollEnd={handleMinuteScrollEnd}
                onScrollEndDrag={handleMinuteScrollEnd}
              >
                {MINUTES.map((m) => {
                  const isSelected = m === selectedMinutes;
                  return (
                    <TouchableOpacity
                      key={`min_${m}`}
                      style={styles.itemSlot}
                      onPress={() => {
                        setSelectedMinutes(m);
                        minuteScrollRef.current?.scrollTo({ y: m * ITEM_HEIGHT, animated: true });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.numberText, isSelected && styles.numberTextSelected]}>
                        {m.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* ─── Bottom Actions Row: CANCEL / OK (media_1795478633764_6af877ff.jpg) ─── */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={onClose} style={styles.actionBtn} activeOpacity={0.7}>
              <Text style={styles.actionBtnText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} style={styles.actionBtn} activeOpacity={0.7}>
              <Text style={styles.actionBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContainer: {
    width: 270,
    backgroundColor: '#3e3e3e',
    borderRadius: 6,
    overflow: 'hidden',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
  },

  // Spinner 2-column layout
  spinnerWrapper: {
    height: CONTAINER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 26,
  },
  columnContainer: {
    width: 80,
    height: CONTAINER_HEIGHT,
    overflow: 'hidden',
  },
  itemSlot: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: '400',
  },
  numberTextSelected: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: 'bold',
  },

  // Colon in the middle
  colonContainer: {
    width: 24,
    height: CONTAINER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colonText: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 2,
  },

  // Horizontal Selection Divider Lines (Android NumberPicker style with gap over colon)
  columnLine: {
    position: 'absolute',
    width: 76,
    height: 1.5,
    backgroundColor: '#ffffff',
  },

  // Bottom Actions Row
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 24,
    paddingRight: 6,
    paddingTop: 8,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
