import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  PanResponder,
  TextInput,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

interface MaterialTimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (hours: number, minutes: number) => void;
  initialHours?: number; // 0 - 23
  initialMinutes?: number; // 0 - 59
  is24Hour?: boolean;
}

const DIAL_SIZE = 256;
const RADIUS = DIAL_SIZE / 2; // 128
const NUM_RADIUS = 96; // radius from center to number label

export default function MaterialTimePickerModal({
  visible,
  onClose,
  onConfirm,
  initialHours = 17,
  initialMinutes = 33,
  is24Hour = false,
}: MaterialTimePickerModalProps) {
  // Convert initial 24h to 12h + am/pm if not 24h
  const initialAmPm = initialHours >= 12 ? 'PM' : 'AM';
  const initial12H = is24Hour
    ? initialHours
    : initialHours % 12 === 0
    ? 12
    : initialHours % 12;

  const [mode, setMode] = useState<'hours' | 'minutes'>('hours');
  const [selectedHour, setSelectedHour] = useState(initial12H);
  const [selectedMinute, setSelectedMinute] = useState(initialMinutes);
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>(initialAmPm);
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);

  // Manual inputs for keyboard mode
  const [inputHour, setInputHour] = useState(initial12H.toString());
  const [inputMinute, setInputMinute] = useState(initialMinutes.toString().padStart(2, '0'));

  const dialRef = useRef<View>(null);
  const dialLayoutRef = useRef<{ pageX: number; pageY: number }>({ pageX: 0, pageY: 0 });

  useEffect(() => {
    if (visible) {
      const ampm = initialHours >= 12 ? 'PM' : 'AM';
      const h12 = is24Hour
        ? initialHours
        : initialHours % 12 === 0
        ? 12
        : initialHours % 12;

      setMode('hours');
      setSelectedHour(h12);
      setSelectedMinute(initialMinutes);
      setSelectedAmPm(ampm);
      setInputHour(h12.toString());
      setInputMinute(initialMinutes.toString().padStart(2, '0'));
      setIsKeyboardMode(false);
    }
  }, [visible, initialHours, initialMinutes, is24Hour]);

  // Measure dial on screen for touch gestures
  const measureDial = () => {
    dialRef.current?.measure((_x, _y, _width, _height, pageX, pageY) => {
      dialLayoutRef.current = { pageX, pageY };
    });
  };

  const handleDialTouch = (x: number, y: number) => {
    const dx = x - RADIUS;
    const dy = y - RADIUS;
    let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angleDeg < 0) angleDeg += 360;

    if (mode === 'hours') {
      let h = Math.round(angleDeg / 30);
      if (h === 0) h = 12;
      setSelectedHour(h);
      setInputHour(h.toString());
    } else {
      let m = Math.round(angleDeg / 6);
      if (m === 60) m = 0;
      setSelectedMinute(m);
      setInputMinute(m.toString().padStart(2, '0'));
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        handleDialTouch(locationX, locationY);
      },
      onPanResponderMove: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const x = pageX - dialLayoutRef.current.pageX;
        const y = pageY - dialLayoutRef.current.pageY;
        handleDialTouch(x, y);
      },
      onPanResponderRelease: () => {
        // Auto-advance from hours to minutes
        if (mode === 'hours') {
          setTimeout(() => {
            setMode('minutes');
          }, 180);
        }
      },
    })
  ).current;

  // Calculate tip coordinates for clock hand
  let activeAngleDeg = 0;
  if (mode === 'hours') {
    activeAngleDeg = (selectedHour % 12) * 30 - 90;
  } else {
    activeAngleDeg = selectedMinute * 6 - 90;
  }
  const rad = (activeAngleDeg * Math.PI) / 180;
  const tipX = RADIUS + NUM_RADIUS * Math.cos(rad);
  const tipY = RADIUS + NUM_RADIUS * Math.sin(rad);

  const handleConfirm = () => {
    let finalHour = selectedHour;
    let finalMinute = selectedMinute;

    if (isKeyboardMode) {
      const parsedH = parseInt(inputHour, 10);
      const parsedM = parseInt(inputMinute, 10);
      if (!isNaN(parsedH)) finalHour = parsedH;
      if (!isNaN(parsedM)) finalMinute = parsedM;
    }

    if (!is24Hour) {
      if (selectedAmPm === 'PM' && finalHour < 12) {
        finalHour += 12;
      } else if (selectedAmPm === 'AM' && finalHour === 12) {
        finalHour = 0;
      }
    }

    onConfirm(finalHour, finalMinute);
    onClose();
  };

  const hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minuteNumbers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose}>
        <Pressable style={styles.dialogContainer} onPress={(e) => e.stopPropagation()}>
          {/* ─── Top Header: 5:33 AM / PM (media_1795477888168_d62f6a50.jpg) ─── */}
          <View style={styles.headerContainer}>
            <View style={styles.timeRow}>
              {/* Hour selector */}
              <TouchableOpacity
                onPress={() => setMode('hours')}
                activeOpacity={0.7}
                style={[styles.timeBox, mode === 'hours' && styles.timeBoxActive]}
              >
                <Text style={[styles.timeText, mode === 'hours' ? styles.textActive : styles.textInactive]}>
                  {selectedHour}
                </Text>
              </TouchableOpacity>

              <Text style={styles.colonText}>:</Text>

              {/* Minute selector */}
              <TouchableOpacity
                onPress={() => setMode('minutes')}
                activeOpacity={0.7}
                style={[styles.timeBox, mode === 'minutes' && styles.timeBoxActive]}
              >
                <Text style={[styles.timeText, mode === 'minutes' ? styles.textActive : styles.textInactive]}>
                  {selectedMinute.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* AM / PM selector (for non-24h mode matching media_1795477888168_d62f6a50.jpg) */}
            {!is24Hour && (
              <View style={styles.amPmContainer}>
                <TouchableOpacity
                  onPress={() => setSelectedAmPm('AM')}
                  style={styles.amPmBtn}
                  hitSlop={{ top: 12, bottom: 8, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.amPmText,
                      selectedAmPm === 'AM' ? styles.amPmActive : styles.amPmInactive,
                    ]}
                  >
                    AM
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSelectedAmPm('PM')}
                  style={styles.amPmBtn}
                  hitSlop={{ top: 8, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.amPmText,
                      selectedAmPm === 'PM' ? styles.amPmActive : styles.amPmInactive,
                    ]}
                  >
                    PM
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ─── Body: Dial OR Keyboard Input ─────────────────────────────────── */}
          <View style={styles.bodyContainer}>
            {isKeyboardMode ? (
              <View style={styles.keyboardContainer}>
                <Text style={styles.keyboardPrompt}>Enter time</Text>
                <View style={styles.keyboardInputsRow}>
                  <TextInput
                    style={styles.keyboardInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={inputHour}
                    onChangeText={setInputHour}
                  />
                  <Text style={styles.keyboardColon}>:</Text>
                  <TextInput
                    style={styles.keyboardInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={inputMinute}
                    onChangeText={setInputMinute}
                  />
                </View>
              </View>
            ) : (
              <View
                ref={dialRef}
                onLayout={measureDial}
                style={styles.clockDial}
                {...panResponder.panHandlers}
              >
                {/* SVG Layer: Dial circle, line, center pin & tip circle */}
                <Svg width={DIAL_SIZE} height={DIAL_SIZE} style={StyleSheet.absoluteFill}>
                  {/* Dark grey dial background */}
                  <Circle cx={RADIUS} cy={RADIUS} r={RADIUS} fill="#505050" />

                  {/* Teal clock hand */}
                  <Line
                    x1={RADIUS}
                    y1={RADIUS}
                    x2={tipX}
                    y2={tipY}
                    stroke="#80cbc4"
                    strokeWidth={2}
                  />

                  {/* Small center dot */}
                  <Circle cx={RADIUS} cy={RADIUS} r={4} fill="#80cbc4" />

                  {/* Outer circle tip on selected item */}
                  <Circle cx={tipX} cy={tipY} r={20} fill="#80cbc4" />
                </Svg>

                {/* Number labels overlay */}
                {(mode === 'hours' ? hourNumbers : minuteNumbers).map((num, i) => {
                  const angle = (i * 30 - 90) * (Math.PI / 180);
                  const x = RADIUS + NUM_RADIUS * Math.cos(angle);
                  const y = RADIUS + NUM_RADIUS * Math.sin(angle);
                  const isSelected =
                    mode === 'hours'
                      ? selectedHour === (num === 0 ? 12 : num)
                      : selectedMinute === num;

                  return (
                    <View
                      key={`num_${num}`}
                      style={[
                        styles.numberContainer,
                        {
                          left: x - 18,
                          top: y - 18,
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <Text
                        style={[
                          styles.numberText,
                          isSelected ? styles.numberTextSelected : styles.numberTextUnselected,
                        ]}
                      >
                        {mode === 'hours' ? num : num.toString().padStart(2, '0')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ─── Bottom Actions Row: Keyboard toggle + CANCEL / OK ─────────────── */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => setIsKeyboardMode(!isKeyboardMode)}
              style={styles.iconBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isKeyboardMode ? 'time-outline' : 'keypad-outline'}
                size={22}
                color="rgba(255, 255, 255, 0.8)"
              />
            </TouchableOpacity>

            <View style={styles.actionBtnsGroup}>
              <TouchableOpacity onPress={onClose} style={styles.actionBtn} activeOpacity={0.7}>
                <Text style={styles.actionBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} style={styles.actionBtn} activeOpacity={0.7}>
                <Text style={styles.actionBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
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
    width: 324,
    backgroundColor: '#383838',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
  },

  // Header matching Screenshot media_1795477888168_d62f6a50.jpg
  headerContainer: {
    backgroundColor: '#4a4a4a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    position: 'relative',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBox: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeBoxActive: {},
  timeText: {
    fontSize: 54,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  textActive: {
    color: '#ffffff',
    fontWeight: '500',
  },
  textInactive: {
    color: 'rgba(255, 255, 255, 0.45)',
  },
  colonText: {
    fontSize: 48,
    color: 'rgba(255, 255, 255, 0.7)',
    marginHorizontal: 3,
    marginBottom: 6,
  },
  amPmContainer: {
    marginLeft: 16,
    height: 60,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  amPmBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  amPmText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  amPmActive: {
    color: '#ffffff',
    opacity: 1,
  },
  amPmInactive: {
    color: 'rgba(255, 255, 255, 0.45)',
    opacity: 0.8,
  },

  // Body Dial
  bodyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#383838',
  },
  clockDial: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    position: 'relative',
  },
  numberContainer: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 14,
    fontWeight: '500',
  },
  numberTextSelected: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  numberTextUnselected: {
    color: '#ffffff',
  },

  // Keyboard Mode
  keyboardContainer: {
    height: DIAL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  keyboardPrompt: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 16,
  },
  keyboardInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardInput: {
    width: 72,
    height: 60,
    backgroundColor: '#4a4a4a',
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#80cbc4',
  },
  keyboardColon: {
    fontSize: 32,
    color: '#ffffff',
    marginHorizontal: 10,
  },

  // Bottom Actions
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    backgroundColor: '#383838',
  },
  iconBtn: {
    padding: 8,
  },
  actionBtnsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionBtnText: {
    color: '#80cbc4',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
