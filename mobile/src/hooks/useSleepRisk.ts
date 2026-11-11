import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Returns true if the user has at least one notification category enabled.
 * Used to show/hide the solid red badge dot on the bell icon in the header.
 * Covers: Sleep Updates, Bedtime Reminder, Recovery Tips, Daily Sync, Weekly Insights.
 */
export const useNotificationBadge = (): boolean => {
  const [hasBadge, setHasBadge] = useState(false);

  useEffect(() => {
    const checkSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem('notificationSettings');
        if (!stored) {
          // Default state: notifications active by default
          setHasBadge(true);
          return;
        }
        const settings = JSON.parse(stored);
        const anyEnabled =
          (settings.bedtimeReminder ?? true) ||
          (settings.riskAlerts ?? true) ||
          (settings.recoveryTips ?? true) ||
          (settings.syncReminder ?? false) ||
          (settings.weeklyInsights ?? false);
        setHasBadge(Boolean(anyEnabled));
      } catch {
        // Silently fail — no badge shown on error
      }
    };

    checkSettings();
  }, []);

  return hasBadge;
};

// Backwards compatibility alias
export const useSleepRisk = useNotificationBadge;
