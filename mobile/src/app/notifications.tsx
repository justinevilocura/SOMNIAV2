import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
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
  syncAllNotifications,
} from '../utils/notificationService';

export default function NotificationsScreen() {
  const router = useRouter();
  const [bedtimeReminder, setBedtimeReminder] = useState(false);
  const [syncReminder, setSyncReminder] = useState(false);
  const [weeklyInsights, setWeeklyInsights] = useState(false);
  const [permGranted, setPermGranted] = useState(false);

  useEffect(() => {
    initScreen();
  }, []);

  const initScreen = async () => {
    // 1. Request permissions & setup notification channel
    const granted = await requestNotificationPermissions();
    setPermGranted(granted);
    if (!granted) {
      Alert.alert(
        'Notifications Disabled',
        'Please enable notifications in your phone Settings to receive sleep reminders.',
        [{ text: 'OK' }]
      );
    }

    // 2. Load saved toggle states
    try {
      const stored = await AsyncStorage.getItem('notificationSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        setBedtimeReminder(parsed.bedtimeReminder ?? false);
        setSyncReminder(parsed.syncReminder ?? false);
        setWeeklyInsights(parsed.weeklyInsights ?? false);
      }
    } catch (e) {
      console.error('Failed to load notification settings', e);
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

  // --- Toggle handlers ---

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
      // Fetch bedtime hour & min
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
        8, // 8:00 AM every morning
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
        1, // Sunday
        9, // 9:00 AM
        0,
        '📈 Your Weekly Sleep Insights Are Ready',
        'Check your SOMNiA weekly sleep report to see how you performed!'
      );
      Alert.alert('✅ Insights Active', 'You will receive your weekly sleep report every Sunday at 9:00 AM.');
    } else {
      await cancelNotification('weekly');
    }
  };

  return (
    <LinearGradient colors={['#1a1a2e', '#23234b']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace({ pathname: '/home', params: { tab: 'profile' } })}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {/* Permission warning banner */}
      {!permGranted && (
        <View style={styles.permBanner}>
          <Ionicons name="warning-outline" size={16} color="#ff8c42" />
          <Text style={styles.permBannerText}>
            Notifications are disabled. Enable them in Settings to use reminders.
          </Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.settingCard}>

          {/* Bedtime Reminder */}
          <View style={styles.settingRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="moon" size={24} color="#a259ff" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.settingTitle}>Bedtime Reminder</Text>
              <Text style={styles.settingDesc}>
                Get alerted daily at your target bedtime. Auto-updates when you change Sleep Goals!
              </Text>
            </View>
            <Switch
              trackColor={{ false: '#3a3a5a', true: '#a259ff' }}
              thumbColor={bedtimeReminder ? '#fff' : '#f4f3f4'}
              onValueChange={toggleBedtime}
              value={bedtimeReminder}
            />
          </View>

          <View style={styles.divider} />

          {/* Daily Sync Reminder */}
          <View style={styles.settingRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="sync" size={24} color="#43e97b" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.settingTitle}>Daily Sync Reminder</Text>
              <Text style={styles.settingDesc}>
                Remind me to sync my health data every morning at 8:00 AM.
              </Text>
            </View>
            <Switch
              trackColor={{ false: '#3a3a5a', true: '#43e97b' }}
              thumbColor={syncReminder ? '#fff' : '#f4f3f4'}
              onValueChange={toggleSync}
              value={syncReminder}
            />
          </View>

          <View style={styles.divider} />

          {/* Weekly Insights */}
          <View style={styles.settingRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="stats-chart" size={24} color="#ff8c42" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.settingTitle}>Weekly Insights</Text>
              <Text style={styles.settingDesc}>
                Get notified every Sunday at 9:00 AM when your weekly sleep analysis is ready.
              </Text>
            </View>
            <Switch
              trackColor={{ false: '#3a3a5a', true: '#ff8c42' }}
              thumbColor={weeklyInsights ? '#fff' : '#f4f3f4'}
              onValueChange={toggleInsights}
              value={weeklyInsights}
            />
          </View>

        </View>

        {/* Info note */}
        <View style={styles.infoBox}>
          <Ionicons name="sparkles" size={16} color="#a259ff" />
          <Text style={styles.infoText}>
            Bedtime reminders automatically sync with whatever bedtime you save in Sleep Goals.
          </Text>
        </View>
      </View>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 48,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  permBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 140, 66, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 66, 0.3)',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  permBannerText: {
    color: '#ff8c42',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  settingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 10,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  infoText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    flex: 1,
    lineHeight: 17,
  },
});
