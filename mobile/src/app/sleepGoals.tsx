import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { syncBedtimeNotification } from '../utils/notificationService';
import { useNotificationBadge } from '../hooks/useSleepRisk';
import MaterialTimePickerModal from '../components/MaterialTimePickerModal';
import MaterialDurationPickerModal from '../components/MaterialDurationPickerModal';

export default function SleepGoals() {
  const router = useRouter();
  const hasUnread = useNotificationBadge();

  // Navigation & User State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState({ name: 'User', email: '', avatar: '' });

  // Goals State
  const [bedtimeHour, setBedtimeHour] = useState(17); // 5 PM
  const [bedtimeMinute, setBedtimeMinute] = useState(33);
  const [sleepDuration, setSleepDuration] = useState(0.0833); // e.g. 5 mins (or 8h default)
  const [isSaving, setIsSaving] = useState(false);

  // Time & Duration Pickers
  const [showPicker, setShowPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);

  const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';

  useEffect(() => {
    loadGoals();
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const authDataString = await AsyncStorage.getItem('authData');
      if (authDataString) {
        const authData = JSON.parse(authDataString);
        setUserData({
          name: authData.name || 'User',
          email: authData.email || '',
          avatar: authData.avatar || '',
        });
      }

      const token = await AsyncStorage.getItem('token');
      if (token) {
        const userRes = await fetch(`${backendUrl}/api/user/data`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const isCustomized = await AsyncStorage.getItem('profileCustomized');
        const userJson = await userRes.json();
        if (userJson.success && userJson.userData) {
          setUserData((prev) => ({
            name: isCustomized === 'true' && prev.name ? prev.name : userJson.userData.name || 'User',
            email: isCustomized === 'true' && prev.email ? prev.email : userJson.userData.email || '',
            avatar: userJson.userData.avatar || prev.avatar || '',
          }));
        }
      }
    } catch (e) {
      console.log('Failed to load user profile in sleepGoals:', e);
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
      } else {
        // Defaults to 8h 0m if unset
        setBedtimeHour(22);
        setBedtimeMinute(30);
        setSleepDuration(8);
      }

      // 2. Refresh from backend user data if token available
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const res = await fetch(`${backendUrl}/api/user/data`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
      await AsyncStorage.setItem(
        'sleepGoals',
        JSON.stringify({
          bedtimeHour,
          bedtimeMinute,
          sleepDuration,
        })
      );

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

        const formatBedtime = `${bedtimeHour.toString().padStart(2, '0')}:${bedtimeMinute
          .toString()
          .padStart(2, '0')}`;

        const res = await fetch(`${backendUrl}/api/user/update-goals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId,
            sleepGoalBedtime: formatBedtime,
            sleepGoalDuration: sleepDuration,
          }),
        });

        const json = await res.json();
        if (json.success) {
          Toast.show({
            type: 'success',
            text1: 'Goals Saved!',
            text2: 'Your sleep targets have been updated.',
          });
        } else {
          Toast.show({
            type: 'info',
            text1: 'Saved on Device',
            text2: json.message || 'Saved locally.',
          });
        }
      } else {
        Toast.show({
          type: 'success',
          text1: 'Goals Saved Locally',
          text2: 'Sleep targets updated on this device.',
        });
      }
    } catch (e) {
      console.error('Failed to save goals', e);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Saved locally, but sync encountered an error.',
      });
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

  const formatDurationDisplay = () => {
    const hours = Math.floor(sleepDuration);
    const minutes = Math.round((sleepDuration - hours) * 60);
    return `${hours} hrs ${minutes} mins`;
  };

  // Calculate Wake Time based on bedtime + duration
  const calcWakeTime = () => {
    let totalMinutes = Math.round(bedtimeHour * 60 + bedtimeMinute + sleepDuration * 60);
    totalMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    return formatTime(Math.floor(totalMinutes / 60), totalMinutes % 60);
  };

  return (
    <LinearGradient colors={['#101524', '#151a2e', '#1c213a']} style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#101524" />

      {/* ─── Top Header: Exact match across SOMNiA screens ───────────────────── */}
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
            source={
              userData.avatar
                ? { uri: userData.avatar }
                : require('../assets/images/default-avatar.png')
            }
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
            {hasUnread && <View style={styles.badgeDot} />}
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Screen Title & Subtitle ──────────────────────────────────────── */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Sleep Goals</Text>
          <Text style={styles.pageSubtitle}>Set targets for bedtime and rest duration</Text>
        </View>

        {/* ─── 1. Target Bedtime Card ───────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="moon" size={17} color="#a855f7" />
            <Text style={styles.cardTitle}>Target Bedtime</Text>
          </View>

          <TouchableOpacity
            style={styles.recessedBox}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.boxMainValue}>{formatTime(bedtimeHour, bedtimeMinute)}</Text>
            <Text style={styles.boxHint}>Tap to edit</Text>
          </TouchableOpacity>
        </View>

        {/* ─── 2. Sleep Duration Goal Card ──────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="time" size={17} color="#22c55e" />
            <Text style={styles.cardTitle}>Sleep Duration Goal</Text>
          </View>

          <TouchableOpacity
            style={styles.recessedBox}
            onPress={() => setShowDurationPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.boxMainValue}>{formatDurationDisplay()}</Text>
            <Text style={styles.boxHint}>Tap to edit</Text>
          </TouchableOpacity>
        </View>

        {/* ─── 3. Estimated Wake Time Card (Warm Orange Accent) ─────────────── */}
        <View style={styles.summaryCard}>
          <Ionicons name="sunny" size={26} color="#fb923c" style={{ marginBottom: 6 }} />
          <Text style={styles.summaryLabel}>Estimated Wake Time</Text>
          <Text style={styles.summaryValue}>{calcWakeTime()}</Text>
          <Text style={styles.summaryDesc}>
            Based on your target bedtime and duration goal, you should expect to wake up at this time.
          </Text>
        </View>

        {/* ─── 4. Save Goals Button ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
          onPress={saveGoals}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Goals'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── Material Time Picker Modal for Target Bedtime ───────────────── */}
      <MaterialTimePickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        initialHours={bedtimeHour}
        initialMinutes={bedtimeMinute}
        is24Hour={false}
        onConfirm={(h, m) => {
          setBedtimeHour(h);
          setBedtimeMinute(m);
        }}
      />

      {/* ─── Material Duration Picker Modal for Sleep Duration Goal (media_1795478633764_6af877ff.jpg) ─── */}
      <MaterialDurationPickerModal
        visible={showDurationPicker}
        onClose={() => setShowDurationPicker(false)}
        initialHours={Math.floor(sleepDuration)}
        initialMinutes={Math.round((sleepDuration - Math.floor(sleepDuration)) * 60)}
        onConfirm={(h, m) => {
          setSleepDuration(h + m / 60);
        }}
      />

      {/* ─── Side Menu Drawer Modal ────────────────────────────────────────── */}
      <Modal
        visible={isMenuOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setIsMenuOpen(false)} />
          <View style={styles.drawerContainer}>
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

            <View style={styles.drawerProfileSection}>
              <Image
                source={
                  userData.avatar
                    ? { uri: userData.avatar }
                    : require('../assets/images/default-avatar.png')
                }
                style={styles.drawerAvatar}
              />
              <Text style={styles.drawerUserName} numberOfLines={1}>
                {userData.name || 'SOMNiA User'}
              </Text>
              <Text style={styles.drawerUserEmail} numberOfLines={1}>
                {userData.email || ''}
              </Text>
            </View>

            <View style={styles.drawerDivider} />

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
                <Ionicons name="bar-chart-outline" size={22} color="#a259ff" />
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
                    backgroundColor: 'rgba(162, 89, 255, 0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(162, 89, 255, 0.4)',
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
                <Text style={styles.drawerNavText}>Tips & Recommendations</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace({ pathname: '/home', params: { tab: 'profile' } });
                }}
              >
                <Ionicons name="person-outline" size={22} color="#8a99ad" />
                <Text style={styles.drawerNavText}>My Profile</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 24) + 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    padding: 6,
    marginRight: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#a855f7',
    marginRight: 12,
  },
  greeting: {
    fontSize: 12,
    color: '#8a99ad',
  },
  profileName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationButton: {
    padding: 6,
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  profileButton: {
    padding: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },

  // Title Section
  titleSection: {
    marginBottom: 20,
    marginTop: 4,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#8a99ad',
    marginTop: 4,
  },

  // Cards
  card: {
    backgroundColor: '#161c2e',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
  },
  recessedBox: {
    backgroundColor: '#0f1423',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  boxMainValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  boxHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a855f7',
    marginTop: 4,
  },

  // Estimated Wake Time (Warm / Orange Accent)
  summaryCard: {
    backgroundColor: 'rgba(251, 146, 60, 0.06)',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.22)',
  },
  summaryLabel: {
    fontSize: 13.5,
    color: '#94a3b8',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fb923c',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  summaryDesc: {
    fontSize: 12.5,
    color: '#8a99ad',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },

  // Save Button
  saveButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 14,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  // Drawer
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
});
