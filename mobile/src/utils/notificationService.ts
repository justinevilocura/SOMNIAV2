import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Foreground presentation settings
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const NOTIF_IDS_KEY = 'scheduledNotifIds';
export const NOTIF_CHANNEL_ID = 'somnia-alerts';

/** Initialize notification channel for Android (required for Android 8+) */
export const setupNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIF_CHANNEL_ID, {
      name: 'SOMNiA Sleep Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#a259ff',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }
};

/** Request Android/iOS notification permissions */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  await setupNotificationChannel();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

/** Cancel a stored notification by key */
export const cancelNotification = async (key: string) => {
  try {
    const stored = await AsyncStorage.getItem(NOTIF_IDS_KEY);
    const ids = stored ? JSON.parse(stored) : {};
    if (ids[key]) {
      await Notifications.cancelScheduledNotificationAsync(ids[key]);
      delete ids[key];
      await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(ids));
    }
  } catch (e) {
    console.error(`Failed to cancel notification [${key}]:`, e);
  }
};

/** Save notification ID under key */
const saveNotificationId = async (key: string, id: string) => {
  try {
    const stored = await AsyncStorage.getItem(NOTIF_IDS_KEY);
    const ids = stored ? JSON.parse(stored) : {};
    ids[key] = id;
    await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error(`Failed to save notification ID [${key}]:`, e);
  }
};

/** Schedule a recurring daily notification at hour:minute */
export const scheduleDailyNotification = async (
  key: string,
  hour: number,
  minute: number,
  title: string,
  body: string
) => {
  await setupNotificationChannel();
  await cancelNotification(key);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: NOTIF_CHANNEL_ID,
    },
  });

  await saveNotificationId(key, id);
  return id;
};

/** Schedule a recurring weekly notification (1=Sun, 2=Mon... 7=Sat) */
export const scheduleWeeklyNotification = async (
  key: string,
  weekday: number,
  hour: number,
  minute: number,
  title: string,
  body: string
) => {
  await setupNotificationChannel();
  await cancelNotification(key);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour,
      minute,
      channelId: NOTIF_CHANNEL_ID,
    },
  });

  await saveNotificationId(key, id);
  return id;
};

/**
 * Schedule a daily 10:00 AM Sleep Update push notification.
 * Message adapts based on the user's current 3-day sleep efficiency and data availability.
 * Should be called each time fresh sleep data is loaded (e.g. on Notifications screen mount).
 * Only schedules if the riskAlerts setting is enabled.
 *
 * @param efficiency  - 3-day avg efficiency as a percentage (0–100). Pass 0 if no data.
 * @param loggedDays  - Number of days with sleep logged in the last 3-day window.
 */
export const scheduleSleepUpdateNotification = async (
  efficiency: number,
  loggedDays: number
) => {
  try {
    // Check if the Sleep Updates toggle is enabled
    const settingsStr = await AsyncStorage.getItem('notificationSettings');
    const settings = settingsStr ? JSON.parse(settingsStr) : {};
    if (!settings.riskAlerts) {
      await cancelNotification('sleepUpdate');
      return;
    }

    let title: string;
    let body: string;

    if (loggedDays === 0) {
      // No data at all — prompt to sync
      title = '🛌 Sleep Update';
      body = 'No recent sleep data detected. Wear your smartwatch tonight and sync SOMNiA to track your sleep risk.';
    } else if (loggedDays < 3) {
      // Partial data — building towards full assessment
      title = '🌙 Sleep Update';
      body = `${loggedDays} of 3 nights logged. Keep syncing to unlock your full 3-day sleep risk assessment!`;
    } else if (efficiency >= 85) {
      // Optimal sleep
      title = '✅ Sleep Update — Optimal';
      body = `Your 3-day sleep efficiency is ${efficiency}%. Great job — keep up the routine!`;
    } else if (efficiency >= 65) {
      // Moderate risk
      title = '⚠️ Sleep Update — Moderate Risk';
      body = `Your 3-day sleep efficiency is ${efficiency}%. Some strain detected — check your SOMNiA report for recovery tips.`;
    } else {
      // High risk
      title = '🔴 Sleep Alert — High Risk';
      body = `Your 3-day sleep efficiency is critically low (${efficiency}%). Open SOMNiA now to review your sleep trend and risk assessment.`;
    }

    await scheduleDailyNotification('sleepUpdate', 10, 0, title, body);
  } catch (e) {
    console.error('scheduleSleepUpdateNotification error:', e);
  }
};

/** Send an immediate test notification to verify device alerts work */
export const sendTestNotification = async () => {
  await setupNotificationChannel();
  const granted = await requestNotificationPermissions();
  if (!granted) {
    throw new Error('Notification permission denied. Please allow notifications in phone Settings.');
  }

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: '🌙 SOMNiA Alert',
      body: 'Notifications are working! You will receive daily sleep reminders and tips.',
      sound: 'default',
    },
    trigger: null,
  });
};

/**
 * Reschedule the Bedtime reminder using given or stored hour and minute.
 * Only schedules if bedtimeReminder toggle is enabled in settings.
 */
export const syncBedtimeNotification = async (hourOverride?: number, minuteOverride?: number) => {
  try {
    const settingsStr = await AsyncStorage.getItem('notificationSettings');
    const settings = settingsStr ? JSON.parse(settingsStr) : {};

    // If disabled, ensure it is cancelled
    if (!settings.bedtimeReminder) {
      await cancelNotification('bedtime');
      return;
    }

    let h = hourOverride;
    let m = minuteOverride;

    if (h === undefined || m === undefined) {
      const goalsStr = await AsyncStorage.getItem('sleepGoals');
      if (goalsStr) {
        const goals = JSON.parse(goalsStr);
        if (goals.bedtimeHour !== undefined) h = goals.bedtimeHour;
        if (goals.bedtimeMinute !== undefined) m = goals.bedtimeMinute;
      }
    }

    h = h ?? 22;
    m = m ?? 30;

    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    const displayM = m < 10 ? `0${m}` : m;

    await scheduleDailyNotification(
      'bedtime',
      h,
      m,
      '🌙 Bedtime Reminder',
      `It's ${displayH}:${displayM} ${ampm} — time to wind down and get ready for restful sleep.`
    );
  } catch (e) {
    console.error('syncBedtimeNotification error:', e);
  }
};

/**
 * Sync all notifications based on saved settings in AsyncStorage.
 */
export const syncAllNotifications = async () => {
  try {
    const settingsStr = await AsyncStorage.getItem('notificationSettings');
    if (!settingsStr) return;
    const settings = JSON.parse(settingsStr);

    // 1. Permanently cancel legacy 8:00 PM sleepReminder
    await cancelNotification('sleepReminder');
    if (settings.sleepReminder !== undefined) {
      delete settings.sleepReminder;
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(settings));
    }

    // 2. Bedtime Reminder (triggers at your actual target bedtime)
    if (settings.bedtimeReminder) {
      await syncBedtimeNotification();
    } else {
      await cancelNotification('bedtime');
    }

    // 3. Sleep Updates (10:00 AM) — message is set dynamically by scheduleSleepUpdateNotification()
    // when fresh sleep data is loaded. Here we only cancel if the toggle is off.
    if (!settings.riskAlerts) {
      await cancelNotification('sleepUpdate');
    }

    // 4. Recovery Tips (6:00 PM)
    if (settings.recoveryTips) {
      await scheduleDailyNotification(
        'recoveryTips',
        18,
        0,
        '🌿 Sleep Recovery Tip',
        'Try 10-minute breathing exercise before bed to slow down your heart rate.'
      );
    } else {
      await cancelNotification('recoveryTips');
    }

    // 4. Daily Sync Reminder (8:00 AM)
    if (settings.syncReminder) {
      await scheduleDailyNotification(
        'sync',
        8,
        0,
        '📊 Daily Sync Reminder',
        'Open SOMNiA to sync your sleep and heart rate data from last night.'
      );
    } else {
      await cancelNotification('sync');
    }

    // 5. Weekly Insights (Sunday 9:00 AM)
    if (settings.weeklyInsights) {
      await scheduleWeeklyNotification(
        'weekly',
        1, // Sunday
        9,
        0,
        '📈 Your Weekly Sleep Insights Are Ready',
        'Check your SOMNiA weekly sleep report to see how you performed!'
      );
    } else {
      await cancelNotification('weekly');
    }
  } catch (e) {
    console.error('syncAllNotifications error:', e);
  }
};
