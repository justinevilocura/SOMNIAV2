import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Foreground presentation settings
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
      channelId: NOTIF_CHANNEL_ID,
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
      channelId: NOTIF_CHANNEL_ID,
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
 * Sync all 3 notifications (Bedtime, Daily Sync, Weekly Insights)
 * based on saved settings in AsyncStorage.
 */
export const syncAllNotifications = async () => {
  try {
    const settingsStr = await AsyncStorage.getItem('notificationSettings');
    if (!settingsStr) return;
    const settings = JSON.parse(settingsStr);

    // 1. Bedtime Reminder
    if (settings.bedtimeReminder) {
      await syncBedtimeNotification();
    } else {
      await cancelNotification('bedtime');
    }

    // 2. Daily Sync Reminder (8:00 AM)
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

    // 3. Weekly Insights (Sunday 9:00 AM)
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

