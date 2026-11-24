import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import {
  requestNotificationPermissions,
  syncBedtimeNotification,
  scheduleDailyNotification,
  scheduleWeeklyNotification,
  cancelNotification,
} from '../utils/notificationService';
import { groupSleepSamplesIntoSessions } from '../utils/sleepHelper';

interface NotificationItem {
  id: string;
  type: 'bedtime' | 'tip';
  title: string;
  subtitle: string;
  highlightText?: string;
  highlightColor?: string;
  date: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
}

// Parses any date/time input (ISO string, timestamp, or clock string) into a local Date
const parseToLocalDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // 1. Clock time match like "12:30 PM", "6:30 AM", "14:30"
    const clockMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (clockMatch) {
      let h = parseInt(clockMatch[1], 10);
      const m = parseInt(clockMatch[2], 10);
      const meridiem = clockMatch[3]?.toUpperCase();
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      const today = new Date();
      today.setHours(h, m, 0, 0);
      return today;
    }
    // 2. ISO or standard date string parse (e.g. "2026-11-24T22:30:00.000Z")
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

// Formats any time input (ISO string, Date object, or clock string) into user-friendly "h:mm AM/PM" (e.g. "12:30 PM")
const formatClockTime = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }
  }
  const d = parseToLocalDate(val);
  if (d) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return String(val);
};

// Helper to format today's date dynamically based on phone clock (matches Android bullet format: "Nov 24, 2026 • 3:00 AM")
const formatToday = (timeStr: string, daysAgo: number = 0): string => {
  const d = new Date();
  if (daysAgo > 0) {
    d.setDate(d.getDate() - daysAgo);
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const cleanTime = formatClockTime(timeStr);
  return `${month} ${day}, ${year} • ${cleanTime}`;
};

interface SleepStats {
  hasActualData?: boolean;
  streak?: number;
  bedtimeStr?: string;
  hasStrainTrigger?: boolean;
  strainReason?: string;
  isCircadianShift?: boolean;
  latestWakeTimeStr?: string;
  realignTargetTime?: string;
  windDownTime?: string;
}

const buildNotifications = (stats?: SleepStats): NotificationItem[] => {
  const hasActualData = stats?.hasActualData ?? false;
  const isCircadianShift = hasActualData ? (stats?.isCircadianShift ?? false) : false;

  // Clean, human-readable 12-hour clock times (e.g. "12:30 PM", "3:00 AM", "2:15 AM")
  const wakeStr = formatClockTime(stats?.latestWakeTimeStr) || '12:30 PM';
  const realignTarget = formatClockTime(stats?.realignTargetTime) || '3:00 AM';
  const windDownTime = formatClockTime(stats?.windDownTime) || '2:15 AM';

  const streak = stats?.streak ?? 0;
  const bedtime = formatClockTime(stats?.bedtimeStr) || '10:30 PM';
  const hasStrainTrigger = stats?.hasStrainTrigger ?? false;
  const strainReason = stats?.strainReason || 'Triggered by sleep deficit & night strain.';

  const items: NotificationItem[] = [];

  // Streak sentence for Bedtime reminder
  let streakSentence = 'Log your sleep tonight to start your healthy sleep streak!';
  if (streak === 1) {
    streakSentence = "You've logged your sleep last night — keep the streak going!";
  } else if (streak > 1) {
    streakSentence = `You've logged your sleep ${streak} nights in a row — keep the streak going!`;
  }

  if (hasActualData && isCircadianShift) {
    // ─── CIRCADIAN REALIGNMENT MODE (Matches Android screenshots exactly) ───

    // 1. Bedtime Reminder (Realigning Target)
    items.push({
      id: 'bedtime_reminder',
      type: 'bedtime',
      title: 'Bedtime Reminder',
      subtitle: `Realigning target: tonight at ${realignTarget}.`,
      date: formatToday(realignTarget),
      detail: `Your sleep rhythm is currently realigning. To gradually shift earlier from yesterday's schedule, your recovery bedtime target for tonight is set to ${realignTarget} (wind-down reminder at ${windDownTime}). ${streakSentence} Stepping 45 minutes earlier helps protect your biological clock.`,
      icon: 'moon',
      iconBg: '#7b61ff',
    });

    // 2. Recovery Tip (Circadian Realignment Advice with Sun icon)
    items.push({
      id: 'recovery_tip',
      type: 'tip',
      title: 'Recovery Tip',
      subtitle: `Circadian realignment (woke up at ${wakeStr}).`,
      date: formatToday('6:00 PM'),
      detail: `Extended rebound sleep detected with a significant circadian shift (woke up at ${wakeStr}). While your body caught up on physical rest, your circadian rhythm is out of sync. Avoid late naps today and gradually move your bedtime earlier in 30–45 minute increments to realign your rhythm.\n\n• Get outdoor bright sunlight exposure as soon as possible\n• Avoid caffeine and naps after 4:00 PM to build natural sleep drive\n• Begin dimming lights and wind down at ${windDownTime}\n• Aim to sleep at your recovery target window (${realignTarget})\n\nGradually stepping your schedule earlier each night protects daytime energy and prevents insomnia.`,
      icon: 'sunny',
      iconBg: '#f59e0b',
    });
  } else {
    // ─── DEFAULT / STANDARD MODE (Clean 2-card view matching Android) ───

    // 1. Bedtime Reminder
    items.push({
      id: 'bedtime_reminder',
      type: 'bedtime',
      title: 'Bedtime Reminder',
      subtitle: `Scheduled for tonight at ${bedtime}.`,
      date: formatToday(bedtime),
      detail: `Your target bedtime is set for ${bedtime}. ${streakSentence} We'll alert you 30 minutes before bedtime so you can start winding down.`,
      icon: 'moon',
      iconBg: '#7b61ff',
    });

    // 2. Recovery Tip
    const tipSubtitle = hasStrainTrigger
      ? strainReason
      : 'Try 10-minute breathing exercise before bed.';

    const introText = hasStrainTrigger
      ? 'Your recent sleep data indicated shorter rest or increased awakenings. Slow, paced breathing lowers heart rate, increases HRV, and helps your nervous system wind down.'
      : 'Slow, paced breathing lowers resting heart rate and helps you fall asleep faster.';

    const tipDetail = `${introText}\n\nHow to do the 4-7-8 technique:\n• Inhale quietly through your nose for 4s\n• Hold your breath gently for 7s\n• Exhale completely through your mouth for 8s\n\nRepeat for 4 cycles in bed to trigger natural sleepiness.`;

    items.push({
      id: 'recovery_tip',
      type: 'tip',
      title: 'Recovery Tip',
      subtitle: tipSubtitle,
      date: formatToday('6:00 PM'),
      detail: tipDetail,
      icon: hasStrainTrigger ? 'heart-outline' : 'sunny',
      iconBg: hasStrainTrigger ? '#22c55e' : '#f59e0b',
    });
  }

  return items;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Notification category states (all enabled by default matching Android screenshot media_1795482673163_8e76bfbe)
  const [bedtimeReminder, setBedtimeReminder] = useState(true);
  const [recoveryTips, setRecoveryTips] = useState(true);
  const [syncReminder, setSyncReminder] = useState(true);
  const [weeklyInsights, setWeeklyInsights] = useState(true);

  const [permGranted, setPermGranted] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>(['bedtime_reminder']);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Initializes with clean default state until actual data is loaded
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    buildNotifications({ hasActualData: false })
  );

  // Master switch state (true if all active)
  const isAllEnabled = bedtimeReminder && recoveryTips && syncReminder && weeklyInsights;

  useEffect(() => {
    initScreen();
    fetchSleepStats();
  }, []);

  // Re-fetch sleep stats & bedtime goals whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchSleepStats();
    }, [])
  );

  useEffect(() => {
    if (params.openSettings === 'true') {
      setIsSettingsOpen(true);
    }
  }, [params.openSettings]);

  const initScreen = async () => {
    const granted = await requestNotificationPermissions();
    setPermGranted(granted);

    await cancelNotification('sleepReminder');

    try {
      const stored = await AsyncStorage.getItem('notificationSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        setBedtimeReminder(parsed.bedtimeReminder ?? true);
        setRecoveryTips(parsed.recoveryTips ?? true);
        setSyncReminder(parsed.syncReminder ?? true);
        setWeeklyInsights(parsed.weeklyInsights ?? true);
      }
    } catch (e) {
      console.error('Failed to load notification settings', e);
    }

    try {
      await AsyncStorage.setItem('lastViewedNotifications', new Date().toISOString());
    } catch (e) {
      console.error('Failed to update lastViewedNotifications', e);
    }
  };

  const fetchSleepStats = async () => {
    try {
      // 1. Get user bedtime goal from settings/storage
      let bedtimeStr = '10:30 PM';
      let targetHour = 22;
      let targetMinute = 30;
      try {
        const goalsStr = await AsyncStorage.getItem('sleepGoals');
        if (goalsStr) {
          const parsed = JSON.parse(goalsStr);
          if (parsed.bedtimeHour !== undefined) {
            targetHour = parsed.bedtimeHour;
            targetMinute = parsed.bedtimeMinute !== undefined ? parsed.bedtimeMinute : 0;
            const ampm = targetHour >= 12 ? 'PM' : 'AM';
            const dh = targetHour % 12 || 12;
            const dm = targetMinute < 10 ? `0${targetMinute}` : targetMinute;
            bedtimeStr = `${dh}:${dm} ${ampm}`;
          }
        }
      } catch (_) {}

      // 2. Discover actual sleep metrics across available data sources
      let hasActualData = false;
      let detectedWakeDate: Date | null = null;
      let detectedWakeTimeStr: string | null = null;
      let detectedBedDate: Date | null = null;
      let detectedBedtimeStr: string | null = null;

      // Source A: Local home screen cache (populated by home dashboard sync)
      try {
        const cachedWake = await AsyncStorage.getItem('homeWakeTimeStr');
        if (cachedWake) {
          const wDate = parseToLocalDate(cachedWake);
          if (wDate) {
            detectedWakeDate = wDate;
            detectedWakeTimeStr = formatClockTime(wDate);
            hasActualData = true;
          }
        }
        const cachedBed = await AsyncStorage.getItem('homeBedtimeStr');
        if (cachedBed) {
          const bDate = parseToLocalDate(cachedBed);
          if (bDate) {
            detectedBedDate = bDate;
            detectedBedtimeStr = formatClockTime(bDate);
          }
        }
      } catch (_) {}

      // Source B: Check manual sleep logs in AsyncStorage
      try {
        const storedLogs = await AsyncStorage.getItem('sleepLogs');
        if (storedLogs) {
          const parsed = JSON.parse(storedLogs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const latest = parsed[0];
            if (latest.wakeTime) {
              const wDate = parseToLocalDate(latest.wakeTime);
              if (wDate) {
                hasActualData = true;
                if (!detectedWakeDate) detectedWakeDate = wDate;
                if (!detectedWakeTimeStr) detectedWakeTimeStr = formatClockTime(wDate);
              }
              if (latest.bedtime) {
                const bDate = parseToLocalDate(latest.bedtime);
                if (bDate) {
                  if (!detectedBedDate) detectedBedDate = bDate;
                  if (!detectedBedtimeStr) detectedBedtimeStr = formatClockTime(bDate);
                }
              }
            }
          }
        }
      } catch (_) {}

      // Source C: Apple HealthKit on iOS
      if (Platform.OS === 'ios' && !detectedWakeTimeStr) {
        try {
          const AppleHealthKit = require('react-native-health').default;
          const now = new Date();
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
          const options = {
            startDate: threeDaysAgo.toISOString(),
            endDate: now.toISOString(),
            limit: 500,
          };
          await new Promise<void>((resolve) => {
            AppleHealthKit.getSleepSamples(options, (err: any, results: any[]) => {
              if (!err && Array.isArray(results) && results.length > 0) {
                const sessions = groupSleepSamplesIntoSessions(results);
                if (sessions && sessions.length > 0) {
                  const sorted = sessions.sort(
                    (a: any, b: any) =>
                      new Date(b.endTime || b.startTime).getTime() - new Date(a.endTime || a.startTime).getTime()
                  );
                  const latestSession = sorted[0];
                  if (latestSession && latestSession.endTime) {
                    const wDate = parseToLocalDate(latestSession.endTime);
                    if (wDate) {
                      hasActualData = true;
                      detectedWakeDate = wDate;
                      detectedWakeTimeStr = formatClockTime(wDate);
                    }
                    if (latestSession.startTime) {
                      const bDate = parseToLocalDate(latestSession.startTime);
                      if (bDate) {
                        detectedBedDate = bDate;
                        detectedBedtimeStr = formatClockTime(bDate);
                      }
                    }
                  }
                }
              }
              resolve();
            });
          });
        } catch (_) {}
      }

      // Helper to evaluate if the actual wake pattern triggers a Circadian Shift
      const evaluateCircadianShift = (
        wakeInput: any,
        wakeDateInput?: Date | null,
        userTargetHour: number = 22,
        userTargetMinute: number = 30
      ) => {
        const wakeDate = wakeDateInput || parseToLocalDate(wakeInput);
        let wH = 0;
        let wM = 0;
        let cleanWakeStr = '12:30 PM';

        if (wakeDate) {
          wH = wakeDate.getHours();
          wM = wakeDate.getMinutes();
          cleanWakeStr = formatClockTime(wakeDate);
        } else if (typeof wakeInput === 'string') {
          cleanWakeStr = formatClockTime(wakeInput);
          const match = cleanWakeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (match) {
            let h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            const meridiem = match[3]?.toUpperCase();
            if (meridiem === 'PM' && h < 12) h += 12;
            if (meridiem === 'AM' && h === 12) h = 0;
            wH = h;
            wM = m;
          }
        }

        // Circadian shift triggers when waking up late in the morning/afternoon (>= 11:00 AM)
        const isShift = wH >= 11 && wH <= 18;

        if (!isShift) {
          return { isShift: false, realignTarget: '', windDownTime: '', wakeStr: cleanWakeStr };
        }

        // Adaptive recovery target bedtime is ~14.5 hours after waking up, stepping back in 30-45m increments
        // toward the user's configured Sleep Goal Target Bedtime
        let targetH = (wH + 14) % 24;
        let targetM = 0;
        if (wH >= 11 && wH <= 13) {
          targetH = 3;
          targetM = 0;
        }

        const ampm = targetH >= 12 ? 'PM' : 'AM';
        const displayH = targetH % 12 || 12;
        const displayM = targetM < 10 ? `0${targetM}` : targetM;
        const realignTarget = `${displayH}:${displayM} ${ampm}`;

        // Wind down is 45 minutes prior
        let windDownH = targetH;
        let windDownM = targetM - 45;
        if (windDownM < 0) {
          windDownM += 60;
          windDownH = (windDownH - 1 + 24) % 24;
        }
        const wAmpm = windDownH >= 12 ? 'PM' : 'AM';
        const wDisplayH = windDownH % 12 || 12;
        const wDisplayM = windDownM < 10 ? `0${windDownM}` : windDownM;
        const windDownTime = `${wDisplayH}:${wDisplayM} ${wAmpm}`;

        return { isShift: true, realignTarget, windDownTime, wakeStr: cleanWakeStr };
      };

      // Source D: Backend Cloud Sleep History
      const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
      const token = await AsyncStorage.getItem('token');

      let backendSessions: any[] = [];
      if (token) {
        try {
          const response = await fetch(`${backendUrl}/api/sleepSession/history`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const json = await response.json();
          if (json.success && json.data && json.data.sessions && json.data.sessions.length > 0) {
            backendSessions = json.data.sessions;
            hasActualData = true;
          }
        } catch (_) {}
      }

      // If NO actual data exists across all local and cloud sources, fall back to clean DEFAULT
      if (!hasActualData) {
        setNotifications(
          buildNotifications({
            hasActualData: false,
            bedtimeStr,
            streak: 0,
          })
        );
        return;
      }

      // If backend has sessions, compute streak & latest wake
      if (backendSessions.length > 0) {
        let latestEndObj: Date | null = null;
        const sortedSessions = [...backendSessions].sort((a: any, b: any) => {
          const tA = new Date(a.endTime || a.startTime).getTime();
          const tB = new Date(b.endTime || b.startTime).getTime();
          return tB - tA;
        });

        if (sortedSessions[0]?.endTime) {
          latestEndObj = parseToLocalDate(sortedSessions[0].endTime);
        }

        const hasSessionOnDay = (daysAgo: number) => {
          const d = new Date();
          d.setDate(d.getDate() - daysAgo);
          return backendSessions.some((session: any) => {
            const sDate = new Date(session.endTime || session.startTime);
            return sDate.toDateString() === d.toDateString();
          });
        };

        let verifiedStreak = 0;
        const loggedToday = hasSessionOnDay(0);
        const startDay = loggedToday ? 0 : 1;
        for (let d = startDay; d < 30; d++) {
          if (hasSessionOnDay(d)) {
            verifiedStreak++;
          } else {
            break;
          }
        }

        const effectiveWakeStr = latestEndObj
          ? formatClockTime(latestEndObj)
          : formatClockTime(detectedWakeTimeStr) || '12:30 PM';

        const circadian = evaluateCircadianShift(
          effectiveWakeStr,
          latestEndObj || detectedWakeDate,
          targetHour,
          targetMinute
        );

        setNotifications(
          buildNotifications({
            hasActualData: true,
            streak: verifiedStreak,
            bedtimeStr,
            isCircadianShift: circadian.isShift,
            latestWakeTimeStr: circadian.wakeStr,
            realignTargetTime: circadian.realignTarget,
            windDownTime: circadian.windDownTime,
          })
        );
        return;
      }

      // If local health / logs gave actual data but backend is not synced yet
      const wakeStr = formatClockTime(detectedWakeTimeStr) || '12:30 PM';
      const circadian = evaluateCircadianShift(wakeStr, detectedWakeDate, targetHour, targetMinute);

      setNotifications(
        buildNotifications({
          hasActualData: true,
          streak: 1,
          bedtimeStr,
          isCircadianShift: circadian.isShift,
          latestWakeTimeStr: circadian.wakeStr,
          realignTargetTime: circadian.realignTarget,
          windDownTime: circadian.windDownTime,
        })
      );
    } catch (err) {
      console.warn('Could not fetch dynamic sleep stats for notifications:', err);
      // Fallback cleanly to default state on unexpected error
      setNotifications(buildNotifications({ hasActualData: false }));
    }
  };

  const saveSettings = async (newSettings: any) => {
    try {
      const stored = await AsyncStorage.getItem('notificationSettings');
      const parsed = stored ? JSON.parse(stored) : {};
      const updated = { ...parsed, ...newSettings };
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save notification settings', e);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  // --- Master "All Notifications" Handler ---
  const toggleAllNotifications = async (value: boolean) => {
    if (value && !permGranted) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Please enable notifications in phone Settings first.');
        return;
      }
      setPermGranted(true);
    }

    setBedtimeReminder(value);
    setRecoveryTips(value);
    setSyncReminder(value);
    setWeeklyInsights(value);

    await saveSettings({
      bedtimeReminder: value,
      recoveryTips: value,
      syncReminder: value,
      weeklyInsights: value,
    });

    if (value) {
      let hour = 22;
      let minute = 30;
      try {
        const goalsStr = await AsyncStorage.getItem('sleepGoals');
        if (goalsStr) {
          const parsed = JSON.parse(goalsStr);
          if (parsed.bedtimeHour !== undefined) hour = parsed.bedtimeHour;
          if (parsed.bedtimeMinute !== undefined) minute = parsed.bedtimeMinute;
        }
      } catch (_) {}

      // 1. Bedtime Reminder at target bedtime
      await syncBedtimeNotification(hour, minute);

      // 2. Recovery Tips daily at 6:00 PM (18:00)
      await scheduleDailyNotification(
        'recoveryTips',
        18,
        0,
        '🌿 Sleep Recovery Tip',
        'Daily advice at 6:00 PM tailored to your recovery, strain, or schedule.'
      );

      // 3. Daily Sync Reminder at 8:00 AM (08:00)
      await scheduleDailyNotification(
        'sync',
        8,
        0,
        '📊 Daily Sync Reminder',
        'Reminds you at 8:00 AM to sync last night\'s sleep data.'
      );

      // 4. Weekly Insights every Sunday at 9:00 AM
      await scheduleWeeklyNotification(
        'weekly',
        1, // Sunday
        9,
        0,
        '📈 Your Weekly Sleep Insights Are Ready',
        'Summary report every Sunday morning at 9:00 AM.'
      );

      Alert.alert('✅ All Notifications Enabled', 'All reminder categories are scheduled for their specific times.');
    } else {
      await cancelNotification('bedtime');
      await cancelNotification('recoveryTips');
      await cancelNotification('sync');
      await cancelNotification('weekly');
      Alert.alert('Muted', 'All notification categories are now turned off.');
    }
  };

  // --- Individual Toggle Handlers (Scheduling to Specific Times) ---
  const toggleBedtime = async (value: boolean) => {
    if (value && !permGranted) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Please enable notifications in phone Settings first.');
        return;
      }
      setPermGranted(true);
    }

    setBedtimeReminder(value);
    await saveSettings({ bedtimeReminder: value });

    if (value) {
      let hour = 22;
      let minute = 30;
      try {
        const goalsStr = await AsyncStorage.getItem('sleepGoals');
        if (goalsStr) {
          const parsed = JSON.parse(goalsStr);
          if (parsed.bedtimeHour !== undefined) hour = parsed.bedtimeHour;
          if (parsed.bedtimeMinute !== undefined) minute = parsed.bedtimeMinute;
        }
      } catch (_) {}

      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayH = hour % 12 || 12;
      const displayM = minute < 10 ? `0${minute}` : minute;

      await syncBedtimeNotification(hour, minute);
      Alert.alert('✅ Reminder Active', `You will be alerted at ${displayH}:${displayM} ${ampm} to wind down.`);
    } else {
      await cancelNotification('bedtime');
    }
  };

  const toggleRecoveryTips = async (value: boolean) => {
    if (value && !permGranted) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Please enable notifications in phone Settings first.');
        return;
      }
      setPermGranted(true);
    }

    setRecoveryTips(value);
    await saveSettings({ recoveryTips: value });

    if (value) {
      // Pushes notification to specific time: 6:00 PM (18:00)
      await scheduleDailyNotification(
        'recoveryTips',
        18,
        0,
        '🌿 Sleep Recovery Tip',
        'Daily advice at 6:00 PM tailored to your recovery, strain, or schedule.'
      );
      Alert.alert('✅ Recovery Tips Active', 'You will receive daily advice at 6:00 PM tailored to your recovery, strain, or schedule.');
    } else {
      await cancelNotification('recoveryTips');
    }
  };

  const toggleSync = async (value: boolean) => {
    if (value && !permGranted) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Please enable notifications in phone Settings first.');
        return;
      }
      setPermGranted(true);
    }

    setSyncReminder(value);
    await saveSettings({ syncReminder: value });

    if (value) {
      // Pushes notification to specific time: 8:00 AM (08:00)
      await scheduleDailyNotification(
        'sync',
        8,
        0,
        '📊 Daily Sync Reminder',
        'Reminds you at 8:00 AM to sync last night\'s sleep data.'
      );
      Alert.alert('✅ Sync Reminder Active', 'You will be reminded every morning at 8:00 AM to sync.');
    } else {
      await cancelNotification('sync');
    }
  };

  const toggleInsights = async (value: boolean) => {
    if (value && !permGranted) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Please enable notifications in phone Settings first.');
        return;
      }
      setPermGranted(true);
    }

    setWeeklyInsights(value);
    await saveSettings({ weeklyInsights: value });

    if (value) {
      // Pushes notification to specific time: Sunday 9:00 AM
      await scheduleWeeklyNotification(
        'weekly',
        1, // Sunday
        9,
        0,
        '📈 Your Weekly Sleep Insights Are Ready',
        'Summary report every Sunday morning at 9:00 AM.'
      );
      Alert.alert('✅ Weekly Insights Active', 'You will receive your weekly sleep report every Sunday at 9:00 AM.');
    } else {
      await cancelNotification('weekly');
    }
  };

  // Filter feed based on user's active categories
  const visibleNotifications = notifications.filter((item) => {
    if (item.type === 'bedtime' && !bedtimeReminder) return false;
    if (item.type === 'tip' && !recoveryTips) return false;
    return true;
  });

  return (
    <LinearGradient colors={['#101222', '#181a30']} style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.headerIconButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Notifications</Text>

        <TouchableOpacity
          onPress={() => setIsSettingsOpen(true)}
          style={styles.headerIconButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Permission warning banner (if notifications are disabled) */}
      {!permGranted && (
        <View style={styles.permBanner}>
          <Ionicons name="warning-outline" size={16} color="#ff8c42" />
          <Text style={styles.permBannerText}>
            Notifications are disabled. Tap the settings icon above to enable reminders.
          </Text>
        </View>
      )}

      {/* Notifications List (Only Bedtime Reminder and Recovery Tip) */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {visibleNotifications.length > 0 ? (
          visibleNotifications.map((item) => {
            const isExpanded = expandedIds.includes(item.id);

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => toggleExpand(item.id)}
              >
                <View style={styles.cardTopRow}>
                  {/* Left Badge Icon */}
                  <View style={[styles.iconBadge, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.icon} size={22} color="#ffffff" />
                  </View>

                  {/* Center Content */}
                  <View style={styles.cardInfo}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                        size={18}
                        color="#71758c"
                      />
                    </View>

                    <Text style={styles.cardSubtitle}>
                      {item.subtitle}
                      {item.highlightText ? (
                        <Text
                          style={[
                            styles.cardHighlightText,
                            item.highlightColor ? { color: item.highlightColor } : null,
                          ]}
                        >
                          {item.highlightText}
                        </Text>
                      ) : null}
                    </Text>

                    <Text style={styles.cardDate}>{item.date}</Text>
                  </View>
                </View>

                {/* Accordion Expanded Details */}
                {isExpanded && (
                  <View style={styles.expandedSection}>
                    <View style={styles.divider} />
                    <Text style={styles.detailText}>{item.detail}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={36} color="#71758c" />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtitle}>
              You have no active alerts. All categories are optimal or turned off in Settings.
            </Text>
            <TouchableOpacity
              style={styles.emptySettingsButton}
              onPress={() => setIsSettingsOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={17} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.emptySettingsButtonText}>Notification Settings</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Notification Settings Modal (Matches media_1795482673163_8e76bfbe.jpg exactly) */}
      <Modal
        visible={isSettingsOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleGroup}>
                <Ionicons name="settings-sharp" size={20} color="#a259ff" />
                <Text style={styles.modalTitle}>Notification Settings</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsSettingsOpen(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Master "All Notifications" Card */}
              <View style={styles.masterRowCard}>
                <View style={styles.masterIconContainer}>
                  <Ionicons name="notifications" size={22} color="#ffffff" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.masterTitle}>All Notifications</Text>
                  <Text style={styles.masterDesc}>
                    Quickly turn all alerts on or off together
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3a3a5a', true: '#7b61ff' }}
                  thumbColor="#ffffff"
                  onValueChange={toggleAllNotifications}
                  value={isAllEnabled}
                />
              </View>

              <Text style={styles.sectionHeading}>INDIVIDUAL CATEGORIES</Text>

              {/* 1. Bedtime Reminder */}
              <View style={styles.settingRow}>
                <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(123, 97, 255, 0.18)' }]}>
                  <Ionicons name="moon" size={20} color="#7b61ff" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Bedtime Reminder</Text>
                  <Text style={styles.settingDesc}>
                    Wind-down alert auto-synced with your target bedtime goal.
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3a3a5a', true: '#7b61ff' }}
                  thumbColor="#ffffff"
                  onValueChange={toggleBedtime}
                  value={bedtimeReminder}
                />
              </View>

              <View style={styles.modalDivider} />

              {/* 2. Recovery Tips (Daily at 6:00 PM) */}
              <View style={styles.settingRow}>
                <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                  <Ionicons name="heart-outline" size={20} color="#22c55e" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Recovery Tips</Text>
                  <Text style={styles.settingDesc}>
                    Daily advice at 6:00 PM tailored to your recovery, strain, or schedule.
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3a3a5a', true: '#22c55e' }}
                  thumbColor="#ffffff"
                  onValueChange={toggleRecoveryTips}
                  value={recoveryTips}
                />
              </View>

              <View style={styles.modalDivider} />

              {/* 3. Daily Sync Reminder (Daily at 8:00 AM) */}
              <View style={styles.settingRow}>
                <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(67, 233, 123, 0.15)' }]}>
                  <Ionicons name="sync" size={20} color="#43e97b" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Daily Sync Reminder</Text>
                  <Text style={styles.settingDesc}>
                    Reminds you at 8:00 AM to sync last night's sleep data.
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3a3a5a', true: '#22c55e' }}
                  thumbColor="#ffffff"
                  onValueChange={toggleSync}
                  value={syncReminder}
                />
              </View>

              <View style={styles.modalDivider} />

              {/* 4. Weekly Insights (Sunday morning at 9:00 AM) */}
              <View style={styles.settingRow}>
                <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(255, 140, 66, 0.15)' }]}>
                  <Ionicons name="bar-chart" size={20} color="#ff8c42" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Weekly Insights</Text>
                  <Text style={styles.settingDesc}>
                    Summary report every Sunday morning at 9:00 AM.
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3a3a5a', true: '#ff8c42' }}
                  thumbColor="#ffffff"
                  onValueChange={toggleInsights}
                  value={weeklyInsights}
                />
              </View>

              {/* Info Note */}
              <View style={styles.modalInfoBox}>
                <Ionicons name="sparkles" size={16} color="#a259ff" />
                <Text style={styles.modalInfoText}>
                  Bedtime reminders automatically sync with whatever bedtime is configured in your Sleep Goals.
                </Text>
              </View>
            </ScrollView>

            {/* Done Button */}
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setIsSettingsOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  permBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 140, 66, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 66, 0.3)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  permBannerText: {
    color: '#ff8c42',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1b1d33',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#9aa0b4',
    marginTop: 4,
    lineHeight: 18,
  },
  cardHighlightText: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  cardDate: {
    fontSize: 12,
    color: '#5f6479',
    marginTop: 8,
  },
  expandedSection: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 13,
    color: '#a0a5b8',
    lineHeight: 20,
  },

  // Empty state styles
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8e92a4',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptySettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7b61ff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptySettingsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal styles (matches media_1795482673163_8e76bfbe.jpg)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1b1b36',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 20,
    paddingBottom: Platform.OS === 'android' ? 24 : 36,
    maxHeight: '90%',
  },
  modalScroll: {
    maxHeight: 520,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 4,
  },
  modalHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(123, 97, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(123, 97, 255, 0.25)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  masterIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7b61ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  masterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  masterDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71758c',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  modalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 3,
  },
  settingDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 17,
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(123, 97, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(123, 97, 255, 0.2)',
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
    marginBottom: 18,
    gap: 10,
  },
  modalInfoText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    flex: 1,
    lineHeight: 17,
  },
  doneButton: {
    backgroundColor: '#7b61ff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
