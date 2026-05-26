import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function SleepGoals() {
  const router = useRouter();
  
  const [bedtimeHour, setBedtimeHour] = useState(22); // 24h format, 22 = 10 PM
  const [bedtimeMinute, setBedtimeMinute] = useState(30);
  const [sleepDuration, setSleepDuration] = useState(8); // hours
  const [showPicker, setShowPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const stored = await AsyncStorage.getItem('sleepGoals');
      if (stored) {
        const parsed = JSON.parse(stored);
        setBedtimeHour(parsed.bedtimeHour ?? 22);
        setBedtimeMinute(parsed.bedtimeMinute ?? 30);
        setSleepDuration(parsed.sleepDuration ?? 8);
      }
    } catch (e) {
      console.error('Failed to load goals', e);
    }
  };

  const backendUrl = 'http://172.20.10.2:4000';

  const saveGoals = async () => {
    try {
      await AsyncStorage.setItem('sleepGoals', JSON.stringify({
        bedtimeHour,
        bedtimeMinute,
        sleepDuration
      }));

      // Sync to backend
      const token = await AsyncStorage.getItem('token');
      const authDataString = await AsyncStorage.getItem('authData');
      
      if (token && authDataString) {
        const authData = JSON.parse(authDataString);
        const userId = authData.user_id;
        
        const formatBedtime = `${bedtimeHour.toString().padStart(2, '0')}:${bedtimeMinute.toString().padStart(2, '0')}`;
        
        await fetch(`${backendUrl}/api/user/update-goals`, {
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
      }

      Toast.show({ type: 'success', text1: 'Goals Synced to Cloud!', text2: 'Your sleep targets have been updated.' });
      router.replace({ pathname: '/home', params: { tab: 'profile' } });
    } catch (e) {
      console.error('Failed to save goals', e);
      Toast.show({ type: 'error', text1: 'Sync Failed', text2: 'Saved locally, but failed to sync to cloud.' });
      router.replace({ pathname: '/home', params: { tab: 'profile' } });
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
    let totalMinutes = (bedtimeHour * 60) + bedtimeMinute + (sleepDuration * 60);
    if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;
    return formatTime(Math.floor(totalMinutes / 60), totalMinutes % 60);
  };

  return (
    <LinearGradient colors={['#1a1a2e', '#23234b']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace({ pathname: '/home', params: { tab: 'profile' } })} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sleep Goals</Text>
      </View>

      <View style={styles.content}>
        
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="moon" size={24} color="#5d3fd3" />
            <Text style={styles.cardTitle}>Target Bedtime</Text>
          </View>
          
          <View style={[styles.controlRow, { justifyContent: 'center' }]}>
            <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.timePickerBtn}>
              <Text style={styles.timeValue}>{formatTime(bedtimeHour, bedtimeMinute)}</Text>
              <Text style={styles.editHint}>Tap to edit</Text>
            </TouchableOpacity>
          </View>

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

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={24} color="#43e97b" />
            <Text style={styles.cardTitle}>Sleep Duration Goal</Text>
          </View>
          
          <View style={[styles.controlRow, { justifyContent: 'center' }]}>
            <TouchableOpacity onPress={() => setShowDurationPicker(true)} style={styles.timePickerBtn}>
              <Text style={styles.timeValue}>{formatDurationDisplay()}</Text>
              <Text style={styles.editHint}>Tap to edit</Text>
            </TouchableOpacity>
          </View>

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

        <View style={styles.summaryCard}>
          <Ionicons name="sunny" size={32} color="#ff8c42" style={{marginBottom: 10}} />
          <Text style={styles.summaryLabel}>Estimated Wake Time</Text>
          <Text style={styles.summaryValue}>{calcWakeTime()}</Text>
          <Text style={styles.summaryDesc}>Based on your target bedtime and duration goal, you should expect to wake up at this time.</Text>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={saveGoals}>
          <Text style={styles.saveButtonText}>Save Goals</Text>
        </TouchableOpacity>

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
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'center'
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerBtn: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(93, 63, 211, 0.3)',
    width: '100%',
  },
  editHint: {
    fontSize: 12,
    color: '#5d3fd3',
    marginTop: 5,
    fontWeight: 'bold',
  },
  timeValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 140, 66, 0.1)',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 66, 0.3)',
  },
  summaryLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ff8c42',
    marginBottom: 10,
  },
  summaryDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: '#5d3fd3',
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
