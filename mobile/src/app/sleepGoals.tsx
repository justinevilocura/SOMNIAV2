import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { syncBedtimeNotification } from '../utils/notificationService';

export default function SleepGoals() {
  const router = useRouter();

  const [bedtimeHour, setBedtimeHour] = useState(22); // 24h format, 22 = 10 PM
  const [bedtimeMinute, setBedtimeMinute] = useState(30);
  const [sleepDuration, setSleepDuration] = useState(8); // hours
  const [showPicker, setShowPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';

  const loadGoals = async () => {
    try {
      // 1. Try local cache first for instant rendering
      const stored = await AsyncStorage.getItem('sleepGoals');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.bedtimeHour !== undefined) setBedtimeHour(parsed.bedtimeHour);
        if (parsed.bedtimeMinute !== undefined) setBedtimeMinute(parsed.bedtimeMinute);
        if (parsed.sleepDuration !== undefined) setSleepDuration(parsed.sleepDuration);
      }

      // 2. Refresh from backend user data if token available
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const res = await fetch(`${backendUrl}/api/user/data`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const json = await res.json();
        if (json.success && json.userData) {
          if (json.userData.sleepGoalBedtime) {
            const [hStr, mStr] = json.userData.sleepGoalBedtime.split(':');
            const h = parseInt(hStr, 10);
            const m = parseInt(mStr, 10);
            if (!isNaN(h) && !isNaN(m)) {
              setBedtimeHour(h);
              setBedtimeMinute(m);
            }
          }
          if (json.userData.sleepGoalDuration) {
            setSleepDuration(Number(json.userData.sleepGoalDuration));
          }
        }
      }
    } catch (e) {
      console.log('Failed to load goals:', e);
    }
  };

  const saveGoals = async () => {
    try {
      setIsSaving(true);
      await AsyncStorage.setItem('sleepGoals', JSON.stringify({
        bedtimeHour,
        bedtimeMinute,
        sleepDuration
      }));

      // Automatically sync bedtime notification schedule if reminder is active
      try {
        await syncBedtimeNotification(bedtimeHour, bedtimeMinute);
      } catch (notifErr) {
        console.log('Error auto-syncing notification:', notifErr);
      }

      // Sync to backend
      const token = await AsyncStorage.getItem('token');
      const authDataString = await AsyncStorage.getItem('authData');

      if (token) {
        let userId = undefined;
        if (authDataString) {
          try {
            const authData = JSON.parse(authDataString);
            userId = authData.user_id || authData.id || authData._id;
          } catch (_) {}
        }

        const formatBedtime = `${bedtimeHour.toString().padStart(2, '0')}:${bedtimeMinute.toString().padStart(2, '0')}`;

        const res = await fetch(`${backendUrl}/api/user/update-goals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId,
            sleepGoalBedtime: formatBedtime,
            sleepGoalDuration: sleepDuration
          })
        });

        const json = await res.json();
        if (json.success) {
          Toast.show({ type: 'success', text1: 'Goals Saved!', text2: 'Your sleep targets have been updated.' });
        } else {
          Toast.show({ type: 'info', text1: 'Saved on Device', text2: json.message || 'Saved locally.' });
        }
      } else {
        Toast.show({ type: 'success', text1: 'Goals Saved Locally', text2: 'Sleep targets updated on this device.' });
      }

      router.replace({ pathname: '/home', params: { tab: 'profile' } });
    } catch (e) {
      console.error('Failed to save goals', e);
      Toast.show({ type: 'error', text1: 'Save Failed', text2: 'Saved locally, but sync encountered an error.' });
      router.replace({ pathname: '/home', params: { tab: 'profile' } });
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (h: number, m: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    const displayM = m < 10 ? `0${m}` : m;
    return `${displayH}:${displayM} ${ampm}`;
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) {
      setBedtimeHour(selectedDate.getHours());
      setBedtimeMinute(selectedDate.getMinutes());
    }
  };

  const getBedtimeDate = () => {
    const d = new Date();
    d.setHours(bedtimeHour, bedtimeMinute, 0, 0);
    return d;
  };

  const getDurationDate = () => {
    const d = new Date();
    const hours = Math.floor(sleepDuration);
    const minutes = Math.round((sleepDuration - hours) * 60);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const onDurationChange = (event: any, selectedDate?: Date) => {
    setShowDurationPicker(false);
    if (selectedDate) {
      const h = selectedDate.getHours();
      const m = selectedDate.getMinutes();
      setSleepDuration(h + m / 60);
    }
  };

  const formatDurationDisplay = () => {
    const hours = Math.floor(sleepDuration);
    const minutes = Math.round((sleepDuration - hours) * 60);
    if (minutes === 0) return `${hours} hrs`;
    return `${hours} hrs ${minutes} mins`;
  };

  // Calculate Wake Time based on bedtime + duration
  const calcWakeTime = () => {
    let totalMinutes = Math.round((bedtimeHour * 60) + bedtimeMinute + (sleepDuration * 60));
    totalMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    return formatTime(Math.floor(totalMinutes / 60), totalMinutes % 60);
  };

  return (
    <LinearGradient colors={['#1a1a2e', '#23234b']} style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.replace({ pathname: '/home', params: { tab: 'profile' } })} 
          style={styles.backButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          accessibilityLabel="Back to Profile"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sleep Goals</Text>
      </View>

      {/* Scrollable content so it never overflows or gets cut off */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Target Bedtime Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="moon" size={18} color="#a259ff" />
            <Text style={styles.cardTitle}>Target Bedtime</Text>
          </View>

          <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.timePickerBtn}>
            <Text style={styles.timeValue}>{formatTime(bedtimeHour, bedtimeMinute)}</Text>
            <Text style={styles.editHint}>Tap to edit</Text>
          </TouchableOpacity>

          {showPicker && (
            <DateTimePicker
              value={getBedtimeDate()}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={onTimeChange}
            />
          )}
        </View>

        {/* Sleep Duration Goal Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={18} color="#43e97b" />
            <Text style={styles.cardTitle}>Sleep Duration Goal</Text>
          </View>

          <TouchableOpacity onPress={() => setShowDurationPicker(true)} style={styles.timePickerBtn}>
            <Text style={styles.timeValue}>{formatDurationDisplay()}</Text>
            <Text style={styles.editHint}>Tap to edit</Text>
          </TouchableOpacity>

          {showDurationPicker && (
            <DateTimePicker
              value={getDurationDate()}
              mode="time"
              is24Hour={true}
              display="spinner"
              onChange={onDurationChange}
            />
          )}
        </View>

        {/* Estimated Wake Time Card */}
        <View style={styles.summaryCard}>
          <Ionicons name="sunny" size={24} color="#ff8c42" style={{ marginBottom: 4 }} />
          <Text style={styles.summaryLabel}>Estimated Wake Time</Text>
          <Text style={styles.summaryValue}>{calcWakeTime()}</Text>
          <Text style={styles.summaryDesc}>
            Based on your target bedtime and duration goal, you should expect to wake up at this time.
          </Text>
        </View>

        {/* Save Goals Button - positioned cleanly above navigation bar */}
        <TouchableOpacity 
          style={[styles.saveButton, isSaving && { opacity: 0.7 }]} 
          onPress={saveGoals}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Goals'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 6,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'android' ? 50 : 36, // Ample breathing room above system navigation bar
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  timePickerBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(162, 89, 255, 0.25)',
    width: '100%',
  },
  editHint: {
    fontSize: 11,
    color: '#a259ff',
    marginTop: 3,
    fontWeight: '600',
  },
  timeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 140, 66, 0.08)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 66, 0.25)',
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ff8c42',
    marginBottom: 6,
  },
  summaryDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  saveButton: {
    backgroundColor: '#5d3fd3',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5d3fd3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
});
