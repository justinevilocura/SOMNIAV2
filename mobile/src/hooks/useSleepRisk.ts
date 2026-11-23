import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';

/**
 * Returns true if the user has unread notifications.
 *
 * How it works (like real mobile apps):
 * 1. Checks which notification categories are currently enabled in settings.
 * 2. Finds the most recent notification time that should have triggered.
 * 3. Compares it against 'lastViewedNotifications' timestamp.
 * 4. If the user viewed the Notifications screen AFTER the latest trigger, badge is hidden.
 * 5. If a new notification has fired since the last view (or never viewed), badge is shown in red.
 */
export const useNotificationBadge = (): boolean => {
  const [hasBadge, setHasBadge] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    let isMounted = true;

    const checkBadge = async () => {
      try {
        const stored = await AsyncStorage.getItem('notificationSettings');
        const settings = stored ? JSON.parse(stored) : {};

        // Check if any notification categories are enabled
        const anyEnabled =
          (settings.bedtimeReminder ?? true) ||
          (settings.riskAlerts ?? true) ||
          (settings.recoveryTips ?? true) ||
          (settings.syncReminder ?? false) ||
          (settings.weeklyInsights ?? false);

        if (!anyEnabled) {
          if (isMounted) setHasBadge(false);
          return;
        }

        const lastViewedStr = await AsyncStorage.getItem('lastViewedNotifications');
        if (!lastViewedStr) {
          // Never opened notifications screen yet -> show badge
          if (isMounted) setHasBadge(true);
          return;
        }

        const lastViewed = new Date(lastViewedStr).getTime();
        const now = new Date();
        const triggerTimes: number[] = [];

        // 1. Bedtime Reminder (based on sleepGoals or 10:30 PM default)
        if (settings.bedtimeReminder ?? true) {
          let bHour = 22;
          let bMin = 30;
          try {
            const goalsStr = await AsyncStorage.getItem('sleepGoals');
            if (goalsStr) {
              const goals = JSON.parse(goalsStr);
              if (goals.bedtimeHour !== undefined) bHour = goals.bedtimeHour;
              if (goals.bedtimeMinute !== undefined) bMin = goals.bedtimeMinute;
            }
          } catch (_) {}

          const todayBedtime = new Date(now);
          todayBedtime.setHours(bHour, bMin, 0, 0);
          if (now.getTime() >= todayBedtime.getTime()) {
            triggerTimes.push(todayBedtime.getTime());
          } else {
            const yesterdayBedtime = new Date(todayBedtime);
            yesterdayBedtime.setDate(yesterdayBedtime.getDate() - 1);
            triggerTimes.push(yesterdayBedtime.getTime());
          }
        }

        // 2. Sleep Updates (10:00 AM daily)
        if (settings.riskAlerts ?? true) {
          const today10 = new Date(now);
          today10.setHours(10, 0, 0, 0);
          if (now.getTime() >= today10.getTime()) {
            triggerTimes.push(today10.getTime());
          } else {
            const yesterday10 = new Date(today10);
            yesterday10.setDate(yesterday10.getDate() - 1);
            triggerTimes.push(yesterday10.getTime());
          }
        }

        // 3. Recovery Tips (6:00 PM daily = 18:00)
        if (settings.recoveryTips ?? true) {
          const today18 = new Date(now);
          today18.setHours(18, 0, 0, 0);
          if (now.getTime() >= today18.getTime()) {
            triggerTimes.push(today18.getTime());
          } else {
            const yesterday18 = new Date(today18);
            yesterday18.setDate(yesterday18.getDate() - 1);
            triggerTimes.push(yesterday18.getTime());
          }
        }

        // 4. Daily Sync Reminder (8:00 AM daily)
        if (settings.syncReminder ?? false) {
          const today8 = new Date(now);
          today8.setHours(8, 0, 0, 0);
          if (now.getTime() >= today8.getTime()) {
            triggerTimes.push(today8.getTime());
          } else {
            const yesterday8 = new Date(today8);
            yesterday8.setDate(yesterday8.getDate() - 1);
            triggerTimes.push(yesterday8.getTime());
          }
        }

        // 5. Weekly Insights (Sunday 9:00 AM)
        if (settings.weeklyInsights ?? false) {
          const sun = new Date(now);
          const day = sun.getDay(); // 0 = Sunday
          sun.setDate(sun.getDate() - day);
          sun.setHours(9, 0, 0, 0);
          if (now.getTime() >= sun.getTime()) {
            triggerTimes.push(sun.getTime());
          }
        }

        const latestTrigger = triggerTimes.length > 0 ? Math.max(...triggerTimes) : 0;

        // Badge is unread if a notification fired AFTER the user last viewed notifications
        const isUnread = latestTrigger > lastViewed;
        if (isMounted) setHasBadge(isUnread);
      } catch {
        // Silently fail on error
      }
    };

    checkBadge();

    return () => {
      isMounted = false;
    };
  }, [isFocused]);

  return hasBadge;
};

// Backwards compatibility alias
export const useSleepRisk = useNotificationBadge;
