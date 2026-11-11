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
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import {
  requestNotificationPermissions,
  syncBedtimeNotification,
  scheduleDailyNotification,
  scheduleWeeklyNotification,
  cancelNotification,
  scheduleSleepUpdateNotification,
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
  hasStrainTrigger?: boolean;
  strainReason?: string;
  loggedDaysInWindow?: number;
  latestNightDuration?: string;
}

const buildNotifications = (stats?: SleepStats): NotificationItem[] => {
  const streak = stats?.streak ?? 0;
  const efficiency = stats?.efficiency ?? 87;
  const avgDuration = stats?.avgDuration || '6h 59m';
  const bedtime = stats?.bedtimeStr || '10:30 PM';
  const hasStrainTrigger = stats?.hasStrainTrigger ?? false;
  const strainReason = stats?.strainReason || 'Triggered by sleep deficit & night strain.';
  const loggedDaysInWindow = stats?.loggedDaysInWindow ?? 3;
  const durationText = stats?.latestNightDuration || avgDuration;

  const items: NotificationItem[] = [];

  // 1. Sleep Risk / Update Card (Adaptive Progression)
  if (loggedDaysInWindow === 0) {
    // Case 0: No sleep recorded in the last 3 days
    items.push({
      id: 'sleep_status',
      type: 'risk',
      title: 'Sleep Update',
      subtitle: 'No sleep recorded in the last 3 days. ',
      highlightText: 'Sync Needed',
      highlightColor: '#7b61ff',
      date: formatToday('10:00 AM'),
      detail:
        'We have not detected recent sleep data from your smartwatch. Wear your device to bed tonight and pull down to sync so SOMNiA can evaluate your sleep risk and recovery score!',
      icon: 'shield-checkmark-outline',
      iconBg: '#10b981',
    });
  } else if (loggedDaysInWindow === 1) {
    // Case 1: 1 day recorded in the 3-day window
    const isOptimal = efficiency >= 85;
    items.push({
      id: 'sleep_status',
      type: 'risk',
      title: 'Sleep Update (Day 1 of 3)',
      subtitle: 'Based on last night ',
      highlightText: `(${durationText}).`,
      highlightColor: isOptimal ? '#10b981' : '#f59e0b',
      date: formatToday('10:00 AM'),
      detail: `You recorded ${durationText} of sleep last night (${efficiency}% efficiency). A single night is not enough to determine insomnia risk. Log 2 more nights to unlock your official 3-day Sleep Risk assessment!`,
      icon: isOptimal ? 'shield-checkmark-outline' : 'moon-outline',
      iconBg: isOptimal ? '#10b981' : '#7b61ff',
    });
  } else if (loggedDaysInWindow === 2) {
    // Case 2: 2 days recorded in the 3-day window
    const isOptimal = efficiency >= 85;
    items.push({
      id: 'sleep_status',
      type: 'risk',
      title: 'Sleep Update (Day 2 of 3)',
      subtitle: 'Based on the last 2 days ',
      highlightText: `(${avgDuration} avg).`,
      highlightColor: isOptimal ? '#10b981' : '#f59e0b',
      date: formatToday('10:00 AM'),
      detail: `Your average sleep duration is ${avgDuration} across 2 days (${efficiency}% efficiency). You need just 1 more night to complete your official 3-day Sleep Risk assessment!`,
      icon: isOptimal ? 'shield-checkmark-outline' : 'moon-outline',
      iconBg: isOptimal ? '#10b981' : '#7b61ff',
    });
  } else {
    // Case 3: Full 3-day window recorded
    if (efficiency >= 85) {
      items.push({
        id: 'sleep_status',
        type: 'risk',
        title: 'Sleep Update',
        subtitle: 'Your sleep consistency is ',
        highlightText: 'Optimal.',
        highlightColor: '#10b981',
        date: formatToday('10:00 AM'),
        detail: `Your average sleep efficiency reached ${efficiency}% over the last 3 days (${avgDuration} avg). Great job maintaining an optimal, restorative sleep schedule!`,
        icon: 'shield-checkmark-outline',
        iconBg: '#10b981',
      });
    } else if (efficiency < 65) {
      items.push({
        id: 'sleep_status',
        type: 'risk',
        title: 'Risk Alert',
        subtitle: 'Your sleep risk is now ',
        highlightText: 'High.',
        highlightColor: '#ef4444',
        date: formatToday('10:00 AM'),
        detail: `Your average sleep efficiency dropped to ${efficiency}% (${avgDuration} avg) over the last 3 days. High sleep deficit and awakenings detected. Prioritize winding down earlier tonight.`,
        icon: 'warning-outline',
        iconBg: '#ef4444',
      });
    } else {
      items.push({
        id: 'sleep_status',
        type: 'risk',
        title: 'Risk Alert',
        subtitle: 'Your sleep risk is now ',
        highlightText: 'Moderate.',
        highlightColor: '#f59e0b',
        date: formatToday('10:00 AM'),
        detail: `Your average sleep efficiency is ${efficiency}% (${avgDuration} avg) over the last 3 days. Consider winding down 30 minutes earlier to reduce night awakenings.`,
        icon: 'warning-outline',
        iconBg: '#eb5757',
      });
    }
  }

  // 2. Bedtime Reminder Card (dynamically reflects confirmed consecutive streak)
  let streakSentence = 'Log your sleep tonight to start your healthy sleep streak!';
  if (streak === 1) {
    streakSentence = "You've logged your sleep last night — keep the streak going!";
  } else if (streak > 1) {
    streakSentence = `You've logged your sleep ${streak} nights in a row — keep the streak going!`;
  }

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

  // 3. Recovery Tip Card (Always visible when Recovery Tips is enabled, with smart contextual messaging)
  const tipSubtitle =
    hasStrainTrigger && loggedDaysInWindow > 0
      ? strainReason
      : 'Try 10-minute breathing exercise before bed.';

  const introText =
    hasStrainTrigger && loggedDaysInWindow > 0
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
    icon: 'heart-outline',
    iconBg: '#22c55e',
  });

  return items;
};

export default function NotificationsScreen() {
  const router = useRouter();

  // Individual notification category states
  const [bedtimeReminder, setBedtimeReminder] = useState(true);
  const [riskAlerts, setRiskAlerts] = useState(true);
  const [recoveryTips, setRecoveryTips] = useState(true);
  const [syncReminder, setSyncReminder] = useState(false);
  const [weeklyInsights, setWeeklyInsights] = useState(false);

  const [permGranted, setPermGranted] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => buildNotifications());

  // Master switch state (true if all active)
  const isAllEnabled =
    bedtimeReminder && riskAlerts && recoveryTips && syncReminder && weeklyInsights;

  useEffect(() => {
    initScreen();
    fetchSleepStats();
  }, []);

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
        setRiskAlerts(parsed.riskAlerts ?? true);
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
      // 1. Get user bedtime goal
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

      // 2. Fetch sleep history from backend
      const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        setNotifications(buildNotifications({ bedtimeStr }));
        return;
      }

      const response = await fetch(`${backendUrl}/api/sleepSession/history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const json = await response.json();

      if (json.success && json.data && json.data.sessions) {
        let totalHours = 0;
        let daysWithSleep = 0;
        let latestNightHours = 0;

        // 1. Gather sleep duration for each of the last 7 calendar days
        const dailyRecords: { date: Date; hours: number }[] = [];

        for (let i = 6; i >= 0; i--) {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() - i);

          const sessionsForDay = json.data.sessions.filter((session: any) => {
            const sessionDate = new Date(session.endTime || session.startTime);
            return sessionDate.toDateString() === targetDate.toDateString();
          });

          let dayHours = 0;
          sessionsForDay.forEach((s: any) => {
            if (s.durationHours) {
              dayHours += s.durationHours;
            } else if (s.durationMinutes) {
              dayHours += s.durationMinutes / 60;
            } else if (s.startTime && s.endTime) {
              const start = new Date(s.startTime).getTime();
              const end = new Date(s.endTime).getTime();
              if (end > start) {
                dayHours += (end - start) / (1000 * 60 * 60);
              }
            }
          });

          const validHours = dayHours > 0 && dayHours < 16 ? dayHours : 0;
          dailyRecords.push({ date: targetDate, hours: validHours });
          if (validHours > 0) {
            latestNightHours = validHours;
          }
        }

        // 2. Calculate strictly the LAST 3 DAYS average (Today, Yesterday, 2 Days Ago)
        const recent3Days = dailyRecords.slice(-3);
        const loggedInLast3 = recent3Days.filter((d) => d.hours > 0);
        const loggedDaysInWindow = loggedInLast3.length;

        let threeDayAvgVal = 0;
        if (loggedDaysInWindow > 0) {
          const threeDayTotal = loggedInLast3.reduce((sum, d) => sum + d.hours, 0);
          threeDayAvgVal = threeDayTotal / loggedDaysInWindow;
        }

        const avgH = Math.floor(threeDayAvgVal);
        const avgM = Math.round((threeDayAvgVal - avgH) * 60);
        const formattedAvg = avgM > 0 ? `${avgH}h ${avgM}m` : `${avgH}h`;

        let efficiency = threeDayAvgVal > 0 ? (threeDayAvgVal / 8) * 100 : 0;
        efficiency = Math.min(100, Math.round(efficiency));

        const lH = Math.floor(latestNightHours);
        const lM = Math.round((latestNightHours - lH) * 60);
        const latestNightDuration = lM > 0 ? `${lH}h ${lM}m` : `${lH}h`;

        // Biometric trigger condition for Recovery Tip:
        // Appears if recent 3-day efficiency is below 82% OR latest night was short (< 6.2 hours)
        const hasStrain = loggedDaysInWindow > 0 && (efficiency < 82 || (latestNightHours > 0 && latestNightHours < 6.2));
        let strainReason = 'Triggered by sleep deficit & night strain.';
        if (latestNightHours > 0 && latestNightHours < 6.0) {
          strainReason = `Triggered by short sleep (${latestNightDuration} last night).`;
        } else if (efficiency < 82) {
          strainReason = `Triggered by sleep efficiency drop (${efficiency}%).`;
        }

        // Calculate verified consecutive days logged streak
        const hasSessionOnDay = (daysAgo: number) => {
          const d = new Date();
          d.setDate(d.getDate() - daysAgo);
          return json.data.sessions.some((session: any) => {
            const sDate = new Date(session.endTime || session.startTime);
            return sDate.toDateString() === d.toDateString();
          });
        };

        let verifiedStreak = 0;
        // Start from today if woke up and logged today, otherwise start from yesterday
        const loggedToday = hasSessionOnDay(0);
        const startDay = loggedToday ? 0 : 1;

        for (let d = startDay; d < 30; d++) {
          if (hasSessionOnDay(d)) {
            verifiedStreak++;
          } else {
            break; // unbroken streak stopped
          }
        }

        setNotifications(
          buildNotifications({
            streak: verifiedStreak,
            avgDuration: formattedAvg,
            efficiency: efficiency,
            bedtimeStr,
            hasStrainTrigger: hasStrain,
            strainReason,
            loggedDaysInWindow,
            latestNightDuration,
          })
        );

        // Schedule the 10:00 AM Sleep Update push with fresh risk data
        await scheduleSleepUpdateNotification(efficiency, loggedDaysInWindow);

        return;
      }
    } catch (err) {
      console.warn('Could not fetch dynamic sleep stats for notifications:', err);
    }

    setNotifications(buildNotifications());
    // No data available — schedule a "sync needed" push
    await scheduleSleepUpdateNotification(0, 0);
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
    setRiskAlerts(value);
    setRecoveryTips(value);
    setSyncReminder(value);
    setWeeklyInsights(value);

    await saveSettings({
      bedtimeReminder: value,
      riskAlerts: value,
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

  const toggleRiskAlerts = async (value: boolean) => {
    setRiskAlerts(value);
    await saveSettings({ riskAlerts: value });
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
      Alert.alert('✅ Recovery Tips Active', 'Smart tips will appear when physiological strain or sleep deficit is detected.');
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
    if (item.type === 'risk' && !riskAlerts) return false;
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

              {/* 2. Sleep Updates */}
              <View style={styles.settingRow}>
                <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#10b981" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Sleep Updates</Text>
                  <Text style={styles.settingDesc}>
                    Daily sleep status updates and risk alerts based on your 3-day trend.
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3a3a5a', true: '#10b981' }}
                  thumbColor={riskAlerts ? '#fff' : '#f4f3f4'}
                  onValueChange={toggleRiskAlerts}
                  value={riskAlerts}
                />
              </View>

              <View style={styles.modalDivider} />

              {/* 3. Recovery Tips */}
              <View style={styles.settingRow}>
                <View style={[styles.modalIconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                  <Ionicons name="heart-outline" size={22} color="#22c55e" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Recovery Tips</Text>
                  <Text style={styles.settingDesc}>
                    Smart relaxation advice when sleep fatigue or strain is detected.
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
