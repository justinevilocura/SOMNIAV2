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
import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import {
  requestNotificationPermissions,
  syncBedtimeNotification,
  syncRecoveryTipNotification,
  scheduleDailyNotification,
  scheduleWeeklyNotification,
  cancelNotification,
} from '../utils/notificationService';

interface NotificationItem {
  id: string;
  type: 'risk' | 'bedtime' | 'tip';
  title: string;
  subtitle: string;
  highlightText?: string;
  highlightColor?: string;
  date: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
}

// Helper to format today's date dynamically based on phone clock
const formatToday = (timeStr: string, daysAgo: number = 0): string => {
  const d = new Date();
  if (daysAgo > 0) {
    d.setDate(d.getDate() - daysAgo);
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}, ${year} · ${timeStr}`;
};

interface SleepStats {
  streak?: number;
  avgDuration?: string;
  efficiency?: number;
  bedtimeStr?: string;
  windDownStr?: string;
  wakeTimeStr?: string;
  isCircadianShifted?: boolean;
  circadianStatus?: 'On Track' | 'Adapting' | 'Shifted / Realigning';
  hasStrainTrigger?: boolean;
  strainReason?: string;
  loggedDaysInWindow?: number;
  latestNightDuration?: string;
  isReboundSleep?: boolean;
}

const buildNotifications = (stats?: SleepStats): NotificationItem[] => {
  const streak = stats?.streak ?? 0;
  const efficiency = stats?.efficiency ?? 97;
  const avgDuration = stats?.avgDuration || '7h 30m';
  const bedtime = stats?.bedtimeStr || '10:30 PM';
  const windDown = stats?.windDownStr || '10:00 PM';
  const wakeTime = stats?.wakeTimeStr || '2:59 PM';
  const isShifted = stats?.isCircadianShifted ?? false;
  const circadianStatus = stats?.circadianStatus || 'On Track';
  const isRebound = stats?.isReboundSleep ?? false;
  const hasStrainTrigger = stats?.hasStrainTrigger ?? false;
  const strainReason = stats?.strainReason || 'Triggered by sleep deficit & night strain.';
  const loggedDaysInWindow = stats?.loggedDaysInWindow ?? 3;
  const durationText = stats?.latestNightDuration || avgDuration;

  const items: NotificationItem[] = [];

  // 1. Bedtime Reminder Card (dynamically synced with Sleep Target Window)
  let streakSentence = 'Log your sleep tonight to start your healthy sleep streak!';
  if (streak === 1) {
    streakSentence = "You've logged your sleep last night — keep the streak going!";
  } else if (streak > 1) {
    streakSentence = `You've logged your sleep ${streak} nights in a row — keep the streak going!`;
  }

  let bedtimeSubtitle = `Scheduled for tonight at ${bedtime}.`;
  let bedtimeDetail = `Your target bedtime is set for ${bedtime}. ${streakSentence} We'll alert you at ${windDown} so you can start winding down.`;

  if (circadianStatus === 'Shifted / Realigning' || isShifted) {
    bedtimeSubtitle = `Realigning target: tonight at ${bedtime}.`;
    bedtimeDetail = `Your sleep rhythm is currently realigning. To gradually shift earlier from yesterday's schedule, your recovery bedtime target for tonight is set to ${bedtime} (wind-down reminder at ${windDown}). ${streakSentence} Stepping 45 minutes earlier helps protect your biological clock.`;
  } else if (circadianStatus === 'Adapting') {
    bedtimeSubtitle = `Adapting target: tonight at ${bedtime}.`;
    bedtimeDetail = `Your target bedtime is set for ${bedtime} (wind-down at ${windDown}) as your schedule adapts. ${streakSentence} Stick to this window to stabilize your rhythm.`;
  }

  items.push({
    id: 'bedtime_reminder',
    type: 'bedtime',
    title: 'Bedtime Reminder',
    subtitle: bedtimeSubtitle,
    date: formatToday(bedtime),
    detail: bedtimeDetail,
    icon: 'moon',
    iconBg: '#7b61ff',
  });

  // 2. Recovery Tip Card — mirrors the overview Recovery Recommendation
  if (circadianStatus === 'Shifted / Realigning' || isShifted) {
    items.push({
      id: 'recovery_tip',
      type: 'tip',
      title: 'Recovery Tip',
      subtitle: `Circadian realignment (woke up at ${wakeTime}).`,
      date: formatToday('6:00 PM'),
      detail: `Extended rebound sleep detected with a significant circadian shift (woke up at ${wakeTime}). While your body caught up on physical rest, your circadian rhythm is out of sync. Avoid late naps today and gradually move your bedtime earlier in 30–45 minute increments to realign your rhythm.\n\n• Get outdoor bright sunlight exposure as soon as possible\n• Avoid caffeine and naps after 4:00 PM to build natural sleep drive\n• Begin dimming lights and wind down at ${windDown}\n• Aim to sleep at your recovery target window (${bedtime})\n\nGradually stepping your schedule earlier each night protects daytime energy and prevents insomnia.`,
      icon: 'sunny-outline',
      iconBg: '#f59e0b',
    });
  } else if (hasStrainTrigger && loggedDaysInWindow > 0) {
    items.push({
      id: 'recovery_tip',
      type: 'tip',
      title: 'Recovery Tip',
      subtitle: strainReason,
      date: formatToday('6:00 PM'),
      detail: `Your recent sleep data indicated shorter rest or elevated sleep deficit. Support restorative recovery with these techniques:\n\n• Keep your bedroom cool (18–20°C / 65–68°F) for deep sleep continuity\n• Avoid heavy meals within 2 hours of bedtime\n• Practice 4-7-8 breathing in bed to down-regulate your nervous system\n\nPrioritizing an earlier wind-down mitigates cumulative fatigue.`,
      icon: 'heart-outline',
      iconBg: '#22c55e',
    });
  } else {
    items.push({
      id: 'recovery_tip',
      type: 'tip',
      title: 'Recovery Tip',
      subtitle: 'Try 10-minute breathing exercise before bed.',
      date: formatToday('6:00 PM'),
      detail: `Slow, paced breathing lowers resting heart rate and helps you fall asleep faster.\n\nHow to do the 4-7-8 technique:\n• Inhale quietly through your nose for 4s\n• Hold your breath gently for 7s\n• Exhale completely through your mouth for 8s\n\nRepeat for 4 cycles in bed to trigger natural sleepiness.`,
      icon: 'heart-outline',
      iconBg: '#22c55e',
    });
  }

  return items;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Individual notification category states
  const [bedtimeReminder, setBedtimeReminder] = useState(true);
  const [recoveryTips, setRecoveryTips] = useState(true);
  const [syncReminder, setSyncReminder] = useState(false);
  const [weeklyInsights, setWeeklyInsights] = useState(false);

  const [permGranted, setPermGranted] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => buildNotifications());

  // Master switch state (true if all active)
  const isAllEnabled =
    bedtimeReminder && recoveryTips && syncReminder && weeklyInsights;

  // Re-run on every screen focus so goal changes are picked up immediately
  const initDone = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!initDone.current) {
        initScreen();
        initDone.current = true;
      }
      fetchSleepStats();
    }, [])
  );

  useEffect(() => {
    if (params.openSettings === 'true') {
      setIsSettingsOpen(true);
    }
  }, [params.openSettings]);

  const initScreen = async () => {
    // 1. Request permissions & setup notification channel
    const granted = await requestNotificationPermissions();
    setPermGranted(granted);

    // 2. Clean up legacy 8:00 PM sleepReminder key if present
    await cancelNotification('sleepReminder');

    // 3. Load saved toggle states
    try {
      const stored = await AsyncStorage.getItem('notificationSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        setBedtimeReminder(parsed.bedtimeReminder ?? true);
        setRecoveryTips(parsed.recoveryTips ?? true);
        setSyncReminder(parsed.syncReminder ?? false);
        setWeeklyInsights(parsed.weeklyInsights ?? false);
      }
    } catch (e) {
      console.error('Failed to load notification settings', e);
    }

    // 4. Mark notifications as viewed to clear the red badge on the bell icon
    try {
      await AsyncStorage.setItem('lastViewedNotifications', new Date().toISOString());
    } catch (e) {
      console.error('Failed to update lastViewedNotifications', e);
    }
  };

  const fetchSleepStats = async () => {
    try {
      // ── 1. Load user sleep goal ──────────────────────────────────────────
      let goalSleepHours = 8.0;
      try {
        const goalsStr = await AsyncStorage.getItem('sleepGoals');
        if (goalsStr) {
          const goals = JSON.parse(goalsStr);
          if (goals.sleepDuration && typeof goals.sleepDuration === 'number') {
            goalSleepHours = goals.sleepDuration;
          }
        }
      } catch (_) {}

      // ── 2. Fetch backend sessions ────────────────────────────────────────
      const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        setNotifications(buildNotifications());
        return;
      }

      let allSessions: any[] = [];
      try {
        const response = await fetch(`${backendUrl}/api/sleepSession/history`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const json = await response.json();
        if (json.success && json.data?.sessions?.length) {
          allSessions = [...json.data.sessions];
        }
      } catch (err) {
        console.warn('Notifications: backend history error:', err);
      }

      // ── 3. Merge manual sleep logs ───────────────────────────────────────
      try {
        const storedLogs = await AsyncStorage.getItem('sleepLogs');
        if (storedLogs) {
          const parsed = JSON.parse(storedLogs);
          if (Array.isArray(parsed)) {
            parsed.forEach((l: any) => {
              if (l.date || l.bedtime) {
                const bTime = l.bedtime ? new Date(l.bedtime) : new Date(l.date);
                const wTime = l.wakeTime
                  ? new Date(l.wakeTime)
                  : new Date(bTime.getTime() + (l.totalDurationMinutes || 450) * 60000);
                allSessions.push({
                  startTime: bTime.toISOString(),
                  endTime: wTime.toISOString(),
                  durationHours: (l.totalDurationMinutes || 450) / 60,
                });
              }
            });
          }
        }
      } catch (_) {}

      // ── 4. Merge sleep diary entries ─────────────────────────────────────
      try {
        const storedDiary = await AsyncStorage.getItem('sleepDiaryEntries');
        if (storedDiary) {
          const parsedDiary = JSON.parse(storedDiary);
          if (Array.isArray(parsedDiary)) {
            parsedDiary.forEach((d: any) => {
              if (d.bedtime && d.wakeTime) {
                const bTime = new Date(d.bedtime);
                let wTime = new Date(d.wakeTime);
                if (wTime.getTime() <= bTime.getTime()) {
                  wTime = new Date(wTime.getTime() + 24 * 3600000);
                }
                allSessions.push({
                  startTime: bTime.toISOString(),
                  endTime: wTime.toISOString(),
                  durationHours: (wTime.getTime() - bTime.getTime()) / 3600000,
                });
              }
            });
          }
        }
      } catch (_) {}

      // ── 5. Merge wearable cache ──────────────────────────────────────────
      let cachedWearable: any = null;
      try {
        const cwStr = await AsyncStorage.getItem('latestWearableSleep');
        if (cwStr) {
          cachedWearable = JSON.parse(cwStr);
          if (cachedWearable && (cachedWearable.date || cachedWearable.endTime)) {
            const wDate = cachedWearable.date || cachedWearable.endTime;
            const exists = allSessions.some(
              (s: any) =>
                new Date(s.endTime || s.startTime).toDateString() === new Date(wDate).toDateString()
            );
            if (!exists) {
              const durH =
                cachedWearable.hours !== undefined
                  ? cachedWearable.hours + (cachedWearable.minutes || 0) / 60
                  : (cachedWearable.totalMinutes || 0) / 60;
              if (durH > 0) {
                allSessions.push({
                  startTime:
                    cachedWearable.startTime ||
                    new Date(new Date(wDate).getTime() - durH * 3600000).toISOString(),
                  endTime: cachedWearable.endTime || wDate,
                  durationHours: durH,
                });
              }
            }
          }
        }
      } catch (_) {}

      // ── 6. Helper: session net hours ─────────────────────────────────────
      const getSessionHours = (s: any): number => {
        if (s.durationHours !== undefined && s.durationHours !== null) return s.durationHours;
        if (s.durationMinutes !== undefined && s.durationMinutes !== null) return s.durationMinutes / 60;
        if (s.startTime && s.endTime) {
          const diff = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000;
          if (diff > 0) return diff;
        }
        return 0;
      };

      const now = new Date();

      // ── 7. Build per-day records for the last 7 days ─────────────────────
      const dailyRecords: { date: Date; hours: number }[] = [];
      let latestNightHours = 0;

      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() - i);
        const targetDateStr = targetDate.toDateString();

        const sessionsForDay = allSessions.filter((s: any) => {
          const endStr = s.endTime ? new Date(s.endTime).toDateString() : '';
          const startStr = s.startTime ? new Date(s.startTime).toDateString() : '';
          return endStr === targetDateStr || (!endStr && startStr === targetDateStr);
        });

        let dayHours = 0;
        sessionsForDay.forEach((s: any) => { dayHours += getSessionHours(s); });

        const validHours = dayHours > 0 && dayHours < 16 ? dayHours : 0;
        dailyRecords.push({ date: targetDate, hours: validHours });
        if (validHours > 0) latestNightHours = validHours;
      }

      // ── 8. Last-3-day stats ──────────────────────────────────────────────
      const recent3Days = dailyRecords.slice(-3);
      const loggedInLast3 = recent3Days.filter((d) => d.hours > 0);
      const loggedDaysInWindow = loggedInLast3.length;

      let threeDayAvgVal = 0;
      if (loggedDaysInWindow > 0) {
        threeDayAvgVal = loggedInLast3.reduce((sum, d) => sum + d.hours, 0) / loggedDaysInWindow;
      }

      const avgH = Math.floor(threeDayAvgVal);
      const avgM = Math.round((threeDayAvgVal - avgH) * 60);
      const formattedAvg = avgM > 0 ? `${avgH}h ${avgM}m` : `${avgH}h`;

      const lH = Math.floor(latestNightHours);
      const lM = Math.round((latestNightHours - lH) * 60);
      const latestNightDuration = lM > 0 ? `${lH}h ${lM}m` : `${lH}h`;

      // ── 9. Realistic efficiency from wearable or stage data ──────────────
      let efficiency = 0;
      // Prefer wearable efficiency if available and recent
      if (
        cachedWearable?.efficiency !== undefined &&
        cachedWearable.efficiency > 0 &&
        cachedWearable.efficiency <= 100
      ) {
        efficiency = Math.round(cachedWearable.efficiency);
      } else if (
        cachedWearable?.deepMinutes !== undefined &&
        cachedWearable?.remMinutes !== undefined &&
        cachedWearable?.lightMinutes !== undefined
      ) {
        // Calculate from stage breakdown: (Deep + REM + Light) / total * 100 capped at ~97
        const deepM = cachedWearable.deepMinutes || 0;
        const remM = cachedWearable.remMinutes || 0;
        const lightM = cachedWearable.lightMinutes || 0;
        const awakeM = cachedWearable.awakeMinutes || 0;
        const totalM = deepM + remM + lightM + awakeM;
        if (totalM > 0) {
          const rawEff = ((deepM + remM + lightM) / totalM) * 100;
          // Apply 3% natural micro-arousal deduction for clinical realism
          efficiency = Math.min(97, Math.round(rawEff * 0.97));
        }
      }
      // Fallback: duration-based (capped at 97 for realism)
      if (efficiency === 0 && threeDayAvgVal > 0) {
        efficiency = Math.min(97, Math.round((threeDayAvgVal / (goalSleepHours || 8.0)) * 100));
      }

      // ── 10. Circadian shift detection — ONLY from sessions in the last 7 days ──
      let isCircadianShifted = false;
      let circadianStatus: 'On Track' | 'Adapting' | 'Shifted / Realigning' = 'On Track';

      // Always start from the user's saved sleep goal as the bedtime default
      let goalBedtimeStr = '10:30 PM';
      let goalWindDownStr = '10:00 PM';
      let goalTargetHour = 22;
      let goalTargetMinute = 30;
      try {
        const goalsStr2 = await AsyncStorage.getItem('sleepGoals');
        if (goalsStr2) {
          const g = JSON.parse(goalsStr2);
          if (g.bedtimeHour !== undefined) {
            goalTargetHour = g.bedtimeHour;
            goalTargetMinute = g.bedtimeMinute ?? 0;
            const ampm = goalTargetHour >= 12 ? 'PM' : 'AM';
            const dh = goalTargetHour % 12 || 12;
            const dm = String(goalTargetMinute).padStart(2, '0');
            goalBedtimeStr = `${dh}:${dm} ${ampm}`;
            const wdMins = ((goalTargetHour * 60 + goalTargetMinute - 30) + 1440) % 1440;
            const wdH = Math.floor(wdMins / 60) % 12 || 12;
            const wdAmpm = Math.floor(wdMins / 60) >= 12 ? 'PM' : 'AM';
            goalWindDownStr = `${wdH}:${String(wdMins % 60).padStart(2, '0')} ${wdAmpm}`;
          }
        }
      } catch (_) {}

      let dynamicBedtimeStr = goalBedtimeStr;
      let dynamicWindDownStr = goalWindDownStr;
      let dynamicTargetHour = goalTargetHour;
      let dynamicTargetMinute = goalTargetMinute;

      const formatMinutesToClock = (totalMins: number): string => {
        const normalized = ((totalMins % 1440) + 1440) % 1440;
        let hours = Math.floor(normalized / 60);
        const mins = normalized % 60;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const mStr = mins < 10 ? `0${mins}` : `${mins}`;
        return `${hours}:${mStr} ${ampm}`;
      };

      // Only detect circadian shift from sessions within the last 7 days
      // so stale old diary entries don't corrupt the bedtime target
      const recentSessions = allSessions.filter((s: any) => {
        const sessionTime = new Date(s.endTime || s.startTime).getTime();
        const diffDays = (now.getTime() - sessionTime) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 7.5;
      });

      let wakeTimeDisplay = '2:59 PM';

      if (recentSessions.length > 0) {
        // Sort newest first — detect circadian shift even without last-3-day data
        // so the bedtime reminder stays in sync with the overview Sleep Target Window
        const sorted = [...recentSessions].sort(
          (a, b) =>
            new Date(b.endTime || b.startTime).getTime() -
            new Date(a.endTime || a.startTime).getTime()
        );
        const latest = sorted[0];

        let sessionWakeMins: number | null = null;
        let sessionBedMins: number | null = null;

        if (latest.endTime) {
          const eD = new Date(latest.endTime);
          sessionWakeMins = eD.getHours() * 60 + eD.getMinutes();
          const h = eD.getHours();
          const m = eD.getMinutes();
          const ampm = h >= 12 ? 'PM' : 'AM';
          const dh = h % 12 || 12;
          wakeTimeDisplay = `${dh}:${m < 10 ? '0' : ''}${m} ${ampm}`;
        }
        if (latest.startTime) {
          const sD = new Date(latest.startTime);
          sessionBedMins = sD.getHours() * 60 + sD.getMinutes();
        }

        // Afternoon wake-up (>= 12:30 PM) or sleeping past 2:30 AM = circadian shifted
        isCircadianShifted =
          (sessionWakeMins !== null && (sessionWakeMins >= 12 * 60 + 30 || sessionWakeMins < 5 * 60)) ||
          (sessionBedMins !== null && sessionBedMins >= 2 * 60 + 30 && sessionBedMins < 12 * 60);

        // Compute baseline ideal bedtime anchored to normal morning wake times
        const normalMorningWakeMins: number[] = [];
        recentSessions.forEach((s: any) => {
          if (s.endTime) {
            const eD = new Date(s.endTime);
            const wMins = eD.getHours() * 60 + eD.getMinutes();
            if (wMins >= 300 && wMins <= 630) normalMorningWakeMins.push(wMins);
          }
        });
        const anchorWakeMins =
          normalMorningWakeMins.length > 0
            ? Math.round(normalMorningWakeMins.reduce((a, b) => a + b, 0) / normalMorningWakeMins.length)
            : 7 * 60;
        const goalMinutes = Math.round((goalSleepHours || 8.0) * 60);
        const baselineIdealBedtimeMins = (((anchorWakeMins - goalMinutes) % 1440) + 1440) % 1440;

        let targetBedtimeMins = baselineIdealBedtimeMins;

        if (isCircadianShifted && sessionBedMins !== null) {
          circadianStatus = 'Shifted / Realigning';
          // 45 min step earlier from shifted bedtime, rounded to 30-min block
          const shiftedEarlier = (((sessionBedMins - 45) % 1440) + 1440) % 1440;
          targetBedtimeMins = Math.floor(shiftedEarlier / 30) * 30;
        } else if (sessionBedMins !== null) {
          let bedDiff = Math.abs(sessionBedMins - baselineIdealBedtimeMins);
          if (bedDiff > 720) bedDiff = 1440 - bedDiff;
          if (bedDiff > 45) {
            circadianStatus = 'Adapting';
            const shiftedEarlier = (((sessionBedMins - 30) % 1440) + 1440) % 1440;
            targetBedtimeMins = Math.floor(shiftedEarlier / 30) * 30;
          }
        }

        if (circadianStatus !== 'On Track') {
          // Wind-down = 45 min before target bedtime
          const windDownMins = (((targetBedtimeMins - 45) % 1440) + 1440) % 1440;
          dynamicBedtimeStr = formatMinutesToClock(targetBedtimeMins);
          dynamicWindDownStr = formatMinutesToClock(windDownMins);
          const normalizedBed = ((targetBedtimeMins % 1440) + 1440) % 1440;
          dynamicTargetHour = Math.floor(normalizedBed / 60);
          dynamicTargetMinute = normalizedBed % 60;
        }
        // If On Track → keep goal bedtime (already set as default above)
      }

      // ── 11. Rebound sleep flag ───────────────────────────────────────────
      const isReboundSleep = latestNightHours > 10.0;

      // ── 12. Strain trigger ───────────────────────────────────────────────
      const hasStrain =
        loggedDaysInWindow > 0 && (efficiency < 82 || (latestNightHours > 0 && latestNightHours < 6.2));
      let strainReason = 'Triggered by sleep deficit & night strain.';
      if (latestNightHours > 0 && latestNightHours < 6.0) {
        strainReason = `Triggered by short sleep (${latestNightDuration} last night).`;
      } else if (efficiency < 82) {
        strainReason = `Triggered by sleep efficiency drop (${efficiency}%).`;
      }

      // ── 13. Verified streak ──────────────────────────────────────────────
      const hasSessionOnDay = (daysAgo: number) => {
        const d = new Date(now);
        d.setDate(now.getDate() - daysAgo);
        const dStr = d.toDateString();
        return allSessions.some((s: any) => {
          const sDate = new Date(s.endTime || s.startTime).toDateString();
          return sDate === dStr;
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

      // ── 14. Build dynamic notifications ──────────────────────────────────
      setNotifications(
        buildNotifications({
          streak: verifiedStreak,
          avgDuration: formattedAvg,
          efficiency,
          bedtimeStr: dynamicBedtimeStr,
          windDownStr: dynamicWindDownStr,
          wakeTimeStr: wakeTimeDisplay,
          isCircadianShifted,
          circadianStatus,
          isReboundSleep,
          hasStrainTrigger: hasStrain,
          strainReason,
          loggedDaysInWindow,
          latestNightDuration,
        })
      );

      // ── 15. Sync push notifications ──────────────────────────────────────
      await syncBedtimeNotification(dynamicTargetHour, dynamicTargetMinute);

      // Schedule daily 6:00 PM Recovery Tip push
      let tipPushBody =
        'Slow, paced breathing lowers resting heart rate. Try the 4-7-8 technique before bed to fall asleep faster.';
      if (circadianStatus === 'Shifted / Realigning' || isCircadianShifted) {
        tipPushBody = `Circadian shift detected (woke up at ${wakeTimeDisplay}). Avoid late naps today, wind down at ${dynamicWindDownStr}, and aim for bed at ${dynamicBedtimeStr}.`;
      } else if (hasStrain) {
        tipPushBody =
          'Sleep deficit or strain detected. Keep your bedroom cool and practice 4-7-8 breathing before bed to support deeper sleep.';
      }
      await syncRecoveryTipNotification(tipPushBody, '🌿 Sleep Recovery Tip');
    } catch (err) {
      console.warn('Could not fetch dynamic sleep stats for notifications:', err);
      setNotifications(buildNotifications());
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

      await syncBedtimeNotification(hour, minute);
      await scheduleDailyNotification(
        'sync',
        8,
        0,
        '📊 Daily Sync Reminder',
        'Open SOMNiA to sync your sleep and health data from last night.'
      );
      await scheduleWeeklyNotification(
        'weekly',
        1,
        9,
        0,
        '📈 Your Weekly Sleep Insights Are Ready',
        'Check your SOMNiA weekly sleep report to see how you performed!'
      );
      await syncRecoveryTipNotification();
      Alert.alert('✅ All Notifications Enabled', 'All reminder categories are now active.');
    } else {
      await cancelNotification('bedtime');
      await cancelNotification('sync');
      await cancelNotification('weekly');
      await cancelNotification('recoveryTips');
      Alert.alert('Muted', 'All notification categories are now turned off.');
    }
  };

  // --- Individual Toggle Handlers ---
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
      Alert.alert('✅ Reminder Active', `You will be reminded daily at ${displayH}:${displayM} ${ampm} to sleep.`);
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
      await syncRecoveryTipNotification();
      Alert.alert('✅ Recovery Tip Active', 'You will receive your recovery tip push notification every evening at 6:00 PM.');
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
      await scheduleDailyNotification(
        'sync',
        8,
        0,
        '📊 Daily Sync Reminder',
        'Open SOMNiA to sync your sleep and health data from last night.'
      );
      Alert.alert('✅ Reminder Active', 'You will be reminded every morning at 8:00 AM to sync.');
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
      await scheduleWeeklyNotification(
        'weekly',
        1,
        9,
        0,
        '📈 Your Weekly Sleep Insights Are Ready',
        'Check your SOMNiA weekly sleep report to see how you performed!'
      );
      Alert.alert('✅ Insights Active', 'You will receive your weekly sleep report every Sunday at 9:00 AM.');
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

      {/* Notifications List */}
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

      {/* Notification Settings Modal */}
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
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Master "All Notifications" Card */}
              <View style={styles.masterRowCard}>
                <View style={[styles.modalIconContainer, { backgroundColor: '#7b61ff' }]}>
                  <Ionicons name="notifications" size={20} color="#ffffff" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.masterTitle}>All Notifications</Text>
                  <Text style={styles.masterDesc}>
                    Quickly turn all alerts on or off together
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3a3a5a', true: '#7b61ff' }}
                  thumbColor={isAllEnabled ? '#fff' : '#f4f3f4'}
                  onValueChange={toggleAllNotifications}
                  value={isAllEnabled}
                />
              </View>

              <Text style={styles.sectionHeading}>INDIVIDUAL CATEGORIES</Text>

              {/* 1. Bedtime Reminder */}
              <View style={styles.settingRow}>
                <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(123, 97, 255, 0.15)' }]}>
                  <Ionicons name="moon" size={22} color="#7b61ff" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Bedtime Reminder</Text>
                  <Text style={styles.settingDesc}>
                    Wind-down alert auto-synced with your target bedtime goal.
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3a3a5a', true: '#7b61ff' }}
                  thumbColor={bedtimeReminder ? '#fff' : '#f4f3f4'}
                  onValueChange={toggleBedtime}
                  value={bedtimeReminder}
                />
              </View>

              <View style={styles.modalDivider} />

              {/* 2. Recovery Tips */}
              <View style={styles.settingRow}>
                <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                  <Ionicons name="heart-outline" size={22} color="#22c55e" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Recovery Tips</Text>
                  <Text style={styles.settingDesc}>
                    Daily advice at 6:00 PM tailored to your recovery, strain, or schedule.
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3a3a5a', true: '#22c55e' }}
                  thumbColor={recoveryTips ? '#fff' : '#f4f3f4'}
                  onValueChange={toggleRecoveryTips}
                  value={recoveryTips}
                />
              </View>

              <View style={styles.modalDivider} />

              {/* 4. Daily Sync Reminder */}
              <View style={styles.settingRow}>
                <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(67, 233, 123, 0.15)' }]}>
                  <Ionicons name="sync" size={22} color="#43e97b" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Daily Sync Reminder</Text>
                  <Text style={styles.settingDesc}>
                    Reminds you at 8:00 AM to sync last night's sleep data.
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3a3a5a', true: '#43e97b' }}
                  thumbColor={syncReminder ? '#fff' : '#f4f3f4'}
                  onValueChange={toggleSync}
                  value={syncReminder}
                />
              </View>

              <View style={styles.modalDivider} />

              {/* 5. Weekly Insights */}
              <View style={styles.settingRow}>
                <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(255, 140, 66, 0.15)' }]}>
                  <Ionicons name="stats-chart" size={22} color="#ff8c42" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Weekly Insights</Text>
                  <Text style={styles.settingDesc}>
                    Summary report every Sunday morning at 9:00 AM.
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3a3a5a', true: '#ff8c42' }}
                  thumbColor={weeklyInsights ? '#fff' : '#f4f3f4'}
                  onValueChange={toggleInsights}
                  value={weeklyInsights}
                />
              </View>

              {/* Info Note */}
              <View style={styles.modalInfoBox}>
                <Ionicons name="sparkles" size={15} color="#a259ff" />
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
    marginBottom: 8,
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

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1c32',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    paddingBottom: Platform.OS === 'android' ? 24 : 36,
    maxHeight: '90%',
  },
  modalScroll: {
    maxHeight: 480,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
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
    borderColor: 'rgba(123, 97, 255, 0.28)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  masterTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  masterDesc: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 15,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71758c',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  modalIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 16,
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(162, 89, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(162, 89, 255, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    marginBottom: 18,
    gap: 8,
  },
  modalInfoText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    flex: 1,
    lineHeight: 17,
  },
  doneButton: {
    backgroundColor: '#7b61ff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
