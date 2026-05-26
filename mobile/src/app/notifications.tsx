import { View, Text, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';

export default function Notifications() {
  const router = useRouter();
  const [bedtimeReminder, setBedtimeReminder] = useState(true);
  const [syncReminder, setSyncReminder] = useState(true);
  const [weeklyInsights, setWeeklyInsights] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('notificationSettings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        setBedtimeReminder(parsed.bedtimeReminder ?? true);
        setSyncReminder(parsed.syncReminder ?? true);
        setWeeklyInsights(parsed.weeklyInsights ?? false);
      }
    } catch (e) {
      console.error('Failed to load notification settings', e);
    }
  };

  const saveSettings = async (newSettings: any) => {
    try {
      const current = await AsyncStorage.getItem('notificationSettings');
      const parsed = current ? JSON.parse(current) : {};
      const updated = { ...parsed, ...newSettings };
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save notification settings', e);
    }
  };

  const toggleBedtime = (value: boolean) => {
    setBedtimeReminder(value);
    saveSettings({ bedtimeReminder: value });
  };

  const toggleSync = (value: boolean) => {
    setSyncReminder(value);
    saveSettings({ syncReminder: value });
  };

  const toggleInsights = (value: boolean) => {
    setWeeklyInsights(value);
    saveSettings({ weeklyInsights: value });
  };

  return (
    <LinearGradient colors={['#1a1a2e', '#23234b']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace({ pathname: '/home', params: { tab: 'profile' } })} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="moon" size={24} color="#a259ff" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.settingTitle}>Bedtime Reminders</Text>
              <Text style={styles.settingDesc}>Get alerted 30 minutes before your target bedtime.</Text>
            </View>
            <Switch
              trackColor={{ false: '#3a3a5a', true: '#a259ff' }}
              thumbColor={bedtimeReminder ? '#fff' : '#f4f3f4'}
              onValueChange={toggleBedtime}
              value={bedtimeReminder}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="sync" size={24} color="#43e97b" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.settingTitle}>Daily Sync Reminder</Text>
              <Text style={styles.settingDesc}>Remind me to sync my health data every morning.</Text>
            </View>
            <Switch
              trackColor={{ false: '#3a3a5a', true: '#43e97b' }}
              thumbColor={syncReminder ? '#fff' : '#f4f3f4'}
              onValueChange={toggleSync}
              value={syncReminder}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="stats-chart" size={24} color="#ff8c42" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.settingTitle}>Weekly Insights</Text>
              <Text style={styles.settingDesc}>Receive a push notification when weekly AI insights are ready.</Text>
            </View>
            <Switch
              trackColor={{ false: '#3a3a5a', true: '#ff8c42' }}
              thumbColor={weeklyInsights ? '#fff' : '#f4f3f4'}
              onValueChange={toggleInsights}
              value={weeklyInsights}
            />
          </View>
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
    paddingTop: 60,
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  settingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 10,
  },
});
