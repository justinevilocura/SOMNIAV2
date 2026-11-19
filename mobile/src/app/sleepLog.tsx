import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  Image,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import homeStyles from '../assets/styles/home.styles';
import { useNotificationBadge } from '../hooks/useSleepRisk';

type QualityOption = 'Bad' | 'Poor' | 'Okay' | 'Good' | 'Excellent';
type StressLevel = 'Low' | 'Moderate' | 'High';

export default function SleepLog() {
  const router = useRouter();
  const hasUnread = useNotificationBadge();

  // Navigation & User State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState({ name: 'User', email: '', avatar: '' });

  // Date State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadingDateData, setLoadingDateData] = useState(false);
  const [hasDataForSelectedDate, setHasDataForSelectedDate] = useState(true);

  // Time States
  const [bedtime, setBedtime] = useState(() => {
    const d = new Date();
    d.setHours(22, 30, 0, 0); // Default 10:30 PM
    return d;
  });
  const [wakeTime, setWakeTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(6, 30, 0, 0); // Default 6:30 AM
    return d;
  });
  const [timePickerMode, setTimePickerMode] = useState<'bedtime' | 'wakeTime'>('bedtime');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [recordedDuration, setRecordedDuration] = useState<{
    hours: number;
    mins: number;
    formatted: string;
  } | null>(null);
  const [isCustomTimeModified, setIsCustomTimeModified] = useState(false);

  // Sleep Quality State
  const [sleepQuality, setSleepQuality] = useState<QualityOption>('Good');

  // Workload / Stress State
  const [stressLevel, setStressLevel] = useState<StressLevel>('Moderate');

  // Notes State
  const [notes, setNotes] = useState('');

  // Recent Manual Logs State
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [isLogsExpanded, setIsLogsExpanded] = useState(true);

  useEffect(() => {
    loadUserData();
    loadRecentLogs();
  }, []);

  const loadRecentLogs = async () => {
    try {
      const logsMap = new Map<string, any>();

      // 1. Load from local sleepLogs
      const storedSleepLogs = await AsyncStorage.getItem('sleepLogs');
      if (storedSleepLogs) {
        try {
          const parsed = JSON.parse(storedSleepLogs);
          if (Array.isArray(parsed)) {
            parsed.forEach((log: any) => {
              if (log && log.date) {
                const dateKey = new Date(log.date).toDateString();
                if (!logsMap.has(dateKey)) {
                  logsMap.set(dateKey, {
                    ...log,
                    durationFormatted:
                      log.durationFormatted ||
                      (log.totalDurationMinutes
                        ? `${Math.floor(log.totalDurationMinutes / 60)}h ${log.totalDurationMinutes % 60}m`
                        : '7h 00m'),
                  });
                }
              }
            });
          }
        } catch (err) {
          console.warn('Error parsing local sleepLogs:', err);
        }
      }

      // 2. Also check sleepDiaryEntries for manual diary entries
      const storedDiary = await AsyncStorage.getItem('sleepDiaryEntries');
      if (storedDiary) {
        try {
          const parsedDiary = JSON.parse(storedDiary);
          if (Array.isArray(parsedDiary)) {
            parsedDiary.forEach((entry: any) => {
              if (entry && entry.date) {
                const dateKey = new Date(entry.date).toDateString();
                if (!logsMap.has(dateKey)) {
                  let durationMinutes = 450;
                  if (entry.bedtime && entry.wakeTime) {
                    const bTime = new Date(entry.bedtime).getTime();
                    let wTime = new Date(entry.wakeTime).getTime();
                    if (wTime <= bTime) wTime += 24 * 3600 * 1000;
                    durationMinutes = Math.round((wTime - bTime) / 60000);
                  }
                  const h = Math.floor(durationMinutes / 60);
                  const m = durationMinutes % 60;

                  let tag = '';
                  if (entry.lifestyleFactors?.exercise) tag = 'Workout';
                  else if (entry.lifestyleFactors?.caffeine) tag = 'Caffeine';
                  else if (entry.lifestyleFactors?.alcohol) tag = 'Alcohol';
                  else if (entry.diaryNotes) tag = entry.diaryNotes.trim().split(/\s+/)[0];

                  logsMap.set(dateKey, {
                    id: entry.id || `diary-${Date.now()}-${Math.random()}`,
                    date: entry.date,
                    bedtime: entry.bedtime,
                    wakeTime: entry.wakeTime,
                    totalDurationMinutes: durationMinutes,
                    durationFormatted: `${h}h ${m}m`,
                    sleepQuality:
                      entry.sleepQuality === 'Rested' || entry.sleepQuality === 'Refreshed'
                        ? 'Good'
                        : entry.sleepQuality === 'Tired' || entry.sleepQuality === 'Exhausted'
                        ? 'Poor'
                        : entry.sleepQuality || 'Okay',
                    stressLevel: entry.lifestyleFactors?.stressLevel || 'Moderate',
                    tag,
                    notes: entry.diaryNotes || '',
                  });
                }
              }
            });
          }
        } catch (err) {
          console.warn('Error parsing sleepDiaryEntries:', err);
        }
      }

      // 3. Query backend history for any manual sleep sessions saved to cloud
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const backendUrl =
            process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
          const res = await fetch(`${backendUrl}/api/sleepSession/history`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const historyJson = await res.json();
          if (historyJson.success && historyJson.data?.sessions?.length) {
            historyJson.data.sessions.forEach((s: any) => {
              if (s.title && s.title.includes('Manual')) {
                const sDate = s.endTime || s.startTime;
                const dateKey = new Date(sDate).toDateString();
                if (!logsMap.has(dateKey)) {
                  const bTime = new Date(s.startTime).getTime();
                  const wTime = new Date(s.endTime).getTime();
                  const durMs = Math.max(0, wTime - bTime);
                  const totalMinutes = Math.round(durMs / 60000);
                  const h = Math.floor(totalMinutes / 60);
                  const m = totalMinutes % 60;

                  let quality: QualityOption = 'Good';
                  if (s.title.includes('Bad')) quality = 'Bad';
                  else if (s.title.includes('Poor')) quality = 'Poor';
                  else if (s.title.includes('Okay')) quality = 'Okay';
                  else if (s.title.includes('Excellent')) quality = 'Excellent';

                  logsMap.set(dateKey, {
                    id: s.id || `cloud-${s._id}`,
                    date: sDate,
                    bedtime: s.startTime,
                    wakeTime: s.endTime,
                    totalDurationMinutes: totalMinutes,
                    durationFormatted: `${h}h ${m}m`,
                    sleepQuality: quality,
                    stressLevel:
                      totalMinutes < 330 ? 'High' : totalMinutes < 420 ? 'Moderate' : 'Low',
                    tag: 'Cloud Sync',
                    notes: '',
                  });
                }
              }
            });
          }
        }
      } catch (cloudErr) {
        // Offline or backend unavailable, continue with local data
      }

      // Sort logs chronologically (newest first)
      const sortedLogs = Array.from(logsMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setRecentLogs(sortedLogs);
    } catch (e) {
      console.warn('Error loading recent logs:', e);
      setRecentLogs([]);
    }
  };

  const getQualityEmoji = (quality?: string) => {
    switch (quality) {
      case 'Bad':
      case 'Exhausted':
        return '😧';
      case 'Poor':
      case 'Tired':
        return '😟';
      case 'Okay':
        return '😐';
      case 'Good':
      case 'Rested':
        return '😊';
      case 'Excellent':
      case 'Refreshed':
        return '😆';
      default:
        return '😊';
    }
  };

  // Whenever selectedDate changes, fetch accurate data for that specific date
  useEffect(() => {
    fetchDataForSelectedDate(selectedDate);
  }, [selectedDate]);

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
        const backendUrl =
          process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
        const userRes = await fetch(`${backendUrl}/api/user/data`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const isCustomized = await AsyncStorage.getItem('profileCustomized');
        const userJson = await userRes.json();
        if (userJson.success && userJson.userData) {
          setUserData(prev => ({
            name: (isCustomized === 'true' && prev.name) ? prev.name : (userJson.userData.name || 'User'),
            email: (isCustomized === 'true' && prev.email) ? prev.email : (userJson.userData.email || ''),
            avatar: userJson.userData.avatar || prev.avatar || '',
          }));
        }
      }
    } catch (e) {
      console.log('Error loading user profile:', e);
    }
  };

  /**
   * Fetch and calculate accurate biometric metrics for the chosen date
   */
  const fetchDataForSelectedDate = async (targetDate: Date) => {
    setLoadingDateData(true);
    setIsCustomTimeModified(false);
    try {
      const token = await AsyncStorage.getItem('token');
      const targetDateStr = targetDate.toDateString();

      // Read cached wearable sleep (from Health Connect)
      let cachedWearable: any = null;
      try {
        const cwStr = await AsyncStorage.getItem('latestWearableSleep');
        if (cwStr) {
          cachedWearable = JSON.parse(cwStr);
        }
      } catch (_) {}

      // 1. Check if user already saved a manual sleep log for this date
      const localLogsStr = await AsyncStorage.getItem('sleepLogs');
      if (localLogsStr) {
        const localLogs = JSON.parse(localLogsStr);
        const matchedLocal = localLogs.find(
          (log: any) => new Date(log.date).toDateString() === targetDateStr
        );

        if (matchedLocal) {
          setBedtime(new Date(matchedLocal.bedtime));
          setWakeTime(new Date(matchedLocal.wakeTime));
          setSleepQuality(matchedLocal.sleepQuality || 'Good');
          setStressLevel(matchedLocal.stressLevel || 'High');
          setNotes(matchedLocal.notes || '');

          if (matchedLocal.durationFormatted) {
            const match = matchedLocal.durationFormatted.match(/(\d+)h\s*(\d+)?m?/);
            const h = match ? parseInt(match[1]) : Math.floor((matchedLocal.totalDurationMinutes || 420) / 60);
            const m = match ? (parseInt(match[2]) || 0) : ((matchedLocal.totalDurationMinutes || 420) % 60);
            setRecordedDuration({ hours: h, mins: m, formatted: matchedLocal.durationFormatted });
          } else if (matchedLocal.totalDurationMinutes) {
            const h = Math.floor(matchedLocal.totalDurationMinutes / 60);
            const m = matchedLocal.totalDurationMinutes % 60;
            setRecordedDuration({ hours: h, mins: m, formatted: `${h}h ${m}m` });
          }

          setHasDataForSelectedDate(true);
          setLoadingDateData(false);
          return;
        }
      }

      // 2. Query backend history for sessions matching this calendar day
      if (token) {
        const backendUrl =
          process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
        const response = await fetch(`${backendUrl}/api/sleepSession/history`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await response.json();
        if (json.success && json.data?.sessions?.length) {
          const sessions = json.data.sessions;

          // Find sessions matching the selected calendar day (by wake-up or bedtime date)
          const daySessions = sessions.filter((s: any) => {
            const endD = s.endTime ? new Date(s.endTime).toDateString() : null;
            const startD = s.startTime ? new Date(s.startTime).toDateString() : null;
            return endD === targetDateStr || startD === targetDateStr;
          });

          if (daySessions.length > 0) {
            // Sort to get chronological start & end times
            const validStarts = daySessions
              .map((s: any) => new Date(s.startTime).getTime())
              .filter((t: number) => !isNaN(t));
            const validEnds = daySessions
              .map((s: any) => new Date(s.endTime).getTime())
              .filter((t: number) => !isNaN(t));

            if (validStarts.length > 0 && validEnds.length > 0) {
              setBedtime(new Date(Math.min(...validStarts)));
              setWakeTime(new Date(Math.max(...validEnds)));
            }

            // Compute total net sleep hours, exact REM, and exact Deep sleep across the day's sessions
            let totalSleepMs = 0;
            let remMs = 0;
            let deepMs = 0;

            daySessions.forEach((session: any) => {
              if (session.stages && session.stages.length > 0) {
                session.stages.forEach((stage: any) => {
                  const s = new Date(stage.startTime).getTime();
                  const e = new Date(stage.endTime).getTime();
                  if (!isNaN(s) && !isNaN(e) && e > s) {
                    const duration = e - s;

                    // Net sleep: Exclude Awake (1) and Out of Bed (3)
                    if (stage.stage !== 1 && stage.stage !== 3 && stage.stage !== 'AWAKE' && stage.stage !== 'OUT_OF_BED') {
                      totalSleepMs += duration;
                    }

                    // Deep sleep: Health Connect SleepStageType.DEEP is 5
                    const isDeep =
                      stage.stage === 5 ||
                      stage.stage === '5' ||
                      stage.stage === 'DEEP' ||
                      stage.stage === 'STAGE_DEEP';
                    if (isDeep) {
                      deepMs += duration;
                    }

                    // REM sleep: Health Connect SleepStageType.REM is strictly 6
                    const isRem =
                      stage.stage === 6 ||
                      stage.stage === '6' ||
                      stage.stage === 'REM' ||
                      stage.stage === 'STAGE_REM';
                    if (isRem) {
                      remMs += duration;
                    }
                  }
                });
              } else if (session.durationHours !== undefined && session.durationHours !== null) {
                totalSleepMs += session.durationHours * 3600000;
              } else if (session.durationMinutes !== undefined && session.durationMinutes !== null) {
                totalSleepMs += session.durationMinutes * 60000;
              } else {
                const sStart = new Date(session.startTime).getTime();
                const sEnd = new Date(session.endTime).getTime();
                if (!isNaN(sStart) && !isNaN(sEnd) && sEnd > sStart) {
                  const dur = sEnd - sStart;
                  totalSleepMs += dur;
                  deepMs += Math.round(dur * 0.22);
                  remMs += Math.round(dur * 0.18);
                }
              }
            });

            // Calculate net sleep duration in hours & minutes matching Sleep Reports
            let netTotalMinutes = Math.round(totalSleepMs / 60000);
            let netH = Math.floor(netTotalMinutes / 60);
            let netM = netTotalMinutes % 60;
            let finalFormatted = `${netH}h ${netM}m`;

            // If this session matches the latest wearable sleep in Home dashboard, use the exact cached telemetry (e.g. 11h 49m)
            if (
              cachedWearable?.totalSleepFormatted &&
              (Math.abs((cachedWearable.totalMinutes || 0) - netTotalMinutes) <= 60 ||
                cachedWearable.totalSleepMs === totalSleepMs)
            ) {
              finalFormatted = cachedWearable.totalSleepFormatted;
              netH = cachedWearable.hours !== undefined ? cachedWearable.hours : netH;
              netM = cachedWearable.minutes !== undefined ? cachedWearable.minutes : netM;
            }

            setRecordedDuration({
              hours: netH,
              mins: netM,
              formatted: finalFormatted,
            });

            const totalHours = netTotalMinutes / 60;

            // Workload / Stress calculation
            let calculatedStress: StressLevel = 'Low';
            if (totalHours < 5.5) {
              calculatedStress = 'High';
            } else if (totalHours < 7.2) {
              calculatedStress = 'Moderate';
            } else {
              calculatedStress = 'Low';
            }
            setStressLevel(calculatedStress);

            // Sleep Quality assessment
            if (totalHours >= 8.0) {
              setSleepQuality('Good');
            } else if (totalHours >= 6.5) {
              setSleepQuality('Okay');
            } else if (totalHours >= 5.0) {
              setSleepQuality('Poor');
            } else {
              setSleepQuality('Bad');
            }

            setHasDataForSelectedDate(true);
            setLoadingDateData(false);
            return;
          }
        }
      }

      // Check if this date corresponds to the latest wearable telemetry in Home Dashboard
      const isTodayOrYesterday =
        targetDateStr === new Date().toDateString() ||
        targetDateStr === new Date(Date.now() - 86400000).toDateString();

      if (cachedWearable?.totalSleepFormatted && isTodayOrYesterday) {
        const h =
          cachedWearable.hours !== undefined
            ? cachedWearable.hours
            : Math.floor((cachedWearable.totalMinutes || 420) / 60);
        const m =
          cachedWearable.minutes !== undefined
            ? cachedWearable.minutes
            : (cachedWearable.totalMinutes || 420) % 60;
        setRecordedDuration({
          hours: h,
          mins: m,
          formatted: cachedWearable.totalSleepFormatted,
        });
        setHasDataForSelectedDate(true);
        setLoadingDateData(false);
        return;
      }

      // 3. No session recorded for this date
      setRecordedDuration(null);
      setHasDataForSelectedDate(false);
      // Set sensible defaults for logging
      const defaultStart = new Date(targetDate);
      defaultStart.setHours(22, 30, 0, 0);
      const defaultEnd = new Date(targetDate);
      defaultEnd.setDate(defaultEnd.getDate() + 1);
      defaultEnd.setHours(6, 30, 0, 0);
      setBedtime(defaultStart);
      setWakeTime(defaultEnd);
      setStressLevel('Moderate');
      setSleepQuality('Good');
      setNotes('');
    } catch (err) {
      console.warn('Error fetching date data:', err);
      setRecordedDuration(null);
      setHasDataForSelectedDate(false);
    } finally {
      setLoadingDateData(false);
    }
  };

  // Calculate Total Sleep Duration - matches Sleep Reports net duration unless modified
  const calculateTotalSleep = () => {
    if (!isCustomTimeModified && recordedDuration) {
      return recordedDuration;
    }

    const start = bedtime.getTime();
    let end = wakeTime.getTime();

    if (end <= start) {
      end += 24 * 60 * 60 * 1000;
    }

    const diffMs = end - start;
    const totalMinutes = Math.round(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return { hours, mins, formatted: `${hours}h ${mins}m` };
  };

  const totalSleep = calculateTotalSleep();

  const formatClockTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minsStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${minsStr} ${ampm}`;
  };

  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDateChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selected) {
      setIsCustomTimeModified(false);
      setSelectedDate(selected);
    }
  };

  const handleTimeChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selected) {
      setIsCustomTimeModified(true);
      if (timePickerMode === 'bedtime') {
        setBedtime(selected);
      } else {
        setWakeTime(selected);
      }
    }
  };

  const handleSaveLog = async () => {
    try {
      const logEntry = {
        id: Date.now().toString(),
        date: selectedDate.toISOString(),
        bedtime: bedtime.toISOString(),
        wakeTime: wakeTime.toISOString(),
        totalDurationMinutes: totalSleep.hours * 60 + totalSleep.mins,
        durationFormatted: totalSleep.formatted,
        sleepQuality,
        stressLevel,
        tag: notes.trim().split(/\s+/)[0] || '',
        notes,
        createdAt: new Date().toISOString(),
      };

      // 1. Save to local storage
      const existing = await AsyncStorage.getItem('sleepLogs');
      const logsArray = existing ? JSON.parse(existing) : [];
      // Replace if existing log for same date, otherwise add
      const filtered = logsArray.filter(
        (l: any) => new Date(l.date).toDateString() !== selectedDate.toDateString()
      );
      const updatedLogs = [logEntry, ...filtered];
      await AsyncStorage.setItem('sleepLogs', JSON.stringify(updatedLogs));
      setRecentLogs(updatedLogs);

      // 2. Sync to backend if session endpoint is available
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const backendUrl =
            process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
          await fetch(`${backendUrl}/api/sleepSession/addSleepSession`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify([
              {
                startTime: bedtime.toISOString(),
                endTime: wakeTime.toISOString(),
                title: `Manual Sleep Log - ${sleepQuality}`,
                stages: [
                  {
                    startTime: bedtime.toISOString(),
                    endTime: new Date(
                      bedtime.getTime() + Math.round((wakeTime.getTime() - bedtime.getTime()) * 0.22)
                    ).toISOString(),
                    stage: 5, // Deep (~22%)
                  },
                  {
                    startTime: new Date(
                      wakeTime.getTime() - Math.round((wakeTime.getTime() - bedtime.getTime()) * 0.18)
                    ).toISOString(),
                    endTime: wakeTime.toISOString(),
                    stage: 6, // REM (~18%)
                  },
                ],
              },
            ]),
          });
        }
      } catch (backendErr) {
        console.log('Backend sync skipped or offline:', backendErr);
      }

      setHasDataForSelectedDate(true);

      Toast.show({
        type: 'success',
        text1: 'Sleep Log Saved! 🌙',
        text2: `Recorded ${totalSleep.formatted} of sleep for ${formatDateLabel(selectedDate)}.`,
      });
    } catch (e) {
      console.error('Error saving sleep log:', e);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Could not save your sleep log. Please try again.',
      });
    }
  };

  const qualities: { label: QualityOption; emoji: string }[] = [
    { label: 'Bad', emoji: '😧' },
    { label: 'Poor', emoji: '😟' },
    { label: 'Okay', emoji: '😐' },
    { label: 'Good', emoji: '😊' },
    { label: 'Excellent', emoji: '😆' },
  ];

  return (
    <LinearGradient colors={['#1a1a2e', '#23234b']} style={homeStyles.background}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Top Header - EXACT MATCH to all tabs */}
      <View style={homeStyles.header}>
        <View style={homeStyles.headerLeft}>
          <TouchableOpacity
            style={homeStyles.menuButton}
            onPress={() => setIsMenuOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="menu-outline" size={30} color="#fff" />
          </TouchableOpacity>
          <Image
            source={
              userData.avatar
                ? { uri: userData.avatar }
                : require('../assets/images/default-avatar.png')
            }
            style={homeStyles.avatar}
          />
          <View>
            <Text style={homeStyles.greeting}>Welcome,</Text>
            <Text style={homeStyles.profileName}>{userData.name || 'User'}</Text>
          </View>
        </View>

        <View style={homeStyles.headerRight}>
          <TouchableOpacity
            style={homeStyles.notificationBellWrapper}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {hasUnread && <View style={homeStyles.badgeDot} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={homeStyles.profileButton}
            onPress={() => router.replace({ pathname: '/home', params: { tab: 'profile' } })}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Header: "Log Sleep" to the far left + Calendar Button with date on the right */}
        <View style={logStyles.pageHeader}>
          <Text style={logStyles.pageTitle}>Log Sleep</Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={logStyles.calBtnPill}
            activeOpacity={0.7}
          >
            <Text style={logStyles.calBtnText}>{formatDateLabel(selectedDate)}</Text>
            <Ionicons name="calendar-outline" size={18} color="#818cf8" />
          </TouchableOpacity>
        </View>

        {/* Loading Indicator when switching dates */}
        {loadingDateData && (
          <View style={logStyles.loadingBanner}>
            <ActivityIndicator size="small" color="#818cf8" />
            <Text style={logStyles.loadingText}>Fetching accurate sleep data...</Text>
          </View>
        )}

        {/* Notice if no recorded data exists for the chosen date */}
        {!loadingDateData && !hasDataForSelectedDate && (
          <View style={logStyles.noDataNotice}>
            <Ionicons name="information-circle-outline" size={18} color="#ffd166" />
            <Text style={logStyles.noDataText}>
              No smartwatch record found for this date. You can manually enter your sleep below.
            </Text>
          </View>
        )}

        {/* 1. Sleep Duration Card */}
        <View style={logStyles.sectionCard}>
          <Text style={logStyles.sectionLabel}>Sleep Duration</Text>
          <View style={logStyles.timePickersRow}>
            {/* Bedtime Selector */}
            <TouchableOpacity
              style={logStyles.timePillButton}
              onPress={() => {
                setTimePickerMode('bedtime');
                setShowTimePicker(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={logStyles.timePillText}>{formatClockTime(bedtime)}</Text>
              <Ionicons name="chevron-down" size={14} color="#8a99ad" />
            </TouchableOpacity>

            <Ionicons name="arrow-forward" size={18} color="#8a99ad" />

            {/* Wake Time Selector */}
            <TouchableOpacity
              style={logStyles.timePillButton}
              onPress={() => {
                setTimePickerMode('wakeTime');
                setShowTimePicker(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={logStyles.timePillText}>{formatClockTime(wakeTime)}</Text>
              <Ionicons name="chevron-down" size={14} color="#8a99ad" />
            </TouchableOpacity>
          </View>

          {/* Total Sleep Indicator */}
          <View style={logStyles.totalSleepContainer}>
            <Text style={logStyles.totalSleepValue}>{totalSleep.formatted}</Text>
            <Text style={logStyles.totalSleepLabel}>Total Sleep</Text>
          </View>
        </View>

        {/* 2. Sleep Quality Card */}
        <View style={logStyles.sectionCard}>
          <Text style={logStyles.sectionLabel}>Sleep Quality</Text>
          <View style={logStyles.qualityRow}>
            {qualities.map((item) => {
              const isSelected = sleepQuality === item.label;
              return (
                <TouchableOpacity
                  key={item.label}
                  style={logStyles.qualityItem}
                  onPress={() => setSleepQuality(item.label)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      logStyles.qualityEmojiCircle,
                      isSelected && logStyles.qualityEmojiSelected,
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                  </View>
                  <Text
                    style={[
                      logStyles.qualityText,
                      isSelected && { color: '#22c55e', fontWeight: 'bold' },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Workload / Stress Card */}
        <View style={logStyles.sectionCard}>
          <View style={logStyles.stressHeaderRow}>
            <Text style={logStyles.sectionLabel}>Workload / Stress</Text>
            <Text
              style={[
                logStyles.stressValueBadge,
                {
                  color:
                    stressLevel === 'High'
                      ? '#f97316'
                      : stressLevel === 'Moderate'
                      ? '#f59e0b'
                      : '#22c55e',
                },
              ]}
            >
              {stressLevel}
            </Text>
          </View>
          <View style={logStyles.stressPillsContainer}>
            {(['Low', 'Moderate', 'High'] as StressLevel[]).map((level) => {
              const isSelected = stressLevel === level;
              const activeColor =
                level === 'High' ? '#f97316' : level === 'Moderate' ? '#f59e0b' : '#22c55e';
              return (
                <TouchableOpacity
                  key={level}
                  style={[
                    logStyles.stressPill,
                    isSelected && {
                      backgroundColor:
                        level === 'High'
                          ? 'rgba(249, 115, 22, 0.15)'
                          : level === 'Moderate'
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(34, 197, 94, 0.15)',
                      borderColor: activeColor,
                    },
                  ]}
                  onPress={() => setStressLevel(level)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      logStyles.stressPillText,
                      isSelected && {
                        color: activeColor,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 5. Notes (Optional) */}
        <View style={logStyles.sectionCard}>
          <Text style={logStyles.sectionLabel}>Notes (Optional)</Text>
          <TextInput
            style={logStyles.notesInput}
            multiline
            placeholder="How was your day?"
            placeholderTextColor="#666"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* 6. Save Log Button */}
        <TouchableOpacity
          style={logStyles.saveButton}
          onPress={handleSaveLog}
          activeOpacity={0.8}
        >
          <Text style={logStyles.saveButtonText}>Save Log</Text>
        </TouchableOpacity>

        {/* 7. Recent Manual Logs Section */}
        <View style={logStyles.recentLogsCard}>
          <TouchableOpacity
            style={logStyles.recentLogsHeader}
            onPress={() => setIsLogsExpanded(!isLogsExpanded)}
            activeOpacity={0.7}
          >
            <Text style={logStyles.recentLogsTitle}>
              Recent Manual Logs ({recentLogs.length})
            </Text>
            <Ionicons
              name={isLogsExpanded ? 'caret-down' : 'caret-forward'}
              size={14}
              color="#818cf8"
            />
          </TouchableOpacity>

          {isLogsExpanded && (
            <View style={{ marginTop: 6 }}>
              {recentLogs.length === 0 ? (
                <Text style={logStyles.emptyLogsText}>
                  No recent manual logs recorded. Enter your sleep above and tap "Save Log" to record an entry.
                </Text>
              ) : (
                recentLogs.slice(0, 10).map((log, index) => {
                  const logDate = log.date ? new Date(log.date) : new Date();
                  const isLongSleep =
                    (log.totalDurationMinutes && log.totalDurationMinutes >= 420) ||
                    (log.durationFormatted &&
                      (log.durationFormatted.includes('7h') ||
                        log.durationFormatted.includes('8h') ||
                        log.durationFormatted.includes('9h')));

                  return (
                    <TouchableOpacity
                      key={log.id || `log-${index}`}
                      style={logStyles.recentLogRow}
                      onPress={() => {
                        if (log.date) setSelectedDate(new Date(log.date));
                        if (log.bedtime) setBedtime(new Date(log.bedtime));
                        if (log.wakeTime) setWakeTime(new Date(log.wakeTime));
                        if (log.sleepQuality) setSleepQuality(log.sleepQuality);
                        if (log.stressLevel) setStressLevel(log.stressLevel);
                        if (log.notes !== undefined) setNotes(log.notes);
                        Toast.show({
                          type: 'info',
                          text1: 'Log Loaded',
                          text2: `Editing sleep log for ${formatDateLabel(logDate)}.`,
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={logStyles.logDateText}>{formatDateLabel(logDate)}</Text>
                          <Text style={logStyles.logDot}>•</Text>
                          <Text
                            style={[
                              logStyles.logDurationText,
                              { color: isLongSleep ? '#38bdf8' : '#f59e0b' },
                            ]}
                          >
                            {log.durationFormatted || '7h 00m'}
                          </Text>
                        </View>
                        <Text style={logStyles.logSubDetails}>
                          Quality: {log.sleepQuality || 'Good'} • Stress:{' '}
                          {log.stressLevel || 'Moderate'}
                          {log.tag ? ` • ${log.tag}` : ''}
                        </Text>
                      </View>
                      <Text style={logStyles.logEmoji}>
                        {getQualityEmoji(log.sleepQuality)}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <DateTimePicker
          value={timePickerMode === 'bedtime' ? bedtime : wakeTime}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}

      {/* Side Menu Drawer Modal - IDENTICAL to all tabs */}
      <Modal
        visible={isMenuOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <View style={homeStyles.drawerOverlay}>
          <TouchableOpacity
            style={homeStyles.drawerBackdrop}
            activeOpacity={1}
            onPress={() => setIsMenuOpen(false)}
          />
          <View style={homeStyles.drawerContainer}>
            {/* Drawer Header */}
            <View style={homeStyles.drawerHeader}>
              <View style={homeStyles.drawerBrand}>
                <Image
                  source={require('../assets/images/somnia.png')}
                  style={homeStyles.drawerLogo}
                  resizeMode="contain"
                />
              </View>
              <TouchableOpacity
                onPress={() => setIsMenuOpen(false)}
                style={homeStyles.drawerCloseButton}
              >
                <Ionicons name="close-outline" size={24} color="#aaa" />
              </TouchableOpacity>
            </View>

            {/* User Profile Info in Drawer */}
            <View style={homeStyles.drawerProfileSection}>
              <Image
                source={
                  userData.avatar
                    ? { uri: userData.avatar }
                    : require('../assets/images/default-avatar.png')
                }
                style={homeStyles.drawerAvatar}
              />
              <Text style={homeStyles.drawerUserName} numberOfLines={1}>
                {userData.name || 'SOMNiA User'}
              </Text>
              <Text style={homeStyles.drawerUserEmail} numberOfLines={1}>
                {userData.email || ''}
              </Text>
            </View>

            <View style={homeStyles.drawerDivider} />

            {/* Menu Items */}
            <ScrollView style={homeStyles.drawerNavList} showsVerticalScrollIndicator={false}>
              {/* 1. Home Dashboard */}
              <TouchableOpacity
                style={homeStyles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace({ pathname: '/home', params: { tab: 'home' } });
                }}
              >
                <Ionicons name="home-outline" size={22} color="#a259ff" />
                <Text style={homeStyles.drawerNavText}>Home Dashboard</Text>
              </TouchableOpacity>

              {/* 2. Sleep Overview */}
              <TouchableOpacity
                style={homeStyles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/overview');
                }}
              >
                <Ionicons name="pie-chart-outline" size={22} color="#06d6a0" />
                <Text style={homeStyles.drawerNavText}>Sleep Overview</Text>
              </TouchableOpacity>

              {/* 3. Sleep Reports */}
              <TouchableOpacity
                style={homeStyles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/sleepReports');
                }}
              >
                <Ionicons name="bar-chart-outline" size={22} color="#3b82f6" />
                <Text style={homeStyles.drawerNavText}>Sleep Reports</Text>
              </TouchableOpacity>

              {/* 4. Sleep Log (ACTIVE TAB) */}
              <TouchableOpacity
                style={[
                  homeStyles.drawerNavItem,
                  {
                    backgroundColor: 'rgba(129, 140, 248, 0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(129, 140, 248, 0.35)',
                  },
                ]}
                onPress={() => setIsMenuOpen(false)}
              >
                <Ionicons name="bed" size={22} color="#818cf8" />
                <Text style={[homeStyles.drawerNavText, { color: '#818cf8', fontWeight: 'bold' }]}>
                  Sleep Log
                </Text>
              </TouchableOpacity>

              {/* 5. Sleep Goals */}
              <TouchableOpacity
                style={homeStyles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/sleepGoals');
                }}
              >
                <Ionicons name="moon-outline" size={22} color="#a259ff" />
                <Text style={homeStyles.drawerNavText}>Sleep Goals</Text>
              </TouchableOpacity>

              {/* 6. Sleep Diary */}
              <TouchableOpacity
                style={homeStyles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace({ pathname: '/home', params: { tab: 'diary' } });
                }}
              >
                <Ionicons name="book-outline" size={22} color="#43e97b" />
                <Text style={homeStyles.drawerNavText}>Sleep Diary</Text>
              </TouchableOpacity>

              {/* 6. Sleep Tips */}
              <TouchableOpacity
                style={homeStyles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace({ pathname: '/home', params: { tab: 'recommendations' } });
                }}
              >
                <Ionicons name="bulb-outline" size={22} color="#ffd166" />
                <Text style={homeStyles.drawerNavText}>Sleep Tips</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const logStyles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  calBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161c2e',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.25)',
  },
  calBtnText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    borderRadius: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 12,
    color: '#818cf8',
    fontWeight: '500',
  },
  noDataNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 209, 102, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.25)',
  },
  noDataText: {
    flex: 1,
    fontSize: 11,
    color: '#ffd166',
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: '#161c2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 12,
  },
  timePickersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  timePillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e263d',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  timePillText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  totalSleepContainer: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  totalSleepValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#38bdf8',
  },
  totalSleepLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2,
  },
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qualityItem: {
    alignItems: 'center',
  },
  qualityEmojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 6,
  },
  qualityEmojiSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  qualityText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '500',
  },
  stressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stressValueBadge: {
    fontSize: 14,
    fontWeight: '700',
  },
  stressPillsContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f1422',
    borderRadius: 28,
    padding: 4,
    gap: 6,
  },
  stressPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  stressPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8a99ad',
  },
  notesInput: {
    backgroundColor: '#1e263d',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  saveButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  recentLogsCard: {
    backgroundColor: '#161c2e',
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  recentLogsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  recentLogsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyLogsText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  recentLogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#101424',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  logDateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  logDot: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 6,
  },
  logDurationText: {
    fontSize: 14,
    fontWeight: '700',
  },
  logSubDetails: {
    fontSize: 12,
    color: '#8a99ad',
    marginTop: 4,
  },
  logEmoji: {
    fontSize: 24,
  },
});
