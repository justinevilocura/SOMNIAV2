import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  Image,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import AppleHealthKit, { HealthInputOptions } from 'react-native-health';
import { groupSleepSamplesIntoSessions } from '../utils/sleepHelper';
import { useNotificationBadge } from '../hooks/useSleepRisk';
import MaterialTimePickerModal from '../components/MaterialTimePickerModal';

type QualityOption = 'Bad' | 'Poor' | 'Okay' | 'Good' | 'Excellent';
type StressLevel = 'Low' | 'Moderate' | 'High';

interface ManualLogEntry {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  totalDurationMinutes: number;
  formattedDuration: string;
  sleepQuality: QualityOption;
  stressLevel: StressLevel;
  notes?: string;
  createdAt: string;
}

export default function SleepLog() {
  const router = useRouter();
  const hasUnread = useNotificationBadge();

  // Navigation & User State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState({ name: 'User', email: '', avatar: '' });

  // Date State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [viewingYear, setViewingYear] = useState(new Date().getFullYear());
  const [viewingMonth, setViewingMonth] = useState(new Date().getMonth());
  const [loadingDateData, setLoadingDateData] = useState(false);
  const [hasDataForSelectedDate, setHasDataForSelectedDate] = useState(false);

  // Time States
  const [bedtime, setBedtime] = useState(() => {
    const d = new Date();
    d.setHours(22, 30, 0, 0); // Default 10:30 PM
    return d;
  });
  const [wakeTime, setWakeTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(6, 30, 0, 0); // Default 6:30 AM
    return d;
  });
  const [timePickerMode, setTimePickerMode] = useState<'bedtime' | 'wakeTime'>('bedtime');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());

  // Sleep Quality State (Default: 'Good')
  const [sleepQuality, setSleepQuality] = useState<QualityOption>('Good');

  // Workload / Stress State (Default: 'Moderate')
  const [stressLevel, setStressLevel] = useState<StressLevel>('Moderate');

  // Notes State
  const [notes, setNotes] = useState('');

  // Recent Manual Logs State & Accordion Collapse
  const [manualLogs, setManualLogs] = useState<ManualLogEntry[]>([]);
  const [isRecentLogsExpanded, setIsRecentLogsExpanded] = useState(true);

  useEffect(() => {
    loadUserData();
    loadManualLogs();
  }, []);

  useEffect(() => {
    fetchDataForSelectedDate(selectedDate);
  }, [selectedDate]);

  const loadUserData = async () => {
    try {
      const authDataString = await AsyncStorage.getItem('authData');
      if (authDataString) {
        const authData = JSON.parse(authDataString);
        setUserData({
          name: authData.name || 'User',
          email: authData.email || '',
          avatar: authData.avatar || '',
        });
      }

      const token = await AsyncStorage.getItem('token');
      if (token) {
        const backendUrl =
          process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
        const userRes = await fetch(`${backendUrl}/api/user/data`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const isCustomized = await AsyncStorage.getItem('profileCustomized');
        const userJson = await userRes.json();
        if (userJson.success && userJson.userData) {
          setUserData((prev) => ({
            name: isCustomized === 'true' && prev.name ? prev.name : userJson.userData.name || 'User',
            email: isCustomized === 'true' && prev.email ? prev.email : userJson.userData.email || '',
            avatar: userJson.userData.avatar || prev.avatar || '',
          }));
        }
      }
    } catch (e) {
      console.log('Error loading user profile:', e);
    }
  };

  const loadManualLogs = async () => {
    try {
      const stored = await AsyncStorage.getItem('sleepLogs');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setManualLogs(parsed);
        }
      }
    } catch (_) {}
  };

  // Apple HealthKit query for a specific date on iOS
  const queryHealthKitForDate = async (targetDate: Date): Promise<any | null> => {
    return new Promise((resolve) => {
      if (Platform.OS !== 'ios') {
        return resolve(null);
      }

      const start = new Date(targetDate);
      start.setDate(start.getDate() - 1);
      start.setHours(18, 0, 0, 0); // Search starting from 6 PM on the evening before

      const end = new Date(targetDate);
      end.setHours(23, 59, 59, 999);

      const options: HealthInputOptions = {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        limit: 500,
      };

      AppleHealthKit.getSleepSamples(options, (err, results) => {
        if (err || !results || results.length === 0) {
          resolve(null);
        } else {
          const sessions = groupSleepSamplesIntoSessions(results);
          if (sessions && sessions.length > 0) {
            const targetDateStr = targetDate.toDateString();
            // Match sessions concluding on targetDate
            const matched = sessions.find((s: any) => {
              const sEnd = new Date(s.endTime || s.startTime).toDateString();
              return sEnd === targetDateStr;
            });
            resolve(matched || sessions[sessions.length - 1]);
          } else {
            resolve(null);
          }
        }
      });
    });
  };

  /**
   * Fetch data for the chosen date: checks manual log, HealthKit, backend API
   */
  const fetchDataForSelectedDate = async (targetDate: Date) => {
    setLoadingDateData(true);
    try {
      const targetDateStr = targetDate.toDateString();

      // 1. Check if user already saved a manual sleep log for this date
      const localLogsStr = await AsyncStorage.getItem('sleepLogs');
      if (localLogsStr) {
        const localLogs: ManualLogEntry[] = JSON.parse(localLogsStr);
        const matchedLocal = localLogs.find(
          (log: any) => new Date(log.date).toDateString() === targetDateStr
        );

        if (matchedLocal) {
          setBedtime(new Date(matchedLocal.bedtime));
          setWakeTime(new Date(matchedLocal.wakeTime));
          setSleepQuality(matchedLocal.sleepQuality || 'Good');
          setStressLevel(matchedLocal.stressLevel || 'Moderate');
          setNotes(matchedLocal.notes || '');
          setHasDataForSelectedDate(true);
          setLoadingDateData(false);
          return;
        }
      }

      // 2. Query Apple HealthKit on iOS
      try {
        const hkSession = await queryHealthKitForDate(targetDate);
        if (hkSession && hkSession.startTime && hkSession.endTime) {
          setBedtime(new Date(hkSession.startTime));
          setWakeTime(new Date(hkSession.endTime));
          setHasDataForSelectedDate(true);
          setLoadingDateData(false);
          return;
        }
      } catch (hkErr) {
        console.warn('HealthKit query error in sleepLog:', hkErr);
      }

      // 3. Query Backend history for sessions matching this calendar day
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          const backendUrl =
            process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
          const response = await fetch(`${backendUrl}/api/sleepSession/history`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });

          const json = await response.json();
          if (json.success && json.data?.sessions?.length) {
            const daySessions = json.data.sessions.filter((s: any) => {
              const endD = s.endTime ? new Date(s.endTime).toDateString() : null;
              const startD = s.startTime ? new Date(s.startTime).toDateString() : null;
              return endD === targetDateStr || startD === targetDateStr;
            });

            if (daySessions.length > 0) {
              const validStarts = daySessions
                .map((s: any) => new Date(s.startTime).getTime())
                .filter((t: number) => !isNaN(t));
              const validEnds = daySessions
                .map((s: any) => new Date(s.endTime).getTime())
                .filter((t: number) => !isNaN(t));

              if (validStarts.length > 0 && validEnds.length > 0) {
                setBedtime(new Date(Math.min(...validStarts)));
                setWakeTime(new Date(Math.max(...validEnds)));
                setHasDataForSelectedDate(true);
                setLoadingDateData(false);
                return;
              }
            }
          }
        } catch (_) {}
      }

      // 4. No session found for this date -> Show Notice Banner and use default 10:30 PM - 6:30 AM
      setHasDataForSelectedDate(false);
      const defaultStart = new Date(targetDate);
      defaultStart.setHours(22, 30, 0, 0);
      const defaultEnd = new Date(targetDate);
      defaultEnd.setDate(defaultEnd.getDate() + 1);
      defaultEnd.setHours(6, 30, 0, 0);

      setBedtime(defaultStart);
      setWakeTime(defaultEnd);
      setSleepQuality('Good');
      setStressLevel('Moderate');
      setNotes('');
    } catch (err) {
      console.warn('Error fetching date data:', err);
      setHasDataForSelectedDate(false);
    } finally {
      setLoadingDateData(false);
    }
  };

  // Calculate Total Sleep Duration
  const calculateTotalSleep = () => {
    const start = bedtime.getTime();
    let end = wakeTime.getTime();

    if (end <= start) {
      end += 24 * 60 * 60 * 1000;
    }

    const diffMs = end - start;
    const totalMinutes = Math.round(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return { hours, mins, formatted: `${hours}h ${mins}m` };
  };

  const totalSleep = calculateTotalSleep();

  const formatClockTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minsStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${minsStr} ${ampm}`;
  };

  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleSaveLog = async () => {
    try {
      const logEntry: ManualLogEntry = {
        id: Date.now().toString(),
        date: selectedDate.toISOString(),
        bedtime: bedtime.toISOString(),
        wakeTime: wakeTime.toISOString(),
        totalDurationMinutes: totalSleep.hours * 60 + totalSleep.mins,
        formattedDuration: totalSleep.formatted,
        sleepQuality,
        stressLevel,
        notes,
        createdAt: new Date().toISOString(),
      };

      // 1. Save to local storage
      const existing = await AsyncStorage.getItem('sleepLogs');
      const logsArray = existing ? JSON.parse(existing) : [];
      const filtered = logsArray.filter(
        (l: any) => new Date(l.date).toDateString() !== selectedDate.toDateString()
      );
      const updatedLogs = [logEntry, ...filtered];
      await AsyncStorage.setItem('sleepLogs', JSON.stringify(updatedLogs));
      setManualLogs(updatedLogs);

      // 2. Also register into sleepHistory so Sleep Overview & Reports update
      try {
        const historyStr = await AsyncStorage.getItem('sleepHistory');
        const historyArr = historyStr ? JSON.parse(historyStr) : [];
        const sessionEntry = {
          startTime: bedtime.toISOString(),
          endTime: wakeTime.toISOString(),
          durationHours: totalSleep.hours + totalSleep.mins / 60,
          title: `Manual Sleep Log - ${sleepQuality}`,
        };
        await AsyncStorage.setItem('sleepHistory', JSON.stringify([sessionEntry, ...historyArr]));
      } catch (_) {}

      // 3. Sync to backend if authenticated
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const backendUrl =
            process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
          await fetch(`${backendUrl}/api/sleepSession/addSleepSession`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify([
              {
                startTime: bedtime.toISOString(),
                endTime: wakeTime.toISOString(),
                title: `Manual Sleep Log - ${sleepQuality}`,
                stages: [
                  {
                    startTime: bedtime.toISOString(),
                    endTime: new Date(bedtime.getTime() + 2 * 3600000).toISOString(),
                    stage: 5, // Deep
                  },
                  {
                    startTime: new Date(wakeTime.getTime() - 1.5 * 3600000).toISOString(),
                    endTime: wakeTime.toISOString(),
                    stage: 6, // REM
                  },
                ],
              },
            ]),
          });
        }
      } catch (backendErr) {
        console.log('Backend sync skipped or offline:', backendErr);
      }

      setHasDataForSelectedDate(true);

      Toast.show({
        type: 'success',
        text1: 'Sleep Log Saved! 🌙',
        text2: `Recorded ${totalSleep.formatted} of sleep for ${formatDateLabel(selectedDate)}.`,
      });
    } catch (e) {
      console.error('Error saving sleep log:', e);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Could not save your sleep log. Please try again.',
      });
    }
  };

  const handleDeleteLog = async (id: string) => {
    try {
      const updated = manualLogs.filter((log) => log.id !== id);
      setManualLogs(updated);
      await AsyncStorage.setItem('sleepLogs', JSON.stringify(updated));
      Toast.show({
        type: 'info',
        text1: 'Log Removed',
        text2: 'The manual log entry was deleted.',
      });
    } catch (_) {}
  };

  const handleSelectLog = (log: ManualLogEntry) => {
    const logDate = new Date(log.date);
    setSelectedDate(logDate);
    setViewingYear(logDate.getFullYear());
    setViewingMonth(logDate.getMonth());
    setTempDate(new Date(logDate));
    setBedtime(new Date(log.bedtime));
    setWakeTime(new Date(log.wakeTime));
    setSleepQuality(log.sleepQuality || 'Good');
    setStressLevel(log.stressLevel || 'Moderate');
    setNotes(log.notes || '');
    setHasDataForSelectedDate(true);

    Toast.show({
      type: 'info',
      text1: 'Log Loaded',
      text2: `Editing sleep log for ${formatDateLabel(logDate)}.`,
    });
  };

  const monthNamesLong = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const daysOfWeekShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const prevMonth = () => {
    if (viewingMonth === 0) {
      setViewingMonth(11);
      setViewingYear((prev) => prev - 1);
    } else {
      setViewingMonth((prev) => prev - 1);
    }
  };

  const nextMonth = () => {
    if (viewingMonth === 11) {
      setViewingMonth(0);
      setViewingYear((prev) => prev + 1);
    } else {
      setViewingMonth((prev) => prev + 1);
    }
  };

  const qualities: { label: QualityOption; emoji: string }[] = [
    { label: 'Bad', emoji: '😫' },
    { label: 'Poor', emoji: '🙁' },
    { label: 'Okay', emoji: '😐' },
    { label: 'Good', emoji: '😊' },
    { label: 'Excellent', emoji: '😆' },
  ];

  return (
    <LinearGradient colors={['#101524', '#151a2e', '#1c213a']} style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#101524" />

      {/* ─── Top Header: Exact match across all SOMNiA screens ───────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setIsMenuOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="menu-outline" size={28} color="#fff" />
          </TouchableOpacity>
          <Image
            source={
              userData.avatar
                ? { uri: userData.avatar }
                : require('../assets/images/default-avatar.png')
            }
            style={styles.avatar}
          />
          <View>
            <Text style={styles.greeting}>Welcome,</Text>
            <Text style={styles.profileName}>{userData.name || 'User'}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={26} color="#fff" />
            {hasUnread && <View style={styles.badgeDot} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.replace({ pathname: '/home', params: { tab: 'profile' } })}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Title Row: "Log Sleep" on left, Date Button on right ───────────── */}
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Log Sleep</Text>
          <TouchableOpacity
            onPress={() => {
              setViewingYear(selectedDate.getFullYear());
              setViewingMonth(selectedDate.getMonth());
              setTempDate(new Date(selectedDate));
              setShowDatePicker(true);
            }}
            style={styles.datePickerPill}
            activeOpacity={0.8}
          >
            <Text style={styles.datePickerText}>{formatDateLabel(selectedDate)}</Text>
            <Ionicons name="calendar-outline" size={17} color="#a855f7" />
          </TouchableOpacity>
        </View>

        {/* Loading Indicator when fetching data for a selected date */}
        {loadingDateData && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color="#a855f7" />
            <Text style={styles.loadingText}>Fetching accurate sleep data...</Text>
          </View>
        )}

        {/* Notice Banner: Shown when NO smartwatch record is found for date (matching Image 1) */}
        {!loadingDateData && !hasDataForSelectedDate && (
          <View style={styles.noDataNotice}>
            <Ionicons name="information-circle-outline" size={20} color="#f59e0b" style={styles.noticeIcon} />
            <Text style={styles.noDataText}>
              No smartwatch record found for this date. You can manually enter your sleep below.
            </Text>
          </View>
        )}

        {/* ─── 1. Sleep Duration Card ───────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sleep Duration</Text>
          <View style={styles.timePickersRow}>
            {/* Bedtime Selector */}
            <TouchableOpacity
              style={styles.timePillButton}
              onPress={() => {
                setTempTime(bedtime);
                setTimePickerMode('bedtime');
                setShowTimePicker(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.timePillText}>{formatClockTime(bedtime)}</Text>
              <Ionicons name="chevron-down" size={14} color="#8a99ad" />
            </TouchableOpacity>

            <Ionicons name="arrow-forward" size={18} color="#8a99ad" />

            {/* Wake Time Selector */}
            <TouchableOpacity
              style={styles.timePillButton}
              onPress={() => {
                setTempTime(wakeTime);
                setTimePickerMode('wakeTime');
                setShowTimePicker(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.timePillText}>{formatClockTime(wakeTime)}</Text>
              <Ionicons name="chevron-down" size={14} color="#8a99ad" />
            </TouchableOpacity>
          </View>

          {/* Total Sleep Indicator (cyan highlight matching Image 1) */}
          <View style={styles.totalSleepContainer}>
            <Text style={styles.totalSleepValue}>{totalSleep.formatted}</Text>
            <Text style={styles.totalSleepLabel}>Total Sleep</Text>
          </View>
        </View>

        {/* ─── 2. Sleep Quality Card (5 Emojis) ──────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sleep Quality</Text>
          <View style={styles.qualityRow}>
            {qualities.map((item) => {
              const isSelected = sleepQuality === item.label;
              return (
                <TouchableOpacity
                  key={item.label}
                  style={styles.qualityItem}
                  onPress={() => setSleepQuality(item.label)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.qualityEmojiCircle,
                      isSelected && styles.qualityEmojiSelected,
                    ]}
                  >
                    <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
                  </View>
                  <Text
                    style={[
                      styles.qualityText,
                      isSelected && styles.qualityTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ─── 3. Workload / Stress Card (Segmented Capsule) ─────────────────── */}
        <View style={styles.card}>
          <View style={styles.stressHeaderRow}>
            <Text style={styles.cardLabel}>Workload / Stress</Text>
            <Text
              style={[
                styles.stressCurrentValue,
                {
                  color:
                    stressLevel === 'High'
                      ? '#ef4444'
                      : stressLevel === 'Moderate'
                      ? '#f59e0b'
                      : '#22c55e',
                },
              ]}
            >
              {stressLevel}
            </Text>
          </View>

          {/* 3-segment switcher track matching Screenshot 1 & 2 */}
          <View style={styles.stressCapsuleTrack}>
            {(['Low', 'Moderate', 'High'] as const).map((level) => {
              const isSelected = stressLevel === level;
              return (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.stressSegmentButton,
                    isSelected && styles.stressSegmentActive,
                  ]}
                  onPress={() => setStressLevel(level)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.stressSegmentText,
                      isSelected && styles.stressSegmentTextActive,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ─── 4. Notes (Optional) Card ─────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            placeholder="How was your day?"
            placeholderTextColor="#64748b"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* ─── 5. Save Log Button (Purple, matching Screenshot 2) ────────────── */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveLog}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>Save Log</Text>
        </TouchableOpacity>

        {/* ─── 6. Recent Manual Logs Accordion Card (matching Screenshot 2) ─── */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.recentLogsHeader}
            onPress={() => setIsRecentLogsExpanded(!isRecentLogsExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.recentLogsTitle}>
              Recent Manual Logs ({manualLogs.length})
            </Text>
            <Ionicons
              name={isRecentLogsExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#818cf8"
            />
          </TouchableOpacity>

          {isRecentLogsExpanded && (
            <View style={styles.recentLogsBody}>
              {manualLogs.length === 0 ? (
                <Text style={styles.emptyLogsText}>
                  No recent manual logs recorded. Enter your sleep above and tap "Save Log" to record an entry.
                </Text>
              ) : (
                manualLogs.map((log) => {
                  const logDate = new Date(log.date);
                  const emoji = qualities.find((q) => q.label === log.sleepQuality)?.emoji || '😊';
                  return (
                    <TouchableOpacity
                      key={log.id}
                      style={styles.logItemCard}
                      onPress={() => handleSelectLog(log)}
                      onLongPress={() => handleDeleteLog(log.id)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.logItemTopRow}>
                          <Text style={styles.logItemDate}>{formatDateLabel(logDate)}</Text>
                          <Text style={styles.logItemDot}> • </Text>
                          <Text style={styles.logItemDuration}>{log.formattedDuration}</Text>
                        </Text>
                        <Text style={styles.logItemSubtitle} numberOfLines={1}>
                          Quality: {log.sleepQuality} • Stress: {log.stressLevel}
                          {log.notes ? ` • ${log.notes}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.logItemEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── Material Date Picker Modal (Exact match to Android Screenshot media_1795476939411_83199db7.jpg) ── */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <Pressable style={styles.calendarDialogContainer} onPress={(e) => e.stopPropagation()}>
            {/* Top Header: 2026 / Tue 24 Nov */}
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarHeaderYear}>{tempDate.getFullYear()}</Text>
              <Text style={styles.calendarHeaderDate}>
                {`${daysOfWeekShort[tempDate.getDay()]} ${tempDate.getDate()} ${monthsShort[tempDate.getMonth()]}`}
              </Text>
            </View>

            {/* Calendar Body */}
            <View style={styles.calendarBody}>
              {/* Month Navigation Row: < November 2026 > */}
              <View style={styles.calendarMonthNavRow}>
                <TouchableOpacity onPress={prevMonth} style={styles.calendarNavArrow} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={18} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.calendarMonthTitle}>
                  {`${monthNamesLong[viewingMonth]} ${viewingYear}`}
                </Text>
                <TouchableOpacity onPress={nextMonth} style={styles.calendarNavArrow} activeOpacity={0.7}>
                  <Ionicons name="chevron-forward" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {/* Day of Week Row: M T W T F S S */}
              <View style={styles.calendarWeekdaysRow}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter, i) => (
                  <Text key={i} style={styles.calendarWeekdayText}>
                    {letter}
                  </Text>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.calendarGrid}>
                {(() => {
                  const totalDays = new Date(viewingYear, viewingMonth + 1, 0).getDate();
                  const startOffset = (new Date(viewingYear, viewingMonth, 1).getDay() + 6) % 7;
                  const cells = [];

                  for (let b = 0; b < startOffset; b++) {
                    cells.push(<View key={`blank_${b}`} style={styles.calendarDayCell} />);
                  }

                  for (let d = 1; d <= totalDays; d++) {
                    const isSelected =
                      tempDate.getDate() === d &&
                      tempDate.getMonth() === viewingMonth &&
                      tempDate.getFullYear() === viewingYear;

                    cells.push(
                      <TouchableOpacity
                        key={`day_${d}`}
                        style={styles.calendarDayCell}
                        onPress={() => setTempDate(new Date(viewingYear, viewingMonth, d))}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.calendarDayCircle, isSelected && styles.calendarDaySelected]}>
                          <Text style={[styles.calendarDayText, isSelected && styles.calendarDayTextSelected]}>
                            {d}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }
                  return cells;
                })()}
              </View>

              {/* Bottom Actions Row: CANCEL   OK */}
              <View style={styles.calendarActionsRow}>
                <TouchableOpacity
                  style={styles.calendarActionBtn}
                  onPress={() => setShowDatePicker(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.calendarActionText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.calendarActionBtn}
                  onPress={() => {
                    setSelectedDate(tempDate);
                    setShowDatePicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.calendarActionText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </TouchableOpacity>
      </Modal>

      {/* ─── Material Time Picker Modal (Bedtime / Wake Time) ──────────────── */}
      <MaterialTimePickerModal
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        initialHours={timePickerMode === 'bedtime' ? bedtime.getHours() : wakeTime.getHours()}
        initialMinutes={timePickerMode === 'bedtime' ? bedtime.getMinutes() : wakeTime.getMinutes()}
        is24Hour={false}
        onConfirm={(h, m) => {
          const target = new Date(timePickerMode === 'bedtime' ? bedtime : wakeTime);
          target.setHours(h, m, 0, 0);
          if (timePickerMode === 'bedtime') {
            setBedtime(target);
          } else {
            setWakeTime(target);
          }
        }}
      />

      {/* ─── Side Menu Drawer Modal: Consistent across SOMNiA ───────────────── */}
      <Modal
        visible={isMenuOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setIsMenuOpen(false)} />
          <View style={styles.drawerContainer}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerBrand}>
                <Image
                  source={require('../assets/images/somnia.png')}
                  style={styles.drawerLogo}
                  resizeMode="contain"
                />
              </View>
              <TouchableOpacity
                onPress={() => setIsMenuOpen(false)}
                style={styles.drawerCloseButton}
              >
                <Ionicons name="close-outline" size={24} color="#aaa" />
              </TouchableOpacity>
            </View>

            <View style={styles.drawerProfileSection}>
              <Image
                source={
                  userData.avatar
                    ? { uri: userData.avatar }
                    : require('../assets/images/default-avatar.png')
                }
                style={styles.drawerAvatar}
              />
              <Text style={styles.drawerUserName} numberOfLines={1}>
                {userData.name || 'SOMNiA User'}
              </Text>
              <Text style={styles.drawerUserEmail} numberOfLines={1}>
                {userData.email || ''}
              </Text>
            </View>

            <View style={styles.drawerDivider} />

            <ScrollView style={styles.drawerNavList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace({ pathname: '/home', params: { tab: 'home' } });
                }}
              >
                <Ionicons name="home-outline" size={22} color="#a259ff" />
                <Text style={styles.drawerNavText}>Home Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/overview');
                }}
              >
                <Ionicons name="pie-chart-outline" size={22} color="#06d6a0" />
                <Text style={styles.drawerNavText}>Sleep Overview</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/sleepReports');
                }}
              >
                <Ionicons name="bar-chart-outline" size={22} color="#a259ff" />
                <Text style={styles.drawerNavText}>Sleep Reports</Text>
              </TouchableOpacity>

              {/* Active Tab: Sleep Log */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  {
                    backgroundColor: 'rgba(129, 140, 248, 0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(129, 140, 248, 0.4)',
                  },
                ]}
                onPress={() => setIsMenuOpen(false)}
              >
                <Ionicons name="bed" size={22} color="#818cf8" />
                <Text style={[styles.drawerNavText, { color: '#818cf8', fontWeight: 'bold' }]}>
                  Sleep Log
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/sleepGoals');
                }}
              >
                <Ionicons name="moon-outline" size={22} color="#a259ff" />
                <Text style={styles.drawerNavText}>Sleep Goals</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace({ pathname: '/home', params: { tab: 'diary' } });
                }}
              >
                <Ionicons name="book-outline" size={22} color="#43e97b" />
                <Text style={styles.drawerNavText}>Sleep Diary</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace({ pathname: '/home', params: { tab: 'recommendations' } });
                }}
              >
                <Ionicons name="bulb-outline" size={22} color="#ffd166" />
                <Text style={styles.drawerNavText}>Sleep Tips</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 50,
    backgroundColor: 'transparent',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    marginRight: 12,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(162, 89, 255, 0.4)',
  },
  greeting: {
    color: '#8b9bb4',
    fontSize: 13,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  notificationButton: {
    position: 'relative',
    padding: 6,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#101524',
    zIndex: 10,
  },
  profileButton: {
    padding: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // Title Row
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  datePickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  datePickerText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },

  // Loading Banner
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  loadingText: {
    fontSize: 12,
    color: '#a855f7',
    fontWeight: '500',
  },

  // Notice Banner (Amber notice matching Screenshot 1)
  noDataNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  noticeIcon: {
    marginRight: 10,
  },
  noDataText: {
    flex: 1,
    fontSize: 13,
    color: '#fbbf24',
    lineHeight: 18,
  },

  // Cards
  card: {
    backgroundColor: '#161c2e',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },

  // Time Pickers Row
  timePickersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  timePillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e263d',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  timePillText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
  },
  totalSleepContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  totalSleepValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#38bdf8',
    marginBottom: 2,
  },
  totalSleepLabel: {
    fontSize: 12,
    color: '#8a99ad',
  },

  // Sleep Quality Emojis
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  qualityItem: {
    alignItems: 'center',
  },
  qualityEmojiCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 6,
  },
  qualityEmojiSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  qualityText: {
    fontSize: 12,
    color: '#8a99ad',
    fontWeight: '500',
  },
  qualityTextSelected: {
    color: '#22c55e',
    fontWeight: 'bold',
  },

  // Workload / Stress
  stressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stressCurrentValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  stressCapsuleTrack: {
    flexDirection: 'row',
    backgroundColor: '#101524',
    borderRadius: 25,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  stressSegmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stressSegmentActive: {
    backgroundColor: '#161c2e',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  stressSegmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8a99ad',
  },
  stressSegmentTextActive: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },

  // Notes
  notesInput: {
    backgroundColor: '#1e263d',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 14,
    minHeight: 75,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },

  // Save Button
  saveButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  // Recent Manual Logs Accordion
  recentLogsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentLogsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  recentLogsBody: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyLogsText: {
    fontSize: 13,
    color: '#8a99ad',
    textAlign: 'center',
    lineHeight: 19,
    paddingVertical: 6,
  },
  logItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f1423',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  logItemTopRow: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  logItemDate: {
    color: '#ffffff',
  },
  logItemDot: {
    color: '#38bdf8',
  },
  logItemDuration: {
    color: '#38bdf8',
  },
  logItemSubtitle: {
    fontSize: 12.5,
    color: '#8a99ad',
  },
  logItemEmoji: {
    fontSize: 26,
    marginLeft: 6,
  },

  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Material Design Date Picker Modal (media_1795476939411_83199db7.jpg)
  calendarDialogContainer: {
    width: 324,
    backgroundColor: '#383838',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 24,
  },
  calendarHeader: {
    backgroundColor: '#4a4a4a',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 16,
  },
  calendarHeaderYear: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  calendarHeaderDate: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  calendarBody: {
    backgroundColor: '#383838',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  calendarMonthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  calendarNavArrow: {
    padding: 6,
  },
  calendarMonthTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarWeekdayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  calendarDayCell: {
    width: (324 - 32) / 7,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: '#80cbc4',
  },
  calendarDayText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  calendarDayTextSelected: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  calendarActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    gap: 16,
  },
  calendarActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  calendarActionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#80cbc4',
    letterSpacing: 0.5,
  },

  // Drawer
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  drawerContainer: {
    width: '78%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: '#161c2e',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderRightWidth: 1,
    borderColor: 'rgba(162, 89, 255, 0.25)',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  drawerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerLogo: {
    width: 110,
    height: 32,
  },
  drawerCloseButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  drawerProfileSection: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    marginBottom: 16,
  },
  drawerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#a259ff',
    marginBottom: 10,
  },
  drawerUserName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  drawerUserEmail: {
    color: '#8b9bb4',
    fontSize: 12,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  drawerNavList: {
    flex: 1,
  },
  drawerNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  drawerNavText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 14,
  },
});
