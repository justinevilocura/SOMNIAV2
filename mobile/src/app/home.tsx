import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import React, { useEffect, useState, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import styles from '../assets/styles/home.styles';
import LinearGradient from 'react-native-linear-gradient';
import SleepReco from './sleepReco';
import Diary from './diary';
import Profile from './profile';
import Tips from './tips';
import AppleHealthKit from 'react-native-health';
import { ExerciseType, SleepStageType } from '../utils/healthCompatibility';
import { useExerciseSession } from '../hooks/useExerciseSession';
import { useHeartRate } from '../hooks/useHeartRate';
import { useSleepSession } from '../hooks/useSleepSession';
import { useSteps } from '../hooks/useSteps';
import { syncToDB } from '../utils/syncToDB';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationBadge } from '../hooks/useSleepRisk';

const screenWidth = Dimensions.get('window').width;

export default function Home() {
  const router = useRouter();
  const hasNotificationBadge = useNotificationBadge();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState({ name: '', email: '', user_id: '', avatar: '' });

  const { readExerciseSession } = useExerciseSession(new Date());
  const { readHeartRate } = useHeartRate(new Date());
  const { readSleepSession } = useSleepSession(new Date());
  const { readSteps } = useSteps(new Date());

  const [heartRateData, setHeartRateData] = useState<any[]>([]);
  const [sleepDataRaw, setSleepDataRaw] = useState<any[]>([]);
  const [stepsData, setStepsData] = useState<any[]>([]);
  const [exerciseDataRaw, setExerciseDataRaw] = useState<any[]>([]);
  const [exerSession, setExerSession] = useState('No record of activity for today');
  const [exerType, setExerType] = useState('None');
  const [latestHeartRate, setLatestHeartRate] = useState(0);
  const [totalSleepHours, setTotalSleepHours] = useState('0 hours and 0 minutes');
  const [totalSteps, setTotalSteps] = useState(0);
  const [lastSyncTimeStr, setLastSyncTimeStr] = useState('Never synced');
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState('home');
  const params = useLocalSearchParams();

  // Sleep Stages Card Breakdown State
  const [sleepStageBreakdown, setSleepStageBreakdown] = useState({
    hasData: false,
    bedtimeStr: '',
    wakeTimeStr: '',
    totalSleepFormatted: '',
    totalSleepMs: 0,
    efficiency: 0,
    deepMs: 0,
    remMs: 0,
    lightMs: 0,
    awakeMs: 0,
    wakeUpCount: 0,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSleepModal, setShowSleepModal] = useState(false);

  // ─── HealthKit Permissions & Data Fetching ──────────────────────────────────
  const fetchHealthData = async (shouldSync = false, silent = false) => {
    let currentUserId = userData.user_id;
    const authDataString = await AsyncStorage.getItem('authData');
    if (authDataString) {
      const authData = JSON.parse(authDataString);
      currentUserId = authData.user_id || currentUserId;
      setUserData({
        name: authData.name || 'User',
        email: authData.email || '',
        user_id: authData.user_id || '',
        avatar: authData.avatar || '',
      });
    }

    // Refresh user profile details from backend
    const token = await AsyncStorage.getItem('token');
    if (token) {
      try {
        const backendUrl =
          process.env.EXPO_PUBLIC_BACKEND_URL ||
          process.env.EXPO_PUBLIC_API_URL ||
          'https://somniav2-production.up.railway.app';
        const userRes = await fetch(`${backendUrl}/api/user/data`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const userJson = await userRes.json();
        if (userJson.success && userJson.userData) {
          const updated = {
            name: userJson.userData.name || 'User',
            email: userJson.userData.email || '',
            user_id: userJson.userData._id || currentUserId,
            avatar: userJson.userData.avatar || '',
          };
          setUserData(updated);
          currentUserId = updated.user_id;
        }
      } catch (_) {}
    }

    let isInitialized = false;
    let steps: any[] = [];
    let heartRate: any[] = [];
    let sleep: any[] = [];
    let exerciseSession: any[] = [];

    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.StepCount,
          AppleHealthKit.Constants.Permissions.HeartRate,
          AppleHealthKit.Constants.Permissions.SleepAnalysis,
          AppleHealthKit.Constants.Permissions.Workout,
        ],
        write: [],
      },
    };

    const initHealth = (): Promise<boolean> => {
      return new Promise((resolve) => {
        AppleHealthKit.initHealthKit(permissions, (error) => {
          if (error) {
            console.warn('[ERROR] Cannot grant Apple HealthKit permissions:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    };

    try {
      isInitialized = await initHealth();
      if (isInitialized) {
        steps = (await readSteps()) || [];
        heartRate = (await readHeartRate()) || [];
        sleep = (await readSleepSession()) || [];
        exerciseSession = (await readExerciseSession()) || [];
      }
    } catch (error) {
      console.warn('Apple Health error:', error);
    }

    // ─── EXERCISE / ACTIVITY LOGIC ──────────────────────────────────────────
    setExerciseDataRaw(exerciseSession || []);
    let lastExerciseSession: any = null;
    if (exerciseSession && exerciseSession.length > 0) {
      const todayStr = new Date().toDateString();
      const todayExercises = exerciseSession.filter((session: any) => {
        const sessionDate = new Date(session.startTime).toDateString();
        return sessionDate === todayStr;
      });

      if (todayExercises.length > 0) {
        lastExerciseSession = todayExercises.sort(
          (a: any, b: any) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
        )[0];
      }

      if (lastExerciseSession) {
        const start = new Date(lastExerciseSession.startTime);
        const end = new Date(lastExerciseSession.endTime);
        const totalExerciseMs = end.getTime() - start.getTime();
        const totalMinutes = Math.floor(totalExerciseMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        let formattedExercise = '';
        if (hours > 0 && minutes > 0) formattedExercise = `${hours}h ${minutes}m`;
        else if (hours > 0) formattedExercise = `${hours}h`;
        else if (minutes > 0) formattedExercise = `${minutes}m`;
        else formattedExercise = '< 1m';

        setExerSession(formattedExercise);
        const activity = lastExerciseSession.activityName || 'Workout';
        setExerType(activity.charAt(0).toUpperCase() + activity.slice(1));
      } else {
        setExerSession('No record of activity for today');
        setExerType('None');
      }
    } else {
      setExerSession('No record of activity for today');
      setExerType('None');
    }

    // ─── STEPS LOGIC ────────────────────────────────────────────────────────
    let totalStepsCount = 0;
    setStepsData(steps || []);
    let selectedSteps = steps || [];

    if (steps && steps.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todaySteps = steps.filter((step: any) => {
        const stepTime = new Date(step.startTime);
        return stepTime >= today;
      });

      if (todaySteps.length > 0) {
        selectedSteps = todaySteps;
        totalStepsCount = todaySteps.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);
      } else {
        const latestStep = steps.sort(
          (a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )[0];
        if (latestStep) {
          selectedSteps = [latestStep];
          totalStepsCount = latestStep.count || 0;
        }
      }
    }
    setTotalSteps(totalStepsCount);

    // ─── SLEEP & SLEEP STAGES LOGIC ─────────────────────────────────────────
    setSleepDataRaw(sleep || []);
    let lastSleepSession: any = null;

    if (sleep && sleep.length > 0) {
      const relevantSessions = sleep;
      lastSleepSession = relevantSessions.sort(
        (a: any, b: any) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
      )[0];

      if (lastSleepSession) {
        const latestEndDate = new Date(lastSleepSession.endTime).toDateString();
        const latestStartDate = new Date(lastSleepSession.startTime).toDateString();
        const nightSessions = relevantSessions.filter((s: any) => {
          const sEnd = new Date(s.endTime).toDateString();
          const sStart = new Date(s.startTime).toDateString();
          return sEnd === latestEndDate || sStart === latestEndDate || sEnd === latestStartDate;
        });

        let allStages: any[] = [];
        nightSessions.forEach((session: any) => {
          if (session?.stages && session.stages.length > 0) {
            allStages = allStages.concat(session.stages.filter(Boolean));
          }
        });

        let deepMs = 0;
        let remMs = 0;
        let lightMs = 0;
        let awakeMs = 0;
        let wakeUpCount = 0;
        let totalSleepMs = 0;

        if (allStages.length > 0) {
          allStages.forEach((stage: any) => {
            const sStart = new Date(stage.startTime).getTime();
            const sEnd = new Date(stage.endTime).getTime();
            const dur = Math.max(0, sEnd - sStart);

            if (stage.stage !== SleepStageType.AWAKE && stage.stage !== SleepStageType.OUT_OF_BED) {
              totalSleepMs += dur;
            }

            switch (stage.stage) {
              case SleepStageType.DEEP:
                deepMs += dur;
                break;
              case SleepStageType.REM:
                remMs += dur;
                break;
              case SleepStageType.LIGHT:
              case SleepStageType.SLEEPING:
                lightMs += dur;
                break;
              case SleepStageType.AWAKE:
              case SleepStageType.OUT_OF_BED:
                awakeMs += dur;
                wakeUpCount += 1;
                break;
              default:
                lightMs += dur;
                break;
            }
          });
        }

        if (totalSleepMs === 0 && lastSleepSession?.startTime && lastSleepSession?.endTime) {
          const start = new Date(lastSleepSession.startTime);
          const end = new Date(lastSleepSession.endTime);
          totalSleepMs = Math.max(0, end.getTime() - start.getTime());
          lightMs = Math.round(totalSleepMs * 0.55);
          deepMs = Math.round(totalSleepMs * 0.20);
          remMs = Math.round(totalSleepMs * 0.20);
          awakeMs = Math.round(totalSleepMs * 0.05);
        }

        const totalMinutes = Math.floor(totalSleepMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const totalSleepFormatted = `${hours} hours and ${minutes} minutes`;
        setTotalSleepHours(totalSleepFormatted);

        // Bedtime and Wake-up timing strings
        const validStarts = nightSessions.map((s: any) => new Date(s.startTime).getTime()).filter(Boolean);
        const validEnds = nightSessions.map((s: any) => new Date(s.endTime).getTime()).filter(Boolean);
        const earliestStart = new Date(Math.min(...validStarts));
        const latestEnd = new Date(Math.max(...validEnds));

        const formatTime = (d: Date) =>
          d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

        // Calculate accurate Sleep Efficiency = (Asleep Time / Total Time in Bed) * 100
        const totalTimeInBedMs = Math.max(1, latestEnd.getTime() - earliestStart.getTime());
        const calculatedEfficiency = Math.min(100, Math.max(0, Math.round((totalSleepMs / totalTimeInBedMs) * 100)));

        setSleepStageBreakdown({
          hasData: true,
          bedtimeStr: formatTime(earliestStart),
          wakeTimeStr: formatTime(latestEnd),
          totalSleepFormatted,
          totalSleepMs,
          efficiency: calculatedEfficiency,
          deepMs,
          remMs,
          lightMs,
          awakeMs,
          wakeUpCount,
        });

        // Cache for Sleep Recommendations & Notifications
        try {
          AsyncStorage.setItem('homeSleepFormatted', totalSleepFormatted);
          AsyncStorage.setItem('homeSleepEfficiency', calculatedEfficiency.toString());
          AsyncStorage.setItem('homeWakeTimeStr', formatTime(latestEnd));
          AsyncStorage.setItem('homeBedtimeStr', formatTime(earliestStart));
        } catch (_) {}
      }
    } else {
      setTotalSleepHours('0 hours and 0 minutes');
      setSleepStageBreakdown({
        hasData: false,
        bedtimeStr: '',
        wakeTimeStr: '',
        totalSleepFormatted: '0 hours and 0 minutes',
        totalSleepMs: 0,
        efficiency: 0,
        deepMs: 0,
        remMs: 0,
        lightMs: 0,
        awakeMs: 0,
        wakeUpCount: 0,
      });
    }

    // ─── HEART RATE LOGIC ───────────────────────────────────────────────────
    setHeartRateData(heartRate || []);
    if (lastExerciseSession && heartRate && heartRate.length > 0) {
      const allSamples = heartRate.flatMap((record: any) =>
        record?.samples && Array.isArray(record.samples) ? record.samples : []
      );
      const validSamples = allSamples.filter(
        (s: any) => s?.time && typeof s.beatsPerMinute === 'number'
      );

      if (validSamples.length > 0 && lastExerciseSession.startTime && lastExerciseSession.endTime) {
        const sessionStart = new Date(lastExerciseSession.startTime).getTime();
        const sessionEnd = new Date(lastExerciseSession.endTime).getTime();

        const sessionSamples = validSamples.filter((s: any) => {
          const t = new Date(s.time).getTime();
          return t >= sessionStart && t <= sessionEnd;
        });

        if (sessionSamples.length > 0) {
          const sum = sessionSamples.reduce((acc: number, curr: any) => acc + (curr.beatsPerMinute || 0), 0);
          setLatestHeartRate(Math.floor(sum / sessionSamples.length));
        } else if (lastExerciseSession.averageHeartRate) {
          setLatestHeartRate(Math.round(lastExerciseSession.averageHeartRate));
        } else {
          setLatestHeartRate(0);
        }
      } else if (lastExerciseSession.averageHeartRate) {
        setLatestHeartRate(Math.round(lastExerciseSession.averageHeartRate));
      } else {
        setLatestHeartRate(0);
      }
    } else if (lastExerciseSession?.averageHeartRate) {
      setLatestHeartRate(Math.round(lastExerciseSession.averageHeartRate));
    } else {
      setLatestHeartRate(0);
    }

    // Cloud Sync
    if (shouldSync && currentUserId) {
      try {
        if (!silent) Toast.show({ type: 'info', text1: 'Syncing to Cloud...', text2: 'Please wait' });
        await syncToDB(heartRate, sleep, selectedSteps, exerciseSession, currentUserId);
        const now = Date.now();
        setLastSyncTimestamp(now);
        setLastSyncTimeStr('Just now');
        // Persist so the banner survives app restarts
        await AsyncStorage.setItem('somnia_last_sync_ts', String(now));
        if (!silent) Toast.show({ type: 'success', text1: 'Synced to Web', text2: 'Health data saved to cloud!' });
      } catch (error: any) {
        console.error('syncToDB error:', error);
        if (!silent) Toast.show({ type: 'error', text1: 'Sync Failed', text2: error.message || 'Could not sync' });
      }
    }
  };

  useEffect(() => {
    if (params.tab) {
      setSelectedTab(params.tab.toString());
    }
  }, [params.tab]);

  useEffect(() => {
    const initializeAndLoad = async () => {
      const authDataString = await AsyncStorage.getItem('authData');
      if (authDataString) {
        const authData = JSON.parse(authDataString);
        setUserData({
          name: authData.name || 'User',
          email: authData.email || '',
          user_id: authData.user_id || '',
          avatar: authData.avatar || '',
        });
      }

      // Restore last sync timestamp so the "X ago" banner is live across restarts
      const savedTs = await AsyncStorage.getItem('somnia_last_sync_ts');
      if (savedTs) {
        const ts = parseInt(savedTs, 10);
        if (!isNaN(ts)) {
          setLastSyncTimestamp(ts);
          // formatAgo inline so the initial label is correct before the useEffect fires
          const diff = Math.floor((Date.now() - ts) / 1000);
          if (diff < 60) setLastSyncTimeStr('Just now');
          else if (diff < 3600) setLastSyncTimeStr(`${Math.floor(diff / 60)} min ago`);
          else if (diff < 86400) setLastSyncTimeStr(`${Math.floor(diff / 3600)}h ago`);
          else setLastSyncTimeStr(`${Math.floor(diff / 86400)}d ago`);
        }
      }

      setTimeout(async () => {
        try {
          await fetchHealthData(false);
        } catch (e) {
          console.warn('Initial fetchHealthData error:', e);
        }
      }, 500);
    };
    initializeAndLoad();
  }, []);

  // ─── Sync banner "X ago" timer ──────────────────────────────────────────────
  useEffect(() => {
    if (!lastSyncTimestamp) return;
    const formatAgo = () => {
      const diff = Math.floor((Date.now() - lastSyncTimestamp) / 1000);
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    };
    setLastSyncTimeStr(formatAgo());
    const interval = setInterval(() => setLastSyncTimeStr(formatAgo()), 60000);
    return () => clearInterval(interval);
  }, [lastSyncTimestamp]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    try {
      // Silent: fetch latest HealthKit data + sync to cloud, no toasts shown
      await fetchHealthData(true, true);
    } catch (e) {
      console.warn('Pull-to-refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const hasExerciseToday = exerType !== 'None' && exerSession !== 'No record of activity for today';
  const hasStepsToday = totalSteps > 0;
  const hasSleepToday = totalSleepHours !== '0 hours and 0 minutes';
  const hasHeartRateToday = latestHeartRate > 0;

  // Telemetry Cards
  const statBoxes = [
    {
      label: hasExerciseToday ? exerSession : 'No record of activity for today',
      value: hasExerciseToday ? exerType : 'None',
      unit: '',
      icon: 'barbell-outline',
      color: '#ff8c42',
    },
    {
      label: 'latest total steps',
      value: totalSteps.toLocaleString(),
      unit: '',
      icon: 'walk-outline',
      color: '#43e97b',
    },
    {
      label: 'Latest Sleep Hours',
      value: totalSleepHours,
      unit: '',
      icon: 'moon-outline',
      color: '#5d3fd3',
    },
    {
      label: 'latest session avg BPM',
      value: latestHeartRate,
      unit: 'BPM',
      icon: 'heart-outline',
      color: '#ff4d6d',
    },
  ];

  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return '0h 0m';
    const mins = Math.round(ms / (1000 * 60));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  return (
    <LinearGradient colors={['#101524', '#151a2e', '#1c213a']} style={styles.background}>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
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
            style={styles.notificationBellWrapper}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={26} color="#fff" />
            {hasNotificationBadge && <View style={styles.badgeDot} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => setSelectedTab('profile')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#a259ff', '#3b82f6']}
            progressBackgroundColor="#23234b"
            tintColor="#a259ff"
          />
        }
      >
        {selectedTab === 'home' && (
          <>
            {/* ─── Sync Status Banner ── */}
            <View style={{
              marginHorizontal: 16,
              marginBottom: 16,
              backgroundColor: '#161c2e',
              borderRadius: 20,
              paddingVertical: 12,
              paddingLeft: 16,
              paddingRight: 8,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(162, 89, 255, 0.2)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: lastSyncTimestamp ? '#10b981' : '#6b7280', marginRight: 8 }} />
                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>
                  Synced to Web • <Text style={{ color: '#94a3b8', fontWeight: '500' }}>{lastSyncTimeStr}</Text>
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => fetchHealthData(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(109, 40, 217, 0.4)',
                  paddingVertical: 9,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(162, 89, 255, 0.5)',
                }}
              >
                <Ionicons name="cloud-upload-outline" size={16} color="#c084fc" style={{ marginRight: 6 }} />
                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>Sync Cloud</Text>
              </TouchableOpacity>
            </View>

            {/* ─── Sleep Efficiency & Timing Card (Image 1) ─────────────────── */}
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <View style={{
                backgroundColor: '#161c2e',
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(162, 89, 255, 0.2)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}>
                {/* Header: Title and Efficiency Pill */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: '#d8b4fe', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>
                    SLEEP EFFICIENCY & TIMING
                  </Text>
                  {/* Efficiency Pill (calculated live from Apple HealthKit) */}
                  <View style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                  }}>
                    <Text style={{ color: '#34d399', fontSize: 12, fontWeight: '700' }}>
                      {sleepStageBreakdown.hasData && sleepStageBreakdown.efficiency > 0
                        ? `${sleepStageBreakdown.efficiency}% Efficiency`
                        : '-- Efficiency'}
                    </Text>
                  </View>
                </View>

                {/* Bedtime -> Wake Time Large Display */}
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 16 }}>
                  {sleepStageBreakdown.bedtimeStr && sleepStageBreakdown.wakeTimeStr
                    ? `${sleepStageBreakdown.bedtimeStr} → ${sleepStageBreakdown.wakeTimeStr}`
                    : '-- : -- → -- : --'}
                </Text>

                {/* Proportional Stage Color Bar */}
                {(() => {
                  const hasStages = sleepStageBreakdown.hasData &&
                    (sleepStageBreakdown.deepMs + sleepStageBreakdown.remMs + sleepStageBreakdown.lightMs + sleepStageBreakdown.awakeMs) > 0;

                  const total = hasStages
                    ? (sleepStageBreakdown.deepMs + sleepStageBreakdown.remMs + sleepStageBreakdown.lightMs + sleepStageBreakdown.awakeMs)
                    : 1;
                  const deepPct = hasStages ? Math.round((sleepStageBreakdown.deepMs / total) * 100) : 0;
                  const remPct = hasStages ? Math.round((sleepStageBreakdown.remMs / total) * 100) : 0;
                  const lightPct = hasStages ? Math.round((sleepStageBreakdown.lightMs / total) * 100) : 0;
                  const awakePct = hasStages ? Math.max(0, 100 - deepPct - remPct - lightPct) : 0;

                  return (
                    <>
                      <View style={{
                        height: 12,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderRadius: 6,
                        flexDirection: 'row',
                        overflow: 'hidden',
                        marginBottom: 12,
                      }}>
                        {hasStages ? (
                          <>
                            <View style={{ flex: deepPct, backgroundColor: '#3b82f6' }} />
                            <View style={{ flex: remPct, backgroundColor: '#a855f7' }} />
                            <View style={{ flex: lightPct, backgroundColor: '#38bdf8' }} />
                            <View style={{ flex: awakePct, backgroundColor: '#f87171' }} />
                          </>
                        ) : (
                          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                        )}
                      </View>

                      {/* Stage Legend Dots */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', marginRight: 5 }} />
                          <Text style={{ color: '#e2e8f0', fontSize: 11, fontWeight: '600' }}>Deep {hasStages ? `${deepPct}%` : '--'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#a855f7', marginRight: 5 }} />
                          <Text style={{ color: '#e2e8f0', fontSize: 11, fontWeight: '600' }}>REM {hasStages ? `${remPct}%` : '--'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#38bdf8', marginRight: 5 }} />
                          <Text style={{ color: '#e2e8f0', fontSize: 11, fontWeight: '600' }}>Light {hasStages ? `${lightPct}%` : '--'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f87171', marginRight: 5 }} />
                          <Text style={{ color: '#e2e8f0', fontSize: 11, fontWeight: '600' }}>Awake {hasStages ? `${awakePct}%` : '--'}</Text>
                        </View>
                      </View>
                    </>
                  );
                })()}

                {/* View Details Link → opens Sleep Stage Breakdown Modal */}
                <TouchableOpacity
                  onPress={() => setShowSleepModal(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}
                >
                  <Text style={{ color: '#c084fc', fontSize: 13, fontWeight: '700', marginRight: 4 }}>View Details</Text>
                  <Ionicons name="chevron-forward" size={14} color="#c084fc" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ─── Navigation Buttons: Sleep Overview & Log Sleep (Image 1) ──── */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 20 }}>
              <TouchableOpacity
                onPress={() => router.push('/overview')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#7c3aed',
                  paddingVertical: 14,
                  borderRadius: 14,
                  marginRight: 8,
                }}
              >
                <Ionicons name="pulse" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Sleep Overview</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/sleepLog')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#1e2438',
                  paddingVertical: 14,
                  borderRadius: 14,
                  marginLeft: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(162, 89, 255, 0.25)',
                }}
              >
                <Ionicons name="add" size={20} color="#c084fc" style={{ marginRight: 6 }} />
                <Text style={{ color: '#c084fc', fontSize: 15, fontWeight: '700' }}>Log Sleep</Text>
              </TouchableOpacity>
            </View>

            {/* ─── Section Header: Live Wearable Telemetry ───────────────────── */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginBottom: 12 }}>
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 }}>
                LIVE WEARABLE TELEMETRY
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 6 }} />
                <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600' }}>Apple Health</Text>
              </View>
            </View>

            {/* ─── 4 Telemetry Stat Boxes (Android style: tinted bg + colored border) ── */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16 }}>
              {statBoxes.map((box, idx) => (
                <View
                  key={idx}
                  style={{
                    width: '48%',
                    backgroundColor: box.color + '22',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: box.color + '55',
                    minHeight: 145,
                  }}
                >
                  <Ionicons name={box.icon} size={28} color={box.color} style={{ marginBottom: 6 }} />
                  <Text
                    style={{
                      fontSize: typeof box.value === 'string' && box.value.length > 8 ? 16 : 22,
                      fontWeight: '800',
                      color: box.color,
                      marginBottom: 4,
                      textAlign: 'center',
                    }}
                  >
                    {box.value}{box.unit ? ' ' : ''}<Text style={{ fontSize: 13, fontWeight: '600' }}>{box.unit}</Text>
                  </Text>
                  <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: '500', opacity: 0.8 }}>
                    {box.label}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {selectedTab === 'recommendations' && (
          <SleepReco
            key={`tips-${refreshKey}`}
            latestSleepFormatted={totalSleepHours}
            latestSleepMs={sleepStageBreakdown.totalSleepMs}
            efficiency={sleepStageBreakdown.efficiency}
          />
        )}
        {selectedTab === 'diary' && <Diary key={`diary-${refreshKey}`} />}
        {selectedTab === 'profile' && <Profile key={`profile-${refreshKey}`} />}
      </ScrollView>

      {/* ─── Sleep Stage Breakdown Modal (opens from "View Details >") ─── */}
      <Modal
        visible={showSleepModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSleepModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          onPress={() => setShowSleepModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: '#131929',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              paddingBottom: 36,
            }}
            onPress={() => {}}
          >
            {/* Drag handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 }} />

            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
              <View style={{
                width: 42, height: 42, borderRadius: 10,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                justifyContent: 'center', alignItems: 'center', marginRight: 12,
              }}>
                <Ionicons name="layers" size={22} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Sleep Stage Breakdown</Text>
                <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>Latest session composition & timing</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSleepModal(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Sleep Timing Card */}
            <View style={{
              backgroundColor: '#1a2235',
              borderRadius: 16,
              padding: 16,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: 'rgba(162, 89, 255, 0.2)',
            }}>
              {/* Title row + efficiency pill */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ color: '#d8b4fe', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>SLEEP TIMING</Text>
                <View style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: 12,
                  borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)',
                }}>
                  <Text style={{ color: '#34d399', fontSize: 12, fontWeight: '700' }}>
                    {sleepStageBreakdown.hasData && sleepStageBreakdown.efficiency > 0
                      ? `${sleepStageBreakdown.efficiency}% Efficiency`
                      : '-- Efficiency'}
                  </Text>
                </View>
              </View>

              {/* Bed → Wake time */}
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 }}>
                {sleepStageBreakdown.bedtimeStr && sleepStageBreakdown.wakeTimeStr
                  ? `${sleepStageBreakdown.bedtimeStr} → ${sleepStageBreakdown.wakeTimeStr}`
                  : '-- → --'}
              </Text>

              {/* Stage color bar */}
              {(() => {
                const hasStages = sleepStageBreakdown.hasData &&
                  (sleepStageBreakdown.deepMs + sleepStageBreakdown.remMs + sleepStageBreakdown.lightMs + sleepStageBreakdown.awakeMs) > 0;
                const total = hasStages
                  ? (sleepStageBreakdown.deepMs + sleepStageBreakdown.remMs + sleepStageBreakdown.lightMs + sleepStageBreakdown.awakeMs)
                  : 1;
                const deepPct = hasStages ? Math.round((sleepStageBreakdown.deepMs / total) * 100) : 0;
                const remPct = hasStages ? Math.round((sleepStageBreakdown.remMs / total) * 100) : 0;
                const lightPct = hasStages ? Math.round((sleepStageBreakdown.lightMs / total) * 100) : 0;
                const awakePct = hasStages ? Math.max(0, 100 - deepPct - remPct - lightPct) : 0;
                return (
                  <View style={{ height: 10, borderRadius: 5, flexDirection: 'row', overflow: 'hidden', marginBottom: 12 }}>
                    {hasStages ? (
                      <>
                        <View style={{ flex: deepPct, backgroundColor: '#3b82f6' }} />
                        <View style={{ flex: remPct, backgroundColor: '#a855f7' }} />
                        <View style={{ flex: lightPct, backgroundColor: '#38bdf8' }} />
                        <View style={{ flex: awakePct, backgroundColor: '#f87171' }} />
                      </>
                    ) : (
                      <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                    )}
                  </View>
                );
              })()}

              {/* Total Duration */}
              <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                Total Duration: <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {sleepStageBreakdown.totalSleepFormatted || '0 hours and 0 minutes'}
                </Text>
              </Text>
            </View>

            {/* 4 Stage Cards Grid */}
            {(() => {
              const total = (sleepStageBreakdown.deepMs + sleepStageBreakdown.remMs + sleepStageBreakdown.lightMs + sleepStageBreakdown.awakeMs) || 1;
              const deepPct = Math.round((sleepStageBreakdown.deepMs / total) * 100) || 0;
              const remPct = Math.round((sleepStageBreakdown.remMs / total) * 100) || 0;
              const lightPct = Math.round((sleepStageBreakdown.lightMs / total) * 100) || 0;
              const awakePct = Math.max(0, 100 - deepPct - remPct - lightPct);

              const stages = [
                {
                  name: 'Deep Sleep', color: '#3b82f6',
                  time: formatDuration(sleepStageBreakdown.deepMs),
                  pct: `${deepPct}%`,
                  desc: 'Tissue repair & physical recovery',
                },
                {
                  name: 'REM Sleep', color: '#a855f7',
                  time: formatDuration(sleepStageBreakdown.remMs),
                  pct: `${remPct}%`,
                  desc: 'Memory consolidation & dreams',
                },
                {
                  name: 'Light Sleep', color: '#38bdf8',
                  time: formatDuration(sleepStageBreakdown.lightMs),
                  pct: `${lightPct}%`,
                  desc: 'Core sleep & mental reset',
                },
                {
                  name: 'Awake', color: '#f87171',
                  time: formatDuration(sleepStageBreakdown.awakeMs),
                  pct: `${awakePct}%`,
                  desc: 'Brief natural night wakeups',
                },
              ];

              return (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {stages.map((stage, i) => (
                    <View key={i} style={{
                      width: '48%',
                      backgroundColor: stage.color + '18',
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: stage.color + '33',
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stage.color, marginRight: 6 }} />
                        <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '700' }}>{stage.name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{stage.time}</Text>
                        <Text style={{ color: stage.color, fontSize: 13, fontWeight: '700' }}>{stage.pct}</Text>
                      </View>
                      <Text style={{ color: '#94a3b8', fontSize: 11 }}>{stage.desc}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Sidebar Menu Drawer Modal (Image 3) ───────────────────────────── */}
      <Modal
        visible={isMenuOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setIsMenuOpen(false)} />
          <View style={styles.drawerContainer}>
            {/* Drawer Header with Logo & Close button */}
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

            {/* User Profile Card */}
            <View style={styles.drawerProfileSection}>
              <Image
                source={userData.avatar ? { uri: userData.avatar } : require('../assets/images/default-avatar.png')}
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

            {/* Menu Items matching Image 3 */}
            <ScrollView style={styles.drawerNavList} showsVerticalScrollIndicator={false}>
              {/* 1. Home Dashboard */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  selectedTab === 'home' && {
                    backgroundColor: 'rgba(162, 89, 255, 0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(162, 89, 255, 0.35)',
                  },
                ]}
                onPress={() => {
                  setIsMenuOpen(false);
                  setSelectedTab('home');
                }}
              >
                <Ionicons
                  name={selectedTab === 'home' ? 'home' : 'home-outline'}
                  size={22}
                  color="#a259ff"
                />
                <Text
                  style={[
                    styles.drawerNavText,
                    selectedTab === 'home' && { color: '#a259ff', fontWeight: 'bold' },
                  ]}
                >
                  Home Dashboard
                </Text>
              </TouchableOpacity>

              {/* 2. Sleep Overview */}
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

              {/* 3. Sleep Reports */}
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

              {/* 4. Sleep Log */}
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

              {/* 5. Sleep Goals */}
              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/sleepGoals');
                }}
              >
                <Ionicons name="moon-outline" size={22} color="#a259ff" />
                <Text style={styles.drawerNavText}>Sleep Goals</Text>
              </TouchableOpacity>

              {/* 6. Sleep Diary */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  selectedTab === 'diary' && {
                    backgroundColor: 'rgba(67, 233, 123, 0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(67, 233, 123, 0.35)',
                  },
                ]}
                onPress={() => {
                  setIsMenuOpen(false);
                  setSelectedTab('diary');
                }}
              >
                <Ionicons
                  name={selectedTab === 'diary' ? 'book' : 'book-outline'}
                  size={22}
                  color="#43e97b"
                />
                <Text
                  style={[
                    styles.drawerNavText,
                    selectedTab === 'diary' && { color: '#43e97b', fontWeight: 'bold' },
                  ]}
                >
                  Sleep Diary
                </Text>
              </TouchableOpacity>

              {/* 7. Sleep Tips */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  selectedTab === 'recommendations' && {
                    backgroundColor: 'rgba(255, 209, 102, 0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 209, 102, 0.35)',
                  },
                ]}
                onPress={() => {
                  setIsMenuOpen(false);
                  setSelectedTab('recommendations');
                }}
              >
                <Ionicons
                  name={selectedTab === 'recommendations' ? 'bulb' : 'bulb-outline'}
                  size={22}
                  color="#ffd166"
                />
                <Text
                  style={[
                    styles.drawerNavText,
                    selectedTab === 'recommendations' && { color: '#ffd166', fontWeight: 'bold' },
                  ]}
                >
                  Sleep Tips
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}
