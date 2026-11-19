import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  Modal,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import { useNotificationBadge } from '../hooks/useSleepRisk';
import homeStyles from '../assets/styles/home.styles';

const screenWidth = Dimensions.get('window').width;

// Reusable Circular Gauge Ring
const CircularGauge = ({
  score,
  max = 100,
  size = 110,
  strokeWidth = 10,
  primaryColor = '#22c55e',
  backgroundColor = 'rgba(255, 255, 255, 0.08)',
  centerValue,
  centerSub,
}: {
  score: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  primaryColor?: string;
  backgroundColor?: string;
  centerValue: string | number;
  centerSub?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score / max, 0), 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={primaryColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={overviewStyles.gaugeCenterText}>
        <Text
          style={[
            overviewStyles.gaugeValue,
            typeof centerValue === 'string' && centerValue.length > 5
              ? { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 }
              : typeof centerValue === 'string' && centerValue.length > 3
              ? { fontSize: 17, fontWeight: '700' }
              : null,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {centerValue}
        </Text>
        {centerSub ? <Text style={overviewStyles.gaugeSub}>{centerSub}</Text> : null}
      </View>
    </View>
  );
};

interface DayOverviewStats {
  hasData: boolean;
  recoveryScore: number;
  recoveryStatus: string;
  sleepRiskLevel: 'Low' | 'Moderate' | 'High' | '--';
  sleepRiskPct: number;
  sleepDebt: string;
  sleepQuality: string;
  qualityEmoji: string;
  recommendationText: string;
}

interface TargetWindowInfo {
  windowStartStr: string;
  windowEndStr: string;
  windDownStr: string;
  targetStr: string;
  goalStr: string;
  status: 'On Track' | 'Adapting' | 'Shifted / Realigning';
  statusColor: string;
  anchorTag: string;
}

export default function OverviewScreen() {
  const router = useRouter();
  const hasNotificationBadge = useNotificationBadge();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState({ name: 'User', email: '', avatar: '' });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<'Today' | 'Yesterday'>('Today');

  // Sleep Target Window State
  const [targetWindow, setTargetWindow] = useState<TargetWindowInfo>({
    windowStartStr: '10:45 PM',
    windowEndStr: '11:30 PM',
    windDownStr: '10:00 PM',
    targetStr: '10:45 PM',
    goalStr: '8h',
    status: 'On Track',
    statusColor: '#10b981',
    anchorTag: 'Consistent wake anchor',
  });

  // Dynamic Day Metrics State
  const [todayStats, setTodayStats] = useState<DayOverviewStats>({
    hasData: false,
    recoveryScore: 0,
    recoveryStatus: 'No Data',
    sleepRiskLevel: '--',
    sleepRiskPct: 0,
    sleepDebt: '--',
    sleepQuality: 'No Record',
    qualityEmoji: '🌙',
    recommendationText:
      'No sleep session recorded for last night. Wear your tracker tonight or log your sleep in the Sleep Log to view recovery insights.',
  });

  const [yesterdayStats, setYesterdayStats] = useState<DayOverviewStats>({
    hasData: false,
    recoveryScore: 0,
    recoveryStatus: 'No Data',
    sleepRiskLevel: '--',
    sleepRiskPct: 0,
    sleepDebt: '--',
    sleepQuality: 'No Record',
    qualityEmoji: '🌙',
    recommendationText:
      'No sleep session recorded for yesterday. Keep your wearable synced or log past sleep to maintain consistent trend data.',
  });

  useEffect(() => {
    loadUserData();
    fetchOverviewData();
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
      console.log('Error refreshing user profile in overview:', e);
    }
  };

  const fetchOverviewData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      // 1. Get user sleep goal target (default 8.0 hours)
      let targetSleepHours = 8.0;
      try {
        const goalsStr = await AsyncStorage.getItem('sleepGoals');
        if (goalsStr) {
          const goals = JSON.parse(goalsStr);
          if (goals.sleepDuration && typeof goals.sleepDuration === 'number') {
            targetSleepHours = goals.sleepDuration;
          }
        }
      } catch (_) {}

      // 2. Fetch sleep history from backend
      const backendUrl =
        process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';

      let allSessions: any[] = [];
      try {
        const response = await fetch(`${backendUrl}/api/sleepSession/history`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await response.json();
        if (json.success && json.data?.sessions?.length) {
          allSessions = [...json.data.sessions];
        }
      } catch (err) {
        console.warn('Backend sleep history error:', err);
      }

      // 3. Merge local manual sleep logs
      try {
        const storedLogs = await AsyncStorage.getItem('sleepLogs');
        if (storedLogs) {
          const parsed = JSON.parse(storedLogs);
          if (Array.isArray(parsed)) {
            parsed.forEach((l: any) => {
              if (l.date || l.bedtime) {
                const sDate = l.date || l.bedtime;
                const bTime = l.bedtime ? new Date(l.bedtime) : new Date(sDate);
                const wTime = l.wakeTime
                  ? new Date(l.wakeTime)
                  : new Date(bTime.getTime() + (l.totalDurationMinutes || 450) * 60000);
                allSessions.push({
                  startTime: bTime.toISOString(),
                  endTime: wTime.toISOString(),
                  durationHours: (l.totalDurationMinutes || 450) / 60,
                });
              }
            });
          }
        }
      } catch (_) {}

      // 4. Merge sleep diary entries
      try {
        const storedDiary = await AsyncStorage.getItem('sleepDiaryEntries');
        if (storedDiary) {
          const parsedDiary = JSON.parse(storedDiary);
          if (Array.isArray(parsedDiary)) {
            parsedDiary.forEach((d: any) => {
              if (d.bedtime && d.wakeTime) {
                const bTime = new Date(d.bedtime);
                let wTime = new Date(d.wakeTime);
                if (wTime.getTime() <= bTime.getTime()) {
                  wTime = new Date(wTime.getTime() + 24 * 3600000);
                }
                allSessions.push({
                  startTime: bTime.toISOString(),
                  endTime: wTime.toISOString(),
                  durationHours: (wTime.getTime() - bTime.getTime()) / 3600000,
                });
              }
            });
          }
        }
      } catch (_) {}

      // 5. Read cached wearable sleep
      let cachedWearable: any = null;
      try {
        const cwStr = await AsyncStorage.getItem('latestWearableSleep');
        if (cwStr) {
          cachedWearable = JSON.parse(cwStr);
          if (cachedWearable && (cachedWearable.date || cachedWearable.endTime)) {
            const wDate = cachedWearable.date || cachedWearable.endTime;
            const exists = allSessions.some(
              (s: any) =>
                new Date(s.endTime || s.startTime).toDateString() === new Date(wDate).toDateString()
            );
            if (!exists) {
              const durH =
                cachedWearable.hours !== undefined
                  ? cachedWearable.hours + (cachedWearable.minutes || 0) / 60
                  : (cachedWearable.totalMinutes || 0) / 60;
              if (durH > 0) {
                allSessions.push({
                  startTime:
                    cachedWearable.startTime ||
                    new Date(new Date(wDate).getTime() - durH * 3600000).toISOString(),
                  endTime: cachedWearable.endTime || wDate,
                  durationHours: durH,
                  title: 'Live Wearable Sleep',
                });
              }
            }
          }
        }
      } catch (_) {}

      // Helper to extract session net duration in hours
      const getSessionHours = (s: any) => {
        if (s.durationHours !== undefined && s.durationHours !== null) return s.durationHours;
        if (s.durationMinutes !== undefined && s.durationMinutes !== null) return s.durationMinutes / 60;
        if (s.startTime && s.endTime) {
          const diff = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000;
          if (diff > 0) return diff;
        }
        return 0;
      };

      const now = new Date();
      const CLINICAL_BENCHMARK_HOURS = targetSleepHours || 8.0;

      // Function to calculate metrics for a specific target day offset (0 = Today/Last night, 1 = Yesterday)
      const calculateDayMetrics = (dayOffset: number): DayOverviewStats => {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() - dayOffset);
        const targetDateStr = targetDate.toDateString();

        const prevDate = new Date(targetDate);
        prevDate.setDate(targetDate.getDate() - 1);
        const prevDateStr = prevDate.toDateString();

        // Strictly match sessions that concluded (woke up) on targetDateStr, or single session starting on targetDateStr without endTime
        const matchingSessions = allSessions.filter((s: any) => {
          const endStr = s.endTime ? new Date(s.endTime).toDateString() : '';
          const startStr = s.startTime ? new Date(s.startTime).toDateString() : '';
          return endStr === targetDateStr || (!endStr && startStr === targetDateStr);
        });

        let dayHours = 0;
        matchingSessions.forEach((s: any) => {
          dayHours += getSessionHours(s);
        });

        // Only use cached wearable sleep if its recorded date actually matches targetDateStr
        let wearableMatchesTargetDay = false;
        if (cachedWearable && (cachedWearable.endTime || cachedWearable.date)) {
          const wEndDateStr = new Date(cachedWearable.endTime || cachedWearable.date).toDateString();
          if (wEndDateStr === targetDateStr) {
            wearableMatchesTargetDay = true;
          }
        }

        if (dayHours === 0 && wearableMatchesTargetDay && cachedWearable?.totalMinutes) {
          dayHours = cachedWearable.totalMinutes / 60;
        }

        // If no actual sleep record exists for this specific day:
        if (dayHours <= 0) {
          return {
            hasData: false,
            recoveryScore: 0,
            recoveryStatus: 'No Data',
            sleepRiskLevel: '--',
            sleepRiskPct: 0,
            sleepDebt: '--',
            sleepQuality: 'No Record',
            qualityEmoji: '🌙',
            recommendationText:
              dayOffset === 0
                ? 'No sleep session recorded for last night. Wear your tracker tonight or log your sleep in the Sleep Log to view recovery insights.'
                : 'No sleep session recorded for yesterday. Keep your wearable synced or log past sleep to maintain consistent trend data.',
          };
        }

        // Check for circadian shift & schedule disruption for this day
        let sessionWakeMins: number | null = null;
        let sessionBedMins: number | null = null;
        let wakeTimeDisplay = '';

        if (matchingSessions.length > 0) {
          const latestInDay = matchingSessions[matchingSessions.length - 1];
          if (latestInDay.endTime) {
            const eD = new Date(latestInDay.endTime);
            sessionWakeMins = eD.getHours() * 60 + eD.getMinutes();
            const h = eD.getHours();
            const m = eD.getMinutes();
            const ampm = h >= 12 ? 'PM' : 'AM';
            const dh = h % 12 || 12;
            wakeTimeDisplay = `${dh}:${m < 10 ? '0' : ''}${m} ${ampm}`;
          }
          if (latestInDay.startTime) {
            const sD = new Date(latestInDay.startTime);
            sessionBedMins = sD.getHours() * 60 + sD.getMinutes();
          }
        } else if (wearableMatchesTargetDay && cachedWearable?.endTime) {
          const eD = new Date(cachedWearable.endTime);
          sessionWakeMins = eD.getHours() * 60 + eD.getMinutes();
          const h = eD.getHours();
          const m = eD.getMinutes();
          const ampm = h >= 12 ? 'PM' : 'AM';
          const dh = h % 12 || 12;
          wakeTimeDisplay = `${dh}:${m < 10 ? '0' : ''}${m} ${ampm}`;
          if (cachedWearable.startTime) {
            const sD = new Date(cachedWearable.startTime);
            sessionBedMins = sD.getHours() * 60 + sD.getMinutes();
          }
        }

        // Circadian Shift detection:
        // Waking up in afternoon (after 12:30 PM = 750 mins) or sleeping past 2:30 AM
        const isCircadianShifted =
          (sessionWakeMins !== null && (sessionWakeMins >= 12 * 60 + 30 || sessionWakeMins < 5 * 60)) ||
          (sessionBedMins !== null && sessionBedMins >= 2 * 60 + 30 && sessionBedMins < 12 * 60);

        const dailyDebt = Math.max(0, CLINICAL_BENCHMARK_HOURS - dayHours);
        const debtH = Math.floor(dailyDebt);
        const debtM = Math.round((dailyDebt - debtH) * 60);
        const debtFormatted = dailyDebt > 0 ? `${debtH}h ${debtM}m` : '0h 0m';

        // Accurate Clinical Recovery Score based on real recorded hours & circadian rhythm
        let durationPts = 48;
        if (dayHours < CLINICAL_BENCHMARK_HOURS) {
          durationPts = Math.min(48, (dayHours / CLINICAL_BENCHMARK_HOURS) * 48);
        } else if (dayHours > 10.0) {
          durationPts = 42; // Hypersomnia/rebound sleep penalty
        }

        const debtPenalty = Math.min(16, dailyDebt * 10);
        let regularityPts = Math.max(15, 42 - debtPenalty);

        // Circadian misalignment penalty (e.g. waking up at 2:59 PM or sleeping past 3:30 AM)
        if (isCircadianShifted) {
          regularityPts = Math.max(12, regularityPts - 20);
        }

        let computedScore = Math.min(94, Math.max(38, Math.round(durationPts + regularityPts)));
        if (isCircadianShifted && computedScore > 74) {
          computedScore = 72; // Cap at Moderate for severe circadian disruption
        }

        // Sleep Risk Calculation
        // Circadian disruption elevates sleep risk to Moderate (35-42%)
        let riskPct = Math.max(12, Math.min(85, Math.round(100 - computedScore)));
        if (isCircadianShifted && riskPct < 36) {
          riskPct = 36;
        }

        let riskLevel: 'Low' | 'Moderate' | 'High' = 'Low';
        let status = 'Good';
        let quality = 'Good';
        let emoji = '😊';
        let reco = '';

        if (isCircadianShifted) {
          riskLevel = 'Moderate';
          status = 'Moderate';
          quality = 'Fair';
          emoji = '😐';
          reco =
            dayOffset === 0
              ? `Extended rebound sleep detected with a significant circadian shift (woke up at ${wakeTimeDisplay || '2:59 PM'}). While your body caught up on physical rest, your circadian rhythm is out of sync. Avoid late naps today and gradually move your bedtime earlier in 30–45 minute increments to realign your rhythm.`
              : `Yesterday's sleep was significantly delayed into the afternoon (${wakeTimeDisplay || 'afternoon'}). Gradual bedtime realignment is recommended to stabilize your circadian clock.`;
        } else if (computedScore >= 80) {
          riskLevel = 'Low';
          status = 'Good';
          quality = 'Good';
          emoji = '😊';
          reco =
            dayOffset === 0
              ? 'Great job! Your body is recovering well on a consistent schedule. Maintain your sleep rhythm and try some relaxation before bed.'
              : 'Yesterday provided solid restorative recovery. Consistent sleep patterns helped your body recharge effectively.';
        } else if (computedScore >= 65) {
          riskLevel = 'Moderate';
          status = 'Moderate';
          quality = 'Fair';
          emoji = '😐';
          reco =
            dayOffset === 0
              ? `Moderate strain detected (${debtFormatted} deficit). Consider turning in 30 minutes earlier tonight to prevent cumulative sleep debt.`
              : `Yesterday carried a ${debtFormatted} deficit. Comparing with today shows how your recovery trajectory is shifting.`;
        } else {
          riskLevel = 'High';
          status = 'Needs Rest';
          quality = 'Poor';
          emoji = '🥱';
          reco =
            dayOffset === 0
              ? `High sleep debt detected (${debtFormatted}). Prioritize 8+ hours of recovery rest tonight and practice 4-7-8 breathing before bed.`
              : `Yesterday had elevated sleep fatigue (${debtFormatted} debt). Prioritizing recovery helps mitigate carryover fatigue.`;
        }

        return {
          hasData: true,
          recoveryScore: computedScore,
          recoveryStatus: status,
          sleepRiskLevel: riskLevel,
          sleepRiskPct: riskPct,
          sleepDebt: debtFormatted,
          sleepQuality: quality,
          qualityEmoji: emoji,
          recommendationText: reco,
        };
      };

      const computedToday = calculateDayMetrics(0);
      const computedYesterday = calculateDayMetrics(1);

      setTodayStats(computedToday);
      setYesterdayStats(computedYesterday);

      // 6. Compute Sleep Target Window based on rolling 7-night baseline
      const computeSleepTargetWindow = (sessions: any[], goalHours: number): TargetWindowInfo => {
        const goalMinutes = Math.round((goalHours || 8.0) * 60);

        // Find sessions from the past 7 calendar days
        const past7DaysSessions = sessions.filter((s: any) => {
          const sTime = new Date(s.endTime || s.startTime).getTime();
          const diffDays = (now.getTime() - sTime) / (1000 * 3600 * 24);
          return diffDays >= 0 && diffDays <= 7.5;
        });

        // Helper to format minutes from midnight into 12-hour AM/PM string
        const formatMinutesToClock = (totalMins: number): string => {
          let normalized = ((totalMins % 1440) + 1440) % 1440;
          let hours = Math.floor(normalized / 60);
          const mins = normalized % 60;
          const ampm = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12;
          if (hours === 0) hours = 12;
          const mStr = mins < 10 ? `0${mins}` : `${mins}`;
          return `${hours}:${mStr} ${ampm}`;
        };

        // Extract valid wake times and bedtimes in minutes from midnight
        const normalMorningWakeMins: number[] = [];
        const bedtimeMinsList: number[] = [];

        past7DaysSessions.forEach((s: any) => {
          if (s.endTime) {
            const eDate = new Date(s.endTime);
            const wMins = eDate.getHours() * 60 + eDate.getMinutes();
            // Normal morning wake window is between 5:00 AM (300 mins) and 10:30 AM (630 mins)
            if (wMins >= 300 && wMins <= 630) {
              normalMorningWakeMins.push(wMins);
            }
          }
          if (s.startTime) {
            const sDate = new Date(s.startTime);
            bedtimeMinsList.push(sDate.getHours() * 60 + sDate.getMinutes());
          }
        });

        // Typical healthy morning wake anchor (e.g. 7:00 AM)
        let anchorWakeMins = 7 * 60; // 7:00 AM baseline
        if (normalMorningWakeMins.length > 0) {
          anchorWakeMins = Math.round(
            normalMorningWakeMins.reduce((a, b) => a + b, 0) / normalMorningWakeMins.length
          );
        }

        // Ideal baseline bedtime calculated working backward from normal wake anchor
        const baselineIdealBedtimeMins = (((anchorWakeMins - goalMinutes) % 1440) + 1440) % 1440;

        let targetBedtimeMins = baselineIdealBedtimeMins;
        let status: 'On Track' | 'Adapting' | 'Shifted / Realigning' = 'On Track';
        let statusColor = '#10b981';
        let anchorTag = 'Consistent wake anchor';

        if (past7DaysSessions.length > 0) {
          const sorted = [...past7DaysSessions].sort(
            (a, b) =>
              new Date(b.endTime || b.startTime).getTime() -
              new Date(a.endTime || a.startTime).getTime()
          );
          const latest = sorted[0];

          if (latest.startTime) {
            const lDate = new Date(latest.startTime);
            const latestBedMins = lDate.getHours() * 60 + lDate.getMinutes();
            let bedDiff = Math.abs(latestBedMins - baselineIdealBedtimeMins);
            if (bedDiff > 720) bedDiff = 1440 - bedDiff;

            const latestWakeMins = latest.endTime
              ? new Date(latest.endTime).getHours() * 60 + new Date(latest.endTime).getMinutes()
              : anchorWakeMins;
            const wakeShift = Math.abs(latestWakeMins - anchorWakeMins);

            // Check if there is a drastic disruption (e.g. bedtime at 3:24 AM / 3:33 AM, or afternoon wake up >= 12:00 PM)
            const isDrasticDisruption = bedDiff > 120 || wakeShift > 180 || latestWakeMins >= 12 * 60;
            const isModerateShift = bedDiff > 45 && !isDrasticDisruption;

            if (isDrasticDisruption) {
              status = 'Shifted / Realigning';
              statusColor = '#f59e0b';
              anchorTag = 'Realigning rhythm';

              // Incremental recovery target: move bedtime 45 minutes EARLIER than the shifted bedtime towards baseline
              const shiftedEarlier = (((latestBedMins - 45) % 1440) + 1440) % 1440;
              // Round down to clean 30-minute block (e.g. 2:30 AM)
              targetBedtimeMins = Math.floor(shiftedEarlier / 30) * 30;
            } else if (isModerateShift) {
              status = 'Adapting';
              statusColor = '#38bdf8';
              anchorTag = 'Adapting rhythm';

              // Gradually shift 30 minutes earlier towards baseline
              const shiftedEarlier = (((latestBedMins - 30) % 1440) + 1440) % 1440;
              targetBedtimeMins = Math.floor(shiftedEarlier / 30) * 30;
            } else {
              status = 'On Track';
              statusColor = '#10b981';
              anchorTag = 'Consistent wake anchor';
              targetBedtimeMins = (((baselineIdealBedtimeMins - 15) % 1440) + 1440) % 1440;
            }
          }
        }

        const windowStart = targetBedtimeMins;
        const windowEnd = (targetBedtimeMins + 45) % 1440;
        const windDown = (((targetBedtimeMins - 45) % 1440) + 1440) % 1440;
        const goalStr = `${Math.floor(goalHours)}h`;

        return {
          windowStartStr: formatMinutesToClock(windowStart),
          windowEndStr: formatMinutesToClock(windowEnd),
          windDownStr: formatMinutesToClock(windDown),
          targetStr: formatMinutesToClock(windowStart),
          goalStr,
          status,
          statusColor,
          anchorTag,
        };
      };

      const computedWindow = computeSleepTargetWindow(allSessions, CLINICAL_BENCHMARK_HOURS);
      setTargetWindow(computedWindow);
    } catch (e) {
      console.warn('Could not load overview stats:', e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    await fetchOverviewData();
    setRefreshing(false);
  }, []);

  const activeStats = selectedDay === 'Today' ? todayStats : yesterdayStats;

  return (
    <LinearGradient colors={['#1a1a2e', '#23234b']} style={homeStyles.background}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Top Header - EXACT MATCH to Home Dashboard */}
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
            <Ionicons name="notifications-outline" size={26} color="#fff" />
            {hasNotificationBadge && <View style={homeStyles.badgeDot} />}
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
        contentContainerStyle={overviewStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#a259ff"
            colors={['#a259ff']}
          />
        }
      >
        {/* Sleep Overview Header with Today / Yesterday Navigation */}
        <View style={overviewStyles.overviewHeaderSection}>
          <View style={overviewStyles.overviewHeaderLeft}>
            <Text style={overviewStyles.overviewTitle}>Sleep Overview</Text>
            <Text style={overviewStyles.overviewSubtitle}>
              {selectedDay === 'Today' ? "Last night's sleep" : "Yesterday's sleep"}
            </Text>
          </View>

          <View style={overviewStyles.daySelectorPill}>
            <TouchableOpacity
              onPress={() => setSelectedDay('Yesterday')}
              disabled={selectedDay === 'Yesterday'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              style={overviewStyles.chevronButton}
            >
              <Ionicons
                name="chevron-back"
                size={16}
                color={selectedDay === 'Yesterday' ? 'rgba(255, 255, 255, 0.25)' : '#ffffff'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedDay(prev => (prev === 'Today' ? 'Yesterday' : 'Today'))}
              activeOpacity={0.7}
              style={overviewStyles.dayTextWrapper}
            >
              <Text style={overviewStyles.daySelectorText}>{selectedDay}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedDay('Today')}
              disabled={selectedDay === 'Today'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              style={overviewStyles.chevronButton}
            >
              <Ionicons
                name="chevron-forward"
                size={16}
                color={selectedDay === 'Today' ? 'rgba(255, 255, 255, 0.25)' : '#ffffff'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* 1. Recovery Score & Sleep Risk Cards */}
        <View style={overviewStyles.scoreRow}>
          {/* Recovery Score Card */}
          <View style={overviewStyles.scoreCard}>
            <Text style={overviewStyles.cardHeaderTitle}>Recovery Score</Text>
            <View style={overviewStyles.gaugeWrapper}>
              <CircularGauge
                score={activeStats.hasData ? activeStats.recoveryScore : 0}
                primaryColor={
                  activeStats.hasData
                    ? activeStats.recoveryScore >= 80
                      ? '#22c55e'
                      : activeStats.recoveryScore >= 65
                      ? '#f59e0b'
                      : '#ef4444'
                    : 'rgba(255, 255, 255, 0.15)'
                }
                backgroundColor="rgba(255, 255, 255, 0.08)"
                centerValue={activeStats.hasData ? activeStats.recoveryScore : '--'}
              />
            </View>
            <Text
              style={[
                overviewStyles.scoreStatusText,
                {
                  color: activeStats.hasData
                    ? activeStats.recoveryScore >= 80
                      ? '#22c55e'
                      : activeStats.recoveryScore >= 65
                      ? '#f59e0b'
                      : '#ef4444'
                    : '#8a99ad',
                },
              ]}
            >
              {activeStats.recoveryStatus}
            </Text>
          </View>

          {/* Sleep Risk Card */}
          <View style={overviewStyles.scoreCard}>
            <Text style={overviewStyles.cardHeaderTitle}>Sleep Risk</Text>
            <View style={overviewStyles.gaugeWrapper}>
              <CircularGauge
                score={activeStats.hasData ? activeStats.sleepRiskPct : 0}
                primaryColor={
                  activeStats.hasData
                    ? activeStats.sleepRiskLevel === 'Low'
                      ? '#06d6a0'
                      : activeStats.sleepRiskLevel === 'Moderate'
                      ? '#f59e0b'
                      : '#ef4444'
                    : 'rgba(255, 255, 255, 0.15)'
                }
                backgroundColor="rgba(255, 255, 255, 0.08)"
                centerValue={activeStats.sleepRiskLevel}
                centerSub={activeStats.hasData ? `${activeStats.sleepRiskPct}%` : 'No Record'}
              />
            </View>
          </View>
        </View>

        {/* 2. Recovery Recommendation Box */}
        <View style={overviewStyles.recommendationCard}>
          <View
            style={[
              overviewStyles.heartIconBox,
              !activeStats.hasData && { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
            ]}
          >
            <Ionicons
              name={activeStats.hasData ? 'heart' : 'moon-outline'}
              size={24}
              color={activeStats.hasData ? '#a259ff' : '#8a99ad'}
            />
          </View>
          <View style={overviewStyles.recommendationTextBox}>
            <Text style={overviewStyles.recommendationTitle}>Recovery Recommendation</Text>
            <Text style={overviewStyles.recommendationDesc}>{activeStats.recommendationText}</Text>
          </View>
        </View>

        {/* 3. Quick Metrics 2-Column Bar */}
        <View style={overviewStyles.metricsBar}>
          <View style={overviewStyles.metricItem}>
            <Text style={overviewStyles.metricLabel}>Sleep Debt</Text>
            <Text style={overviewStyles.metricValueBlue}>{activeStats.sleepDebt}</Text>
          </View>

          <View style={overviewStyles.metricDivider} />

          <View style={overviewStyles.metricItem}>
            <Text style={overviewStyles.metricLabel}>Sleep Quality</Text>
            <View style={overviewStyles.qualityRow}>
              <Text style={overviewStyles.metricValueWhite}>{activeStats.sleepQuality}</Text>
              <Text style={overviewStyles.qualityEmoji}>{activeStats.qualityEmoji}</Text>
            </View>
          </View>
        </View>

        {/* 4. Sleep Target Window Card */}
        <View style={overviewStyles.targetWindowCard}>
          {/* Top Row: Icon + Title & Range + Status Badge */}
          <View style={overviewStyles.targetHeaderRow}>
            <View style={overviewStyles.targetLeftGroup}>
              <View
                style={[
                  overviewStyles.targetIconBox,
                  !activeStats.hasData && { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
                ]}
              >
                <Ionicons
                  name={activeStats.hasData ? 'moon' : 'moon-outline'}
                  size={18}
                  color={activeStats.hasData ? '#a78bfa' : '#8a99ad'}
                />
              </View>
              <View style={overviewStyles.targetTitleCol}>
                <Text style={overviewStyles.targetSectionLabel}>SLEEP TARGET WINDOW</Text>
                <Text
                  style={[
                    overviewStyles.targetRangeText,
                    !activeStats.hasData && { color: '#8a99ad', fontSize: 20 },
                  ]}
                >
                  {activeStats.hasData
                    ? `${targetWindow.windowStartStr} – ${targetWindow.windowEndStr}`
                    : '--'}
                </Text>
              </View>
            </View>

            <View
              style={[
                overviewStyles.targetStatusBadge,
                activeStats.hasData
                  ? {
                      backgroundColor: `${targetWindow.statusColor}18`,
                      borderColor: `${targetWindow.statusColor}55`,
                    }
                  : {
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                    },
              ]}
            >
              <Text
                style={[
                  overviewStyles.targetStatusText,
                  { color: activeStats.hasData ? targetWindow.statusColor : '#8a99ad' },
                ]}
              >
                {activeStats.hasData ? targetWindow.status : 'No Data'}
              </Text>
            </View>
          </View>

          {/* Middle Box: Wind-down, Target, Goal & Progress Track */}
          <View style={overviewStyles.targetMidBox}>
            <View style={overviewStyles.targetMetricsRow}>
              <Text style={overviewStyles.targetMetricLabel}>
                Wind-down:{' '}
                <Text style={overviewStyles.targetMetricValue}>
                  {activeStats.hasData ? targetWindow.windDownStr : '--'}
                </Text>
              </Text>
              <Text style={overviewStyles.targetMetricLabel}>
                Target:{' '}
                <Text style={overviewStyles.targetMetricValue}>
                  {activeStats.hasData ? targetWindow.targetStr : '--'}
                </Text>
              </Text>
              <Text style={overviewStyles.targetMetricLabel}>
                Goal:{' '}
                <Text
                  style={[
                    overviewStyles.targetMetricValue,
                    { color: activeStats.hasData ? '#38bdf8' : '#8a99ad' },
                  ]}
                >
                  {activeStats.hasData ? targetWindow.goalStr : '--'}
                </Text>
              </Text>
            </View>

            {/* Segmented Timeline Bar */}
            <View style={overviewStyles.targetTrackContainer}>
              {activeStats.hasData ? (
                <>
                  <View style={[overviewStyles.trackSegment, { flex: 3, backgroundColor: '#334155' }]} />
                  <View style={[overviewStyles.trackSegment, { flex: 2, backgroundColor: '#f59e0b' }]} />
                  <View style={[overviewStyles.trackSegment, { flex: 5, backgroundColor: '#38bdf8' }]} />
                </>
              ) : (
                <View
                  style={[
                    overviewStyles.trackSegment,
                    { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                  ]}
                />
              )}
            </View>
          </View>

          {/* Bottom Row: Rhythm context & Anchor note */}
          <View style={overviewStyles.targetBottomRow}>
            <Text style={overviewStyles.targetRhythmNote}>
              {activeStats.hasData ? 'Based on 7-night rhythm' : 'No recorded sleep rhythm'}
            </Text>
            <Text
              style={[
                overviewStyles.targetAnchorTag,
                !activeStats.hasData && { color: '#8a99ad' },
              ]}
            >
              {activeStats.hasData ? targetWindow.anchorTag : 'No record'}
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Hamburger Drawer Modal - EXACT MATCH to Home Dashboard */}
      <Modal
        visible={isMenuOpen}
        transparent={true}
        animationType="fade"
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
                style={homeStyles.drawerCloseButton}
                onPress={() => setIsMenuOpen(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Profile Info matching Home Dashboard */}
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
                {userData.name || 'User'}
              </Text>
              <Text style={homeStyles.drawerUserEmail} numberOfLines={1}>
                {userData.email || ''}
              </Text>
            </View>

            <View style={homeStyles.drawerDivider} />

            {/* Navigation Items */}
            <ScrollView style={homeStyles.drawerNavList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={homeStyles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace('/home');
                }}
              >
                <Ionicons name="home-outline" size={22} color="#a259ff" />
                <Text style={homeStyles.drawerNavText}>Home Dashboard</Text>
              </TouchableOpacity>

              {/* Active Tab: Sleep Overview */}
              <TouchableOpacity
                style={[
                  homeStyles.drawerNavItem,
                  {
                    backgroundColor: 'rgba(6, 214, 160, 0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(6, 214, 160, 0.35)',
                  },
                ]}
                onPress={() => setIsMenuOpen(false)}
              >
                <Ionicons name="pie-chart" size={22} color="#06d6a0" />
                <Text style={[homeStyles.drawerNavText, { color: '#06d6a0', fontWeight: 'bold' }]}>
                  Sleep Overview
                </Text>
              </TouchableOpacity>

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

              {/* 4. Sleep Log */}
              <TouchableOpacity
                style={homeStyles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/sleepLog');
                }}
              >
                <Ionicons name="bed-outline" size={22} color="#818cf8" />
                <Text style={homeStyles.drawerNavText}>Sleep Log</Text>
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

const overviewStyles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  overviewHeaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  overviewHeaderLeft: {
    flex: 1,
    paddingRight: 8,
  },
  overviewTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  overviewSubtitle: {
    fontSize: 13,
    color: '#38bdf8',
    fontWeight: '500',
  },
  daySelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chevronButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayTextWrapper: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  daySelectorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },

  // 1. Score & Risk Cards
  scoreRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: '#13182c',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  gaugeWrapper: {
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeCenterText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 82,
  },
  gaugeValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  gaugeSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  scoreStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },

  // 2. Metrics Bar (3 columns)
  metricsBar: {
    flexDirection: 'row',
    backgroundColor: '#13182c',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 6,
  },
  metricValueBlue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38bdf8',
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValueWhite: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  qualityEmoji: {
    fontSize: 13,
  },

  // Recovery Recommendation Box
  recommendationCard: {
    flexDirection: 'row',
    backgroundColor: '#13182c',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(162, 89, 255, 0.2)',
    gap: 12,
  },
  heartIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(162, 89, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationTextBox: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  recommendationDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 16,
  },

  // 4. Sleep Target Window Card
  targetWindowCard: {
    backgroundColor: '#13182c',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  targetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  targetIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetTitleCol: {
    flex: 1,
  },
  targetSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a78bfa',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  targetRangeText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  targetStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  targetStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  targetMidBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  targetMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  targetMetricLabel: {
    fontSize: 11,
    color: '#8a99ad',
  },
  targetMetricValue: {
    color: '#ffffff',
    fontWeight: '700',
  },
  targetTrackContainer: {
    height: 4,
    borderRadius: 2,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  trackSegment: {
    height: '100%',
  },
  targetBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  targetRhythmNote: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  targetAnchorTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38bdf8',
  },
});
