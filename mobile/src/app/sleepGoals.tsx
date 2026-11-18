import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  StatusBar,
  Image,
  Modal,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { syncBedtimeNotification } from '../utils/notificationService';
import { useNotificationBadge } from '../hooks/useSleepRisk';

export default function SleepGoals() {
  const router = useRouter();
  const hasNotificationBadge = useNotificationBadge();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState({ name: '', email: '', avatar: '' });

  const [bedtimeHour, setBedtimeHour] = useState(22); // 24h format, 22 = 10 PM
  const [bedtimeMinute, setBedtimeMinute] = useState(30);
  const [sleepDuration, setSleepDuration] = useState(8); // hours
  const [showPicker, setShowPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadGoals();
    loadUserProfile();
  }, []);

  const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';

  const loadUserProfile = async () => {
    try {
      const authDataString = await AsyncStorage.getItem('authData');
      if (authDataString) {
        const authData = JSON.parse(authDataString);
        setUserData({
          name: authData.name || '',
          email: authData.email || '',
          avatar: authData.avatar || '',
        });
      }
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const userRes = await fetch(`${backendUrl}/api/user/data`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const isCustomized = await AsyncStorage.getItem('profileCustomized');
        const userJson = await userRes.json();
        if (userJson.success && userJson.userData) {
          setUserData(prev => ({
            ...prev,
            name: (isCustomized === 'true' && prev.name) ? prev.name : (userJson.userData.name || prev.name),
            email: (isCustomized === 'true' && prev.email) ? prev.email : (userJson.userData.email || prev.email),
            avatar: userJson.userData.avatar || prev.avatar,
          }));
        }
      }
    } catch (e) {
      console.log('Error loading user profile in sleep goals:', e);
    }
  };

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
      {/* Top Bar Navigation */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setIsMenuOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="menu-outline" size={28} color="#fff" />
          </TouchableOpacity>
          <Image
            source={userData.avatar ? { uri: userData.avatar } : require('../assets/images/default-avatar.png')}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.greeting}>Welcome,</Text>
            <Text style={styles.profileName}>{userData.name || 'User'}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={26} color="#fff" />
            {hasNotificationBadge && <View style={styles.badgeDot} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.replace({ pathname: '/home', params: { tab: 'profile' } })}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Title Row */}
      <View style={styles.pageHeaderRow}>
        <Text style={styles.headerTitle}>Sleep Goals</Text>
        <Text style={styles.headerSubtitle}>Set targets for bedtime and rest duration</Text>
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

      {/* Side Menu Drawer Modal */}
      <Modal
        visible={isMenuOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <Pressable
            style={styles.drawerBackdrop}
            onPress={() => setIsMenuOpen(false)}
          />
          <View style={styles.drawerContainer}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <View style={styles.drawerBrand}>
                <Image
                  source={require('../assets/images/somnia.png')}
                  style={styles.drawerLogo}
                  resizeMode="contain"
                />
              </View>
              <TouchableOpacity
                onPress={() => setIsMenuOpen(false)}
                style={styles.drawerCloseButton}
              >
                <Ionicons name="close-outline" size={24} color="#aaa" />
              </TouchableOpacity>
            </View>

            {/* User Profile Info in Drawer */}
            <View style={styles.drawerProfileSection}>
              <Image
                source={userData.avatar ? { uri: userData.avatar } : require('../assets/images/default-avatar.png')}
                style={styles.drawerAvatar}
              />
              <Text style={styles.drawerUserName} numberOfLines={1}>{userData.name || 'SOMNiA User'}</Text>
              <Text style={styles.drawerUserEmail} numberOfLines={1}>{userData.email || ''}</Text>
            </View>

            <View style={styles.drawerDivider} />

            {/* Menu Items */}
            <ScrollView style={styles.drawerNavList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace({ pathname: '/home', params: { tab: 'home' } });
                }}
              >
                <Ionicons name="home-outline" size={22} color="#a259ff" />
                <Text style={styles.drawerNavText}>Home Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/overview');
                }}
              >
                <Ionicons name="pie-chart-outline" size={22} color="#06d6a0" />
                <Text style={styles.drawerNavText}>Sleep Overview</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/sleepReports');
                }}
              >
                <Ionicons name="bar-chart-outline" size={22} color="#3b82f6" />
                <Text style={styles.drawerNavText}>Sleep Reports</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/sleepLog');
                }}
              >
                <Ionicons name="bed-outline" size={22} color="#818cf8" />
                <Text style={styles.drawerNavText}>Sleep Log</Text>
              </TouchableOpacity>

              {/* Active Tab: Sleep Goals */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  {
                    backgroundColor: 'rgba(162, 89, 255, 0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(162, 89, 255, 0.35)',
                  },
                ]}
                onPress={() => setIsMenuOpen(false)}
              >
                <Ionicons name="moon" size={22} color="#a259ff" />
                <Text style={[styles.drawerNavText, { color: '#a259ff', fontWeight: 'bold' }]}>
                  Sleep Goals
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace({ pathname: '/home', params: { tab: 'diary' } });
                }}
              >
                <Ionicons name="book-outline" size={22} color="#43e97b" />
                <Text style={styles.drawerNavText}>Sleep Diary</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace({ pathname: '/home', params: { tab: 'recommendations' } });
                }}
              >
                <Ionicons name="bulb-outline" size={22} color="#ffd166" />
                <Text style={styles.drawerNavText}>Sleep Tips</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Logout Button */}
            <View style={styles.drawerFooter}>
              <TouchableOpacity
                style={styles.drawerLogoutButton}
                onPress={async () => {
                  setIsMenuOpen(false);
                  await AsyncStorage.removeItem('token');
                  await AsyncStorage.removeItem('authData');
                  router.replace('/(auth)/login');
                }}
              >
                <Ionicons name="log-out-outline" size={22} color="#ff4d6d" />
                <Text style={styles.drawerLogoutText}>Log Out</Text>
              </TouchableOpacity>
            </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 48,
    backgroundColor: 'transparent',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    padding: 6,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#a259ff',
  },
  greeting: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  profileName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  notificationButton: {
    position: 'relative',
    padding: 6,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4d6d',
    borderWidth: 1.5,
    borderColor: '#1a1a2e',
  },
  profileButton: {
    padding: 8,
  },
  pageHeaderRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'android' ? 50 : 36,
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
  // Drawer Styles
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  drawerContainer: {
    width: '78%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: '#161c2e',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderRightWidth: 1,
    borderColor: 'rgba(162, 89, 255, 0.25)',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  drawerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerLogo: {
    width: 110,
    height: 32,
  },
  drawerCloseButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  drawerProfileSection: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    marginBottom: 16,
  },
  drawerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#a259ff',
    marginBottom: 10,
  },
  drawerUserName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  drawerUserEmail: {
    color: '#8b9bb4',
    fontSize: 12,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  drawerNavList: {
    flex: 1,
  },
  drawerNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  drawerNavText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 14,
  },
  drawerFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  drawerLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 77, 109, 0.12)',
  },
  drawerLogoutText: {
    color: '#ff4d6d',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 14,
  },
});
