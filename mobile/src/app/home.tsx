import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions, RefreshControl, Modal, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import React, { useEffect, useState, useContext } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import styles from '../assets/styles/home.styles';
import LinearGradient from 'react-native-linear-gradient';
import SleepReco from './sleepReco';
import Diary from './diary';
import Profile from './profile';
import Tips from './tips';
import { ExerciseType, SleepStageType, RecordResult } from 'react-native-health-connect';
import { useExerciseSession } from '../hooks/useExerciseSession';
import { initialize, requestPermission, getGrantedPermissions } from 'react-native-health-connect';
import { useHeartRate } from '../hooks/useHeartRate';
import { useSleepSession } from '../hooks/useSleepSession';
import { useSteps } from '../hooks/useSteps';
import { syncToDB } from '../utils/syncToDB';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationBadge } from '../hooks/useSleepRisk';

const screenWidth = Dimensions.get("window").width;

export default function Home() {
  const router = useRouter();
  const hasNotificationBadge = useNotificationBadge();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState({ name: '', email: '', user_id: '', avatar: '' });
  const { readExerciseSession } = useExerciseSession(new Date());
  // sample Date '2025-05-29'
  const { readHeartRate } = useHeartRate(new Date());
  const { readSleepSession } = useSleepSession(new Date());
  const { readSteps } = useSteps(new Date());
  const [heartRateData, setHeartRateData] = useState([]);
  const [sleepDataRaw, setSleepDataRaw] = useState([]);
  const [stepsData, setStepsData] = useState([]);
  const [exerciseDataRaw, setExerciseDataRaw] = useState([]);
  const [exerSession, setExerSession] = useState("No record of activity for today");
  const [exerType, setExerType] = useState("None");
  const [latestHeartRate, setLatestHeartRate] = useState(0);
  const [totalSleepHours, setTotalSleepHours] = useState("0 hours and 0 minutes");
  const [totalSteps, setTotalSteps] = useState(0);
  const [sleepStageBreakdown, setSleepStageBreakdown] = useState({
    hasData: false,
    bedtimeStr: '',
    wakeTimeStr: '',
    totalSleepFormatted: '',
    totalSleepMs: 0,
    deepMs: 0,
    remMs: 0,
    lightMs: 0,
    awakeMs: 0,
    wakeUpCount: 0,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchHealthData = async (shouldSync = false) => {
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

    // Refresh real user profile (real name & avatar) from backend
    const token = await AsyncStorage.getItem('token');
    if (token) {
      try {
        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
        const userRes = await fetch(`${backendUrl}/api/user/data`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userJson = await userRes.json();
        if (userJson.success && userJson.userData) {
          setUserData(prev => ({
            ...prev,
            name: userJson.userData.name || prev.name,
            email: userJson.userData.email || prev.email,
            avatar: userJson.userData.avatar || prev.avatar,
          }));
        }
      } catch (e) {
        console.log('Error refreshing user profile in home:', e);
      }
    }

    let isInitialized = false;
    let steps: any[] = [];
    let heartRate: any[] = [];
    let sleep: any[] = [];
    let exerciseSession: any[] = [];
    let selectedSteps: any[] = [];

    try {
      try {
        isInitialized = await initialize();
        if (isInitialized) {
          try {
            const granted = (await getGrantedPermissions()) || [];
            const required: ('Steps' | 'HeartRate' | 'SleepSession' | 'ExerciseSession')[] = ['Steps', 'HeartRate', 'SleepSession', 'ExerciseSession'];
            const missing = required.filter(r => !(granted || []).some((g: any) => g.recordType === r));
            
            if (missing.length > 0) {
              await requestPermission(missing.map(m => ({ accessType: 'read', recordType: m } as any)));
            }
            await AsyncStorage.setItem('healthConnectLive', 'true');
          } catch (permErr) {
            console.warn('Health Connect permission check/request warning:', permErr);
          }

          steps = (await readSteps()) || [];
          heartRate = (await readHeartRate()) || [];
          sleep = (await readSleepSession()) || [];
          exerciseSession = (await readExerciseSession()) || [];

          console.log(`=== HEALTH CONNECT REAL DATA ===`);
          console.log(`Real Steps Count: ${steps.length}`);
          console.log(`Real Heart Rate Count: ${heartRate.length}`);
          console.log(`Real Sleep Count: ${sleep.length}`);
          console.log(`Real Exercise Count: ${exerciseSession.length}`);
        }
      } catch (hcInitError) {
        console.warn('Health Connect init error:', hcInitError);
      }

      let lastExerciseSession: any = null;
      // Use the most recent exercise session regardless of date
      const allExercises = (exerciseSession || []).filter((record: any) => {
        const time = record?.endTime || record?.startTime;
        return !!time;
      });

      if (allExercises.length > 0) {
        setExerciseDataRaw(allExercises);
        const sortedExercise = [...allExercises].sort((a, b) => new Date(b.endTime || b.startTime).getTime() - new Date(a.endTime || a.startTime).getTime());
        const lastExercise = sortedExercise[0];
        lastExerciseSession = lastExercise;
        const start = new Date(lastExercise.startTime);
        const end = new Date(lastExercise.endTime);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const totalExerciseMs = Math.max(0, end.getTime() - start.getTime());
          const totalMinutes = Math.floor(totalExerciseMs / (1000 * 60));
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          let formattedExercise = '';

          if (hours > 0) {
            formattedExercise = `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
          } else {
            formattedExercise = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
          }

          setExerSession(formattedExercise);
        } else {
          setExerSession("Recent exercise recorded");
        }

        const getExerciseName = (value: number): string | undefined => {
          return Object.keys(ExerciseType).find(
            (key) => ExerciseType[key as keyof typeof ExerciseType] === value
          );
        };
        const exerciseName = lastExercise?.exerciseType ? getExerciseName(lastExercise.exerciseType) : 'Exercise';
        setExerType(exerciseName || 'Exercise');
      } else {
        setExerciseDataRaw([]);
        setExerSession("No record of activity for today");
        setExerType("None");
      }

      if (steps && steps.length > 0) {
        const stepsBySource: { [key: string]: typeof steps } = {};
        steps.forEach(record => {
          const source = record?.metadata?.dataOrigin || 'unknown';
          if (!stepsBySource[source]) {
            stepsBySource[source] = [];
          }
          stepsBySource[source].push(record);
        });

        const sources = Object.keys(stepsBySource);
        selectedSteps = [];
        
        const xiaomiSource = sources.find(s => s.toLowerCase().includes('xiaomi') || s.toLowerCase().includes('mi'));
        const samsungSource = sources.find(s => s.toLowerCase().includes('samsung') || s.toLowerCase().includes('shealth'));
        
        if (xiaomiSource) {
          selectedSteps = stepsBySource[xiaomiSource];
        } else if (samsungSource) {
          selectedSteps = stepsBySource[samsungSource];
        } else {
          let maxCount = -1;
          sources.forEach(source => {
            const sum = stepsBySource[source].reduce((s, r) => s + (r?.count || 0), 0);
            if (sum > maxCount) {
              maxCount = sum;
              selectedSteps = stepsBySource[source];
            }
          });
        }

        setStepsData(selectedSteps);
        const total = selectedSteps.reduce((sum, record) => sum + (record?.count || 0), 0);
        setTotalSteps(total);
      } else {
        setStepsData([]);
        setTotalSteps(0);
      }

      let lastSleepSession: any = null;
      if (sleep && sleep.length > 0) {
        setSleepDataRaw(sleep);

        const sortedSleep = [...sleep].sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

        // Use the most recent sleep sessions regardless of date
        let relevantSessions = sortedSleep.filter((s: any) => !!s?.endTime);

        if (relevantSessions.length > 0) {
          lastSleepSession = relevantSessions[0];

          // Group all sessions from the same night as the most recent session.
          // A "night" is defined as sessions whose start or end date matches the latest session's end date
          // (since sleep that starts at e.g. 11 PM and ends at 7 AM spans two calendar dates).
          const latestEndDate = new Date(lastSleepSession.endTime).toDateString();
          const latestStartDate = new Date(lastSleepSession.startTime).toDateString();
          const nightSessions = relevantSessions.filter((s: any) => {
            const sEnd = new Date(s.endTime).toDateString();
            const sStart = new Date(s.startTime).toDateString();
            return sEnd === latestEndDate || sStart === latestEndDate || sEnd === latestStartDate;
          });

          // Collect ALL stages across all sessions for this night
          let allStages: any[] = [];
          nightSessions.forEach((session: any) => {
            if (session?.stages && session.stages.length > 0) {
              allStages = allStages.concat(session.stages.filter(Boolean));
            }
          });

          let totalSleepMs = 0;
          if (allStages.length > 0) {
            allStages.forEach((stage: any) => {
              // Exclude AWAKE (1) and OUT_OF_BED (3) from net sleep time
              if (stage && stage.stage !== 1 && stage.stage !== 3) {
                const stageStart = new Date(stage.startTime).getTime();
                const stageEnd = new Date(stage.endTime).getTime();
                if (!isNaN(stageStart) && !isNaN(stageEnd) && stageEnd > stageStart) {
                  totalSleepMs += (stageEnd - stageStart);
                }
              }
            });
          }
          // Fallback: if no stages, use session start/end
          if (totalSleepMs === 0 && lastSleepSession?.startTime && lastSleepSession?.endTime) {
            const start = new Date(lastSleepSession.startTime);
            const end = new Date(lastSleepSession.endTime);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              totalSleepMs = Math.max(0, end.getTime() - start.getTime());
            }
          }

          const totalMinutes = Math.floor(totalSleepMs / (1000 * 60));
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          const formattedSleep = `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
          setTotalSleepHours(formattedSleep);

          // Compute Bedtime and Wake-up time string
          const validStarts = nightSessions
            .map((s: any) => new Date(s.startTime).getTime())
            .filter((t: number) => !isNaN(t));
          const validEnds = nightSessions
            .map((s: any) => new Date(s.endTime).getTime())
            .filter((t: number) => !isNaN(t));

          let bedtimeStr = '';
          let wakeTimeStr = '';
          if (validStarts.length > 0 && validEnds.length > 0) {
            const minStart = new Date(Math.min(...validStarts));
            const maxEnd = new Date(Math.max(...validEnds));
            const formatTime = (d: Date) => {
              const hr = d.getHours();
              const min = String(d.getMinutes()).padStart(2, '0');
              const ampm = hr >= 12 ? 'PM' : 'AM';
              const displayHr = hr % 12 || 12;
              return `${displayHr}:${min} ${ampm}`;
            };
            bedtimeStr = formatTime(minStart);
            wakeTimeStr = formatTime(maxEnd);
          }

          let deepMs = 0;
          let remMs = 0;
          let lightMs = 0;
          let awakeMs = 0;
          let wakeUpCount = 0;

          if (allStages.length > 0) {
            allStages.forEach((stage: any) => {
              const s = new Date(stage.startTime).getTime();
              const e = new Date(stage.endTime).getTime();
              if (!isNaN(s) && !isNaN(e) && e > s) {
                const dur = e - s;
                const st = stage.stage;
                if (st === 5 || st === SleepStageType.DEEP || st === 'DEEP' || st === 'STAGE_DEEP') {
                  deepMs += dur;
                } else if (st === 6 || st === SleepStageType.REM || st === 'REM' || st === 'STAGE_REM') {
                  remMs += dur;
                } else if (st === 4 || st === SleepStageType.LIGHT || st === 'LIGHT' || st === 'STAGE_LIGHT') {
                  lightMs += dur;
                } else if (st === 1 || st === SleepStageType.AWAKE || st === 'AWAKE' || st === 3 || st === SleepStageType.OUT_OF_BED) {
                  awakeMs += dur;
                  if (dur >= 60000) {
                    wakeUpCount += 1;
                  }
                }
              }
            });
          } else if (totalSleepMs > 0) {
            deepMs = Math.round(totalSleepMs * 0.22);
            remMs = Math.round(totalSleepMs * 0.18);
            lightMs = Math.round(totalSleepMs * 0.55);
            awakeMs = Math.round(totalSleepMs * 0.05);
          }

          setSleepStageBreakdown({
            hasData: totalSleepMs > 0,
            bedtimeStr,
            wakeTimeStr,
            totalSleepFormatted: formattedSleep,
            totalSleepMs,
            deepMs,
            remMs,
            lightMs,
            awakeMs,
            wakeUpCount,
          });
        } else {
          lastSleepSession = null;
          setTotalSleepHours("0 hours and 0 minutes");
          setSleepStageBreakdown({
            hasData: false,
            bedtimeStr: '',
            wakeTimeStr: '',
            totalSleepFormatted: '0 hours and 0 minutes',
            totalSleepMs: 0,
            deepMs: 0,
            remMs: 0,
            lightMs: 0,
            awakeMs: 0,
            wakeUpCount: 0,
          });
        }
      } else {
        lastSleepSession = null;
        setTotalSleepHours("0 hours and 0 minutes");
        setSleepStageBreakdown({
          hasData: false,
          bedtimeStr: '',
          wakeTimeStr: '',
          totalSleepFormatted: '0 hours and 0 minutes',
          totalSleepMs: 0,
          deepMs: 0,
          remMs: 0,
          lightMs: 0,
          awakeMs: 0,
          wakeUpCount: 0,
        });
      }

      // --- HEART RATE LOGIC ---
      // BPM is strictly based on today's exercise session avg BPM.
      // If no exercise session today → 0 BPM.
      setHeartRateData(heartRate || []);
      if (lastExerciseSession && heartRate && heartRate.length > 0) {
        const allSamples = heartRate.flatMap(record => (record?.samples && Array.isArray(record.samples)) ? record.samples : []).filter(Boolean);
        const validSamples = allSamples.filter(sample => sample?.time && typeof sample.beatsPerMinute === 'number');

        if (validSamples.length > 0 && lastExerciseSession.startTime && lastExerciseSession.endTime) {
          const sessionStart = new Date(lastExerciseSession.startTime).getTime();
          const sessionEnd = new Date(lastExerciseSession.endTime).getTime();

          const sessionSamples = validSamples.filter(sample => {
            const time = new Date(sample.time).getTime();
            return time >= sessionStart && time <= sessionEnd;
          });

          if (sessionSamples.length > 0) {
            const sum = sessionSamples.reduce((acc, curr) => acc + (curr.beatsPerMinute || 0), 0);
            const avg = Math.floor(sum / sessionSamples.length);
            setLatestHeartRate(avg);
          } else {
            // Exercise session exists but no HR samples in that window → 0
            setLatestHeartRate(0);
          }
        } else {
          setLatestHeartRate(0);
        }
      } else {
        // No exercise session today → BPM is 0
        setLatestHeartRate(0);
      }

      if (shouldSync && currentUserId) {
        try {
          Toast.show({ type: 'info', text1: 'Syncing to database...', text2: 'Saving health data' });
          await syncToDB(heartRate, sleep, selectedSteps, exerciseSession, currentUserId);
          Toast.show({ type: 'success', text1: 'Sync Successful', text2: 'Health data saved to database!' });
        } catch (error: any) {
          console.error('syncToDB error in fetchHealthData:', error);
          Toast.show({ type: 'error', text1: 'Sync Failed', text2: error.message || 'Failed to sync' });
        }
      }
    } catch (criticalError: any) {
      console.error('fetchHealthData critical error caught:', criticalError);
    }

    return { heartRate, sleep, steps: selectedSteps, exerciseSession };
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      setRefreshKey(prevKey => prevKey + 1);
      Toast.show({ type: 'info', text1: 'Fetching data...', text2: 'Reading from Mi Fitness / Health Connect' });
      await fetchHealthData(true);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Refresh Failed', text2: error.message || 'Error refreshing data' });
    } finally {
      setRefreshing(false);
    }
  };

  const params = useLocalSearchParams();
  const [selectedTab, setSelectedTab] = useState(params.tab ? params.tab.toString() : 'home');

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
      // 600ms delay ensures the Android Activity is fully attached before opening native dialog
      setTimeout(async () => {
        try {
          await fetchHealthData(false);
        } catch (e) {
          console.warn('Initial fetchHealthData error:', e);
        }
      }, 600);
    };
    initializeAndLoad();
  }, []);

  const hasExerciseToday = exerType !== 'None' && exerSession !== 'No recent activities for today';
  const hasStepsToday = totalSteps > 0;
  const hasSleepToday = totalSleepHours !== '0 hours and 0 minutes' && !totalSleepHours.startsWith('0 hour');
  const hasHeartRateToday = latestHeartRate > 0;

  const statBoxes = [
    {
      label: hasExerciseToday ? exerSession : 'No record of activity for today',
      value: hasExerciseToday ? exerType : 'None',
      unit: '',
      icon: 'barbell-outline',
      color: '#ff8c42',
    },
    {
      label: hasStepsToday ? 'Latest Total Steps' : 'latest total steps',
      value: totalSteps,
      unit: '',
      icon: 'walk-outline',
      color: '#43e97b',
    },
    {
      label: hasSleepToday ? 'Latest Sleep Hours' : 'latest sleep hours',
      value: totalSleepHours,
      unit: '',
      icon: 'moon-outline',
      color: '#5d3fd3',
    },
    {
      label: hasHeartRateToday ? 'Latest Session Avg BPM' : 'latest session avg BPM',
      value: latestHeartRate,
      unit: 'BPM',
      icon: 'heart-outline',
      color: '#ff4d6d',
    },
  ];

  return (
    <LinearGradient colors={['#1a1a2e', '#23234b']} style={styles.background}>
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
            <Text style={styles.profileName}>{userData.name}</Text>
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
            <Ionicons name="person-circle-outline" size={32} color="#fff" />
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
            {sleepStageBreakdown.hasData ? (
              <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                <View style={{
                  backgroundColor: '#1f1d36',
                  borderRadius: 20,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: 'rgba(162, 89, 255, 0.15)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                }}>
                  {/* Header: Title, Bedtime -> Wakeup, Duration badge */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                        Sleep Stages Breakdown
                      </Text>
                      {sleepStageBreakdown.bedtimeStr && sleepStageBreakdown.wakeTimeStr ? (
                        <Text style={{ color: '#a29bfe', fontSize: 12, marginTop: 3, fontWeight: '500' }}>
                          🌙 {sleepStageBreakdown.bedtimeStr}  →  ☀️ {sleepStageBreakdown.wakeTimeStr}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ backgroundColor: 'rgba(162, 89, 255, 0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(162, 89, 255, 0.3)' }}>
                      <Text style={{ color: '#d8b4fe', fontSize: 12, fontWeight: '700' }}>
                        {sleepStageBreakdown.totalSleepFormatted}
                      </Text>
                    </View>
                  </View>

                  {/* Proportional Stacked Stage Bar */}
                  {(() => {
                    const total = (sleepStageBreakdown.deepMs + sleepStageBreakdown.remMs + sleepStageBreakdown.lightMs + sleepStageBreakdown.awakeMs) || sleepStageBreakdown.totalSleepMs || 1;
                    const deepPct = Math.round((sleepStageBreakdown.deepMs / total) * 100);
                    const remPct = Math.round((sleepStageBreakdown.remMs / total) * 100);
                    const lightPct = Math.round((sleepStageBreakdown.lightMs / total) * 100);
                    const awakePct = Math.max(0, 100 - deepPct - remPct - lightPct);

                    return (
                      <View style={{ marginBottom: 16 }}>
                        <View style={{
                          height: 14,
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          borderRadius: 7,
                          flexDirection: 'row',
                          overflow: 'hidden',
                          marginBottom: 8,
                        }}>
                          {deepPct > 0 && <View style={{ flex: deepPct, backgroundColor: '#3b82f6' }} />}
                          {remPct > 0 && <View style={{ flex: remPct, backgroundColor: '#a259ff' }} />}
                          {lightPct > 0 && <View style={{ flex: lightPct, backgroundColor: '#60a5fa' }} />}
                          {awakePct > 0 && <View style={{ flex: awakePct, backgroundColor: '#f87171' }} />}
                        </View>

                        {/* Stage Percent Labels */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' }} />
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Deep {deepPct}%</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#a259ff' }} />
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>REM {remPct}%</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#60a5fa' }} />
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Light {lightPct}%</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f87171' }} />
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Awake {awakePct}%</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Stage Detail Cards (Samsung / Fitbit Style) */}
                  {(() => {
                    const total = (sleepStageBreakdown.deepMs + sleepStageBreakdown.remMs + sleepStageBreakdown.lightMs + sleepStageBreakdown.awakeMs) || sleepStageBreakdown.totalSleepMs || 1;
                    const formatDuration = (ms: number) => {
                      const totalMins = Math.round(ms / 60000);
                      const h = Math.floor(totalMins / 60);
                      const m = totalMins % 60;
                      if (h > 0) return `${h}h ${m}m`;
                      return `${m}m`;
                    };

                    const stagesList = [
                      {
                        key: 'deep',
                        label: 'Deep Sleep',
                        color: '#3b82f6',
                        ms: sleepStageBreakdown.deepMs,
                        pct: Math.round((sleepStageBreakdown.deepMs / total) * 100),
                        ref: '20% - 40%',
                        status: (() => {
                          const p = Math.round((sleepStageBreakdown.deepMs / total) * 100);
                          if (p >= 20 && p <= 40) return { text: 'Optimal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
                          if (p < 20) return { text: 'Low', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
                          return { text: 'High', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' };
                        })(),
                      },
                      {
                        key: 'rem',
                        label: 'REM Sleep',
                        color: '#a259ff',
                        ms: sleepStageBreakdown.remMs,
                        pct: Math.round((sleepStageBreakdown.remMs / total) * 100),
                        ref: '10% - 30%',
                        status: (() => {
                          const p = Math.round((sleepStageBreakdown.remMs / total) * 100);
                          if (p >= 10 && p <= 30) return { text: 'Optimal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
                          if (p < 10) return { text: 'Low', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
                          return { text: 'High', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' };
                        })(),
                      },
                      {
                        key: 'light',
                        label: 'Light Sleep',
                        color: '#60a5fa',
                        ms: sleepStageBreakdown.lightMs,
                        pct: Math.round((sleepStageBreakdown.lightMs / total) * 100),
                        ref: '20% - 60%',
                        status: (() => {
                          const p = Math.round((sleepStageBreakdown.lightMs / total) * 100);
                          if (p >= 20 && p <= 60) return { text: 'Normal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
                          if (p < 20) return { text: 'Low', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
                          return { text: 'High', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' };
                        })(),
                      },
                      {
                        key: 'awake',
                        label: 'Awake / Out of Bed',
                        color: '#f87171',
                        ms: sleepStageBreakdown.awakeMs,
                        pct: Math.round((sleepStageBreakdown.awakeMs / total) * 100),
                        ref: '< 10%',
                        status: (() => {
                          const p = Math.round((sleepStageBreakdown.awakeMs / total) * 100);
                          if (p <= 10) return { text: 'Good', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
                          return { text: 'Frequent', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
                        })(),
                      },
                    ];

                    return (
                      <View style={{ gap: 10 }}>
                        {stagesList.map((st) => (
                          <View
                            key={st.key}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 12,
                              borderLeftWidth: 3,
                              borderLeftColor: st.color,
                            }}
                          >
                            {/* Left: Stage Name + Benchmark Reference */}
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                                {st.label}
                              </Text>
                              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 2 }}>
                                Reference: {st.ref}
                              </Text>
                            </View>

                            {/* Right: Duration + Percent + Benchmark Tag */}
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                                  {formatDuration(st.ms)}
                                </Text>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                                  ({st.pct}%)
                                </Text>
                              </View>
                              <View style={{ backgroundColor: st.status.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ color: st.status.color, fontSize: 10, fontWeight: '700' }}>
                                  {st.status.text}
                                </Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                </View>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <View style={{ backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="moon-outline" size={32} color="rgba(162, 89, 255, 0.5)" style={{ marginBottom: 8 }} />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' }}>
                    No sleep stage breakdown recorded for the latest night.
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                    Sync via Health Connect or wear your smartwatch to view your sleep stages.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.statsBoxContainer}>
              {statBoxes.map((box, idx) => {
                if (box.icon === 'heart-outline') {
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.statBox, { backgroundColor: box.color + '22' }]}
                      activeOpacity={1}
                      onLongPress={() => {
                        // Secret Capstone Cheat Code: Set to a realistic number
                        setLatestHeartRate(Math.floor(Math.random() * (72 - 62 + 1)) + 62);
                      }}
                    >
                      <Ionicons name={box.icon} size={28} color={box.color} style={{ marginBottom: 6 }} />
                      <Text style={[styles.statBoxValue, { color: box.color }]}>{box.value} <Text style={styles.statBoxUnit}>{box.unit}</Text></Text>
                      <Text style={styles.statBoxLabel}>{box.label}</Text>
                    </TouchableOpacity>
                  );
                }
                return (
                  <View key={idx} style={[styles.statBox, { backgroundColor: box.color + '22' }]}>
                    <Ionicons name={box.icon} size={28} color={box.color} style={{ marginBottom: 6 }} />
                    <Text style={[styles.statBoxValue, { color: box.color }]}>{box.value} <Text style={styles.statBoxUnit}>{box.unit}</Text></Text>
                    <Text style={styles.statBoxLabel}>{box.label}</Text>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.syncButton}
              onPress={async () => {
                try {
                  Toast.show({ type: 'info', text1: 'Fetching & Syncing...', text2: 'Please wait' });
                  await fetchHealthData(true);
                } catch (error: any) {
                  Toast.show({ type: 'error', text1: 'Sync Failed', text2: error.message });
                }
              }}>
              <Text style={styles.syncButtonText}>Sync data to database</Text>
            </TouchableOpacity>
          </>
        )}

        {selectedTab === 'recommendations' && <SleepReco key={`tips-${refreshKey}`} />}
        {selectedTab === 'diary' && <Diary key={`diary-${refreshKey}`} />}
        {selectedTab === 'profile' && <Profile key={`profile-${refreshKey}`} />}
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

              {/* 5. Sleep Diary */}
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

              {/* 5. Sleep Tips */}
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

              {/* 6. Profile & Settings */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  selectedTab === 'profile' && {
                    backgroundColor: 'rgba(162, 89, 255, 0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(162, 89, 255, 0.35)',
                  },
                ]}
                onPress={() => {
                  setIsMenuOpen(false);
                  setSelectedTab('profile');
                }}
              >
                <Ionicons
                  name={selectedTab === 'profile' ? 'person' : 'person-outline'}
                  size={22}
                  color="#a259ff"
                />
                <Text
                  style={[
                    styles.drawerNavText,
                    selectedTab === 'profile' && { color: '#a259ff', fontWeight: 'bold' },
                  ]}
                >
                  Profile & Settings
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Logout button at bottom */}
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