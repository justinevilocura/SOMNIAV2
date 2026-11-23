import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  StatusBar,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import LinearGradient from 'react-native-linear-gradient';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppleHealthKit, { HealthInputOptions } from 'react-native-health';
import { groupSleepSamplesIntoSessions } from '../utils/sleepHelper';
import { SleepStageType } from '../utils/healthCompatibility';
import { useNotificationBadge } from '../hooks/useSleepRisk';

const screenWidth = Dimensions.get('window').width;

interface DayData {
  dayLabel: string;
  fullDate: Date;
  durationHours: number;
  formattedDuration: string;
  isRecent: boolean;
  recovery: number;
  burnout: number;
}

export default function SleepReports() {
  const router = useRouter();
  const hasNotificationBadge = useNotificationBadge();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'This Week' | 'Last Week'>('This Week');

  const [userData, setUserData] = useState({ name: '', email: '', avatar: '' });
  const [avgDuration, setAvgDuration] = useState('0h 0m');
  const [consistency, setConsistency] = useState('0%');
  const [aiInsight, setAiInsight] = useState('Analyzing your sleep patterns...');

  const [weeklyDays, setWeeklyDays] = useState<DayData[]>([]);
  const [recoveryTrend, setRecoveryTrend] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [burnoutTrend, setBurnoutTrend] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [chartLabels, setChartLabels] = useState<string[]>(['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue']);

  // Cached pool of all sleep sessions across both weeks
  const allSessionsRef = useRef<any[]>([]);

  useEffect(() => {
    loadUserProfile();
    loadAllSleepData();
  }, []);

  useEffect(() => {
    if (allSessionsRef.current.length > 0) {
      computeWeeklyMetrics(allSessionsRef.current, selectedTimeframe);
    } else {
      loadAllSleepData();
    }
  }, [selectedTimeframe]);

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
        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
        const userRes = await fetch(`${backendUrl}/api/user/data`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const isCustomized = await AsyncStorage.getItem('profileCustomized');
        const userJson = await userRes.json();
        if (userJson.success && userJson.userData) {
          setUserData((prev) => ({
            ...prev,
            name: isCustomized === 'true' && prev.name ? prev.name : userJson.userData.name || prev.name,
            email: isCustomized === 'true' && prev.email ? prev.email : userJson.userData.email || prev.email,
            avatar: userJson.userData.avatar || prev.avatar,
          }));
        }
      }
    } catch (e) {
      console.log('Error loading user profile in sleep reports:', e);
    }
  };

  // Apple HealthKit query helper for iOS (queries full 30 days of historical data)
  const queryHealthKitSleep = async (): Promise<any[]> => {
    return new Promise((resolve) => {
      if (Platform.OS !== 'ios') {
        return resolve([]);
      }

      const permissions = {
        permissions: {
          read: [AppleHealthKit.Constants.Permissions.SleepAnalysis],
          write: [],
        },
      };

      AppleHealthKit.initHealthKit(permissions, (initErr) => {
        if (initErr) {
          console.warn('HealthKit init error in sleepReports:', initErr);
        }

        const options: HealthInputOptions = {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          limit: 1500,
        };

        AppleHealthKit.getSleepSamples(options, (err, results) => {
          if (err || !results) {
            resolve([]);
          } else {
            const sessions = groupSleepSamplesIntoSessions(results);
            resolve(sessions || []);
          }
        });
      });
    });
  };

  // Primary data loader: HealthKit + Backend API + Local Storage
  const loadAllSleepData = async () => {
    setIsLoading(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
      const token = await AsyncStorage.getItem('token');

      let combinedSessions: any[] = [];

      // 1. Apple HealthKit on iOS
      try {
        const hkSessions = await queryHealthKitSleep();
        if (hkSessions && hkSessions.length > 0) {
          combinedSessions = combinedSessions.concat(hkSessions);
        }
      } catch (hkErr) {
        console.warn('HealthKit fetch error:', hkErr);
      }

      // 2. Backend Sleep History
      if (token) {
        try {
          const response = await fetch(`${backendUrl}/api/sleepSession/history`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await response.json();
          if (json.success && json.data?.sessions?.length) {
            combinedSessions = combinedSessions.concat(json.data.sessions);
          }
        } catch (apiErr) {
          console.warn('Backend history error:', apiErr);
        }
      }

      // 3. Local AsyncStorage fallback
      try {
        const localHistoryStr = await AsyncStorage.getItem('sleepHistory');
        if (localHistoryStr) {
          const localHistory = JSON.parse(localHistoryStr);
          if (Array.isArray(localHistory)) {
            combinedSessions = combinedSessions.concat(localHistory);
          }
        }
        const localSessionsStr = await AsyncStorage.getItem('sleepSessions');
        if (localSessionsStr) {
          const localSess = JSON.parse(localSessionsStr);
          if (Array.isArray(localSess)) {
            combinedSessions = combinedSessions.concat(localSess);
          }
        }
      } catch (_) {}

      allSessionsRef.current = combinedSessions;
      await computeWeeklyMetrics(combinedSessions, selectedTimeframe);
    } catch (e) {
      console.error('Failed to load sleep history:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Compute metrics for the active timeframe matching Android logic
  const computeWeeklyMetrics = async (
    allSessions: any[],
    timeframe: 'This Week' | 'Last Week'
  ) => {
    // 1. Get user sleep goal target (default 8.0 hours)
    let targetDurationHours = 8.0;
    try {
      const goalsStr = await AsyncStorage.getItem('sleepGoals');
      if (goalsStr) {
        const parsed = JSON.parse(goalsStr);
        if (parsed.sleepDuration && typeof parsed.sleepDuration === 'number') {
          targetDurationHours = parsed.sleepDuration;
        }
      }
    } catch (_) {}

    // Days offset:
    // "This Week": 6 days ago up to today (7 consecutive days)
    // "Last Week": 13 days ago up to 7 days ago (previous 7-day window)
    const dayOffsetStart = timeframe === 'This Week' ? 6 : 13;
    const dayOffsetEnd = timeframe === 'This Week' ? 0 : 7;

    const now = new Date();
    const daysArray = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const computedDays: DayData[] = [];
    const labels: string[] = [];

    // Helper: calculate net sleep duration in hours (matching Web and Android)
    const getSessionNetHours = (session: any) => {
      if (session.durationHours !== undefined && session.durationHours !== null) {
        return session.durationHours;
      }
      if (session.durationMinutes !== undefined && session.durationMinutes !== null) {
        return session.durationMinutes / 60;
      }
      if (session.asleepMs && typeof session.asleepMs === 'number' && session.asleepMs > 0) {
        return session.asleepMs / 3600000;
      }
      if (session.stages && Array.isArray(session.stages) && session.stages.length > 0) {
        let stageMs = 0;
        session.stages.forEach((st: any) => {
          if (
            st &&
            st.startTime &&
            st.endTime &&
            st.stage !== 1 &&
            st.stage !== 3 &&
            st.stage !== SleepStageType.AWAKE &&
            st.stage !== SleepStageType.OUT_OF_BED
          ) {
            const s = new Date(st.startTime).getTime();
            const e = new Date(st.endTime).getTime();
            if (e > s) stageMs += e - s;
          }
        });
        if (stageMs > 0) return stageMs / 3600000;
      }
      const sTime = new Date(session.startTime).getTime();
      const eTime = new Date(session.endTime).getTime();
      if (!isNaN(sTime) && !isNaN(eTime) && eTime > sTime) {
        return (eTime - sTime) / 3600000;
      }
      return 0;
    };

    // Loop backwards from start offset down to end offset
    for (let i = dayOffsetStart; i >= dayOffsetEnd; i--) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - i);
      const dayLabel = daysArray[targetDate.getDay()];
      labels.push(dayLabel);

      const targetDateStr = targetDate.toDateString();

      // Find sessions concluding on this calendar day (based on wake-up / endTime)
      const daySessions = allSessions.filter((s: any) => {
        const endDt = new Date(s.endTime || s.startTime).toDateString();
        return endDt === targetDateStr;
      });

      // Filter redundant overlapping sessions
      const sorted = [...daySessions].sort(
        (a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      const uniqueSessions = sorted.filter((sA: any, idxA: number) => {
        const aStart = new Date(sA.startTime).getTime();
        const aEnd = new Date(sA.endTime).getTime();
        return !sorted.some((sB: any, idxB: number) => {
          if (idxA === idxB) return false;
          const bStart = new Date(sB.startTime).getTime();
          const bEnd = new Date(sB.endTime).getTime();
          return bStart <= aStart && bEnd >= aEnd && bEnd - bStart > aEnd - aStart;
        });
      });

      let totalHours = 0;
      uniqueSessions.forEach((s: any) => {
        totalHours += getSessionNetHours(s);
      });

      // Clamp to 24h & round to 2 decimals
      totalHours = Math.round(Math.min(totalHours, 24) * 100) / 100;

      // Calculate Clinical Recovery and Burnout scores
      let recovery = 0;
      let burnout = 0;
      if (totalHours > 0) {
        recovery = Math.min(98, Math.max(20, Math.round((totalHours / targetDurationHours) * 85)));
        burnout = Math.max(10, Math.min(78, Math.round(100 - recovery * 0.82)));
      }

      const h = Math.floor(totalHours);
      const m = Math.round((totalHours - h) * 60);
      const formattedDuration = totalHours > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : '';

      computedDays.push({
        dayLabel,
        fullDate: targetDate,
        durationHours: totalHours,
        formattedDuration,
        isRecent: false,
        recovery,
        burnout,
      });
    }

    // Mark the most recent day in the week that has recorded sleep (matching Android)
    for (let idx = computedDays.length - 1; idx >= 0; idx--) {
      if (computedDays[idx].durationHours > 0) {
        computedDays[idx].isRecent = true;
        break;
      }
    }

    setWeeklyDays(computedDays);
    setChartLabels(labels);

    // Trend arrays for the Bezier LineChart
    const recList = computedDays.map((d) => d.recovery);
    const burnList = computedDays.map((d) => d.burnout);
    setRecoveryTrend(recList);
    setBurnoutTrend(burnList);

    // Calculate Weekly Averages: Avg Duration & Consistency
    let totalValidHours = 0;
    let daysWithSleep = 0;
    let totalRecovery = 0;
    let totalBurnout = 0;

    computedDays.forEach((d) => {
      if (d.durationHours > 0 && d.durationHours < 16) {
        totalValidHours += d.durationHours;
        totalRecovery += d.recovery;
        totalBurnout += d.burnout;
        daysWithSleep++;
      }
    });

    if (daysWithSleep > 0) {
      const avgVal = totalValidHours / daysWithSleep;
      const avgH = Math.floor(avgVal);
      const avgM = Math.round((avgVal - avgH) * 60);
      const formattedAvg = avgM > 0 ? `${avgH}h ${avgM}m` : `${avgH}h`;
      setAvgDuration(formattedAvg);

      // Consistency formula: penalty based on deviation from target duration
      // e.g. for avg 10.266h and target 8.0h: 100 - (2.266 * 7.5) = 83%
      const deviation = Math.abs(avgVal - targetDurationHours);
      const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - deviation * 7.5)));
      setConsistency(`${consistencyScore}%`);

      const avgRec = Math.round(totalRecovery / daysWithSleep);
      const avgBurn = Math.round(totalBurnout / daysWithSleep);

      // AI Insight dynamic text generation matching Android exactly
      if (avgVal > 9) {
        setAiInsight(
          `You are averaging ${formattedAvg} of sleep. While rest is important, consistently sleeping over 9 hours may leave you feeling groggy. Your recovery averages ${avgRec} and burnout ${avgBurn}. Try aiming for 7–9 hours for optimal performance.`
        );
      } else if (avgVal >= 7 && avgVal <= 9) {
        setAiInsight(
          `You are averaging ${formattedAvg} of sleep, which is within the optimal range of 7–9 hours. Your recovery averages ${avgRec} and burnout ${avgBurn}. Keep maintaining this consistent schedule!`
        );
      } else {
        setAiInsight(
          `You are averaging ${formattedAvg} of sleep, which is below the recommended 7–9 hours. Your recovery averages ${avgRec} and burnout ${avgBurn}. Try aiming for earlier bedtimes to lower burnout.`
        );
      }
    } else {
      setAvgDuration('0h 0m');
      setConsistency('0%');
      setAiInsight(
        'No sleep records found for this week. Keep your wearable synced or log your sleep in the Sleep Log to view AI insights.'
      );
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserProfile();
    await loadAllSleepData();
    setRefreshing(false);
  }, [selectedTimeframe]);

  // Chart rendering constants
  const chartHeight = 175;
  const maxAxisHours = 12;
  const yTicks = [12, 9, 6, 3, 0];
  const scrollableWidth = Math.max(screenWidth - 80, 460);

  return (
    <LinearGradient colors={['#101524', '#151a2e', '#1c213a']} style={styles.container}>
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

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a259ff" />}
      >
        {/* ─── Title Row with Timeframe Switcher ──────────────────────────────── */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.screenTitle}>Sleep Report</Text>
            <Text style={styles.screenSubtitle}>Historical trends & patterns</Text>
          </View>

          {/* Timeframe Pill Switcher [ This Week | Last Week ] */}
          <View style={styles.timeframeContainer}>
            <TouchableOpacity
              style={[
                styles.timeframeButton,
                selectedTimeframe === 'This Week' && styles.timeframeButtonActive,
              ]}
              onPress={() => setSelectedTimeframe('This Week')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.timeframeButtonText,
                  selectedTimeframe === 'This Week' && styles.timeframeButtonTextActive,
                ]}
              >
                This Week
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.timeframeButton,
                selectedTimeframe === 'Last Week' && styles.timeframeButtonActive,
              ]}
              onPress={() => setSelectedTimeframe('Last Week')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.timeframeButtonText,
                  selectedTimeframe === 'Last Week' && styles.timeframeButtonTextActive,
                ]}
              >
                Last Week
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 1. Weekly Summary Card ───────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="stats-chart" size={22} color="#a855f7" />
            <Text style={styles.cardTitle}>Weekly Summary</Text>
          </View>

          {isLoading ? (
            <View style={{ height: 210, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#a855f7" />
            </View>
          ) : (
            <View style={styles.barChartContainer}>
              <View style={styles.chartMainRow}>
                {/* Fixed Y-Axis Labels Column on the Left */}
                <View style={styles.yAxisColumn}>
                  {yTicks.map((tick, index) => {
                    const topPos = (index / (yTicks.length - 1)) * (chartHeight - 16);
                    return (
                      <View key={tick} style={[styles.yTickContainer, { top: topPos }]}>
                        <Text style={styles.yAxisLabel}>{tick}h</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Horizontal Scrollable Bars Area (matching Android Image 1 & 2) */}
                <ScrollView
                  horizontal
                  style={styles.chartScrollView}
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled={true}
                  directionalLockEnabled={true}
                  scrollEventThrottle={16}
                  bounces={true}
                  contentContainerStyle={{ minWidth: scrollableWidth, paddingRight: 16 }}
                >
                  <View style={[styles.scrollablePlotArea, { width: scrollableWidth, height: chartHeight + 36 }]}>
                    {/* Dashed Gridlines spanning full scroll width */}
                    {yTicks.map((tick, index) => {
                      const topPos = (index / (yTicks.length - 1)) * (chartHeight - 16) + 16;
                      return (
                        <View
                          key={tick}
                          style={[styles.fullDashedLine, { top: topPos, width: scrollableWidth }]}
                        />
                      );
                    })}

                    {/* 7 Columns for the 7 Days */}
                    <View style={[styles.barsRow, { width: scrollableWidth, height: chartHeight + 36 }]}>
                      {weeklyDays.map((item, idx) => {
                        const barHeightRatio = Math.min(1, Math.max(0, item.durationHours / maxAxisHours));
                        const calculatedBarHeight =
                          item.durationHours > 0
                            ? Math.max(8, barHeightRatio * (chartHeight - 16))
                            : 2;

                        // Bar color logic matching Android screenshots:
                        // - Recent sleep: Green (#22c55e)
                        // - Poor sleep (< 6h): Orange (#f97316)
                        // - Standard sleep: Purple (#a855f7)
                        let barColor = '#a855f7';
                        if (item.isRecent) {
                          barColor = '#22c55e';
                        } else if (item.durationHours > 0 && item.durationHours < 6) {
                          barColor = '#f97316';
                        } else if (item.durationHours === 0) {
                          barColor = 'rgba(168, 85, 247, 0.4)';
                        }

                        return (
                          <View key={idx} style={styles.barColumn}>
                            {/* Floating Duration Value Above Bar */}
                            <View style={styles.floatingValueContainer}>
                              {item.durationHours > 0 ? (
                                <Text style={styles.floatingBarValue} numberOfLines={1}>
                                  {item.formattedDuration}
                                </Text>
                              ) : null}
                            </View>

                            {/* Bar Column Track */}
                            <View style={[styles.barTrack, { height: chartHeight - 16 }]}>
                              <View
                                style={[
                                  styles.barFill,
                                  {
                                    height: calculatedBarHeight,
                                    backgroundColor: barColor,
                                  },
                                ]}
                              />
                            </View>

                            {/* X-axis Day Label */}
                            <Text style={styles.xAxisLabel}>{item.dayLabel}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>
              </View>

              {/* Chart Legend */}
              <View style={styles.chartLegendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#f97316' }]} />
                  <Text style={styles.legendText}>Poor Sleep</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#22c55e' }]} />
                  <Text style={styles.legendText}>Recent Sleep</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ─── 2. Two Stat Cards Side-by-Side ───────────────────────────────── */}
        <View style={styles.statsRow}>
          {/* Left Card: Avg Duration */}
          <View style={styles.statCard}>
            <View style={styles.statIconBadgeGreen}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </View>
            <Text style={styles.statValue}>{avgDuration}</Text>
            <Text style={styles.statLabel}>Avg Duration</Text>
          </View>

          {/* Right Card: Consistency */}
          <View style={styles.statCard}>
            <Ionicons name="flame" size={30} color="#f97316" style={styles.statFlameIcon} />
            <Text style={styles.statValue}>{consistency}</Text>
            <Text style={styles.statLabel}>Consistency</Text>
          </View>
        </View>

        {/* ─── 3. Recovery vs. Burnout Card ─────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithInfo}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="pulse" size={22} color="#22c55e" />
              <Text style={styles.cardTitle}>Recovery vs. Burnout</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsInfoModalOpen(true)}
              style={styles.infoModalButton}
              activeOpacity={0.7}
            >
              <Ionicons name="help-circle-outline" size={20} color="#8a99ad" />
            </TouchableOpacity>
          </View>

          {/* Line Chart Legend */}
          <View style={styles.lineLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.legendText}>Recovery</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Burnout</Text>
            </View>
          </View>

          {/* Bezier Line Chart */}
          {isLoading ? (
            <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#22c55e" />
            </View>
          ) : (
            <View style={styles.lineChartWrapper}>
              <LineChart
                data={{
                  labels: chartLabels,
                  datasets: [
                    {
                      data: recoveryTrend.length > 0 ? recoveryTrend : [0, 0, 0, 0, 0, 0, 0],
                      color: () => '#22c55e',
                      strokeWidth: 2.5,
                    },
                    {
                      data: burnoutTrend.length > 0 ? burnoutTrend : [0, 0, 0, 0, 0, 0, 0],
                      color: () => '#f59e0b',
                      strokeWidth: 2.5,
                    },
                  ],
                }}
                width={screenWidth - 60}
                height={180}
                fromZero={true}
                segments={4}
                chartConfig={{
                  backgroundColor: '#161c2e',
                  backgroundGradientFrom: '#161c2e',
                  backgroundGradientTo: '#161c2e',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.4})`,
                  labelColor: () => '#8a99ad',
                  propsForDots: {
                    r: '4',
                    strokeWidth: '1.5',
                  },
                  propsForBackgroundLines: {
                    stroke: 'rgba(255, 255, 255, 0.06)',
                    strokeDasharray: '4, 4',
                  },
                }}
                bezier
                style={styles.lineChartStyle}
              />
            </View>
          )}
        </View>

        {/* ─── 4. AI Insight Card ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle" size={24} color="#8b5cf6" />
            <Text style={styles.cardTitle}>AI Insight</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color="#8b5cf6" />
          ) : (
            <Text style={styles.insightText}>{aiInsight}</Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── Educational Info Modal: Recovery vs. Burnout (Exact Match to Android) ── */}
      <Modal
        visible={isInfoModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsInfoModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsInfoModalOpen(false)}
        >
          <Pressable style={styles.infoModalContainer} onPress={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <View style={styles.infoModalHeader}>
              <View style={styles.infoModalTitleRow}>
                <Ionicons name="information-circle" size={24} color="#22c55e" />
                <Text style={styles.infoModalTitle}>Recovery vs. Burnout</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsInfoModalOpen(false)}
                style={styles.infoModalCloseButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Scrollable container for sections to guarantee fit on any screen size */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.infoModalScroll}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              {/* Section 1: Recovery */}
              <View style={styles.infoSectionBox}>
                <View style={styles.infoSectionHeader}>
                  <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                  <Text style={[styles.infoSectionHeading, { color: '#22c55e' }]}>
                    Recovery (Green Line)
                  </Text>
                </View>
                <Text style={styles.infoSectionText}>
                  Measures your body's restorative energy replenishment each night based on total sleep duration and restorative stage balance (Deep & REM). Higher is better (Target: 75–98).
                </Text>
              </View>

              {/* Section 2: Burnout */}
              <View style={styles.infoSectionBox}>
                <View style={styles.infoSectionHeader}>
                  <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
                  <Text style={[styles.infoSectionHeading, { color: '#f97316' }]}>
                    Burnout (Orange Line)
                  </Text>
                </View>
                <Text style={styles.infoSectionText}>
                  Measures physiological fatigue and stress accumulation driven by sleep debt and short rest. Lower is better (Target: 10–30).
                </Text>
              </View>

              {/* Section 3: How to read this chart */}
              <View style={styles.infoSectionBox}>
                <View style={styles.infoSectionHeader}>
                  <Ionicons name="bulb-outline" size={19} color="#facc15" style={{ marginRight: 8 }} />
                  <Text style={[styles.infoSectionHeading, { color: '#facc15' }]}>
                    How to read this chart:
                  </Text>
                </View>
                <Text style={styles.infoSectionText}>
                  Keep the green recovery line safely above the orange burnout line. When the lines converge or cross, your body is experiencing sleep deficit and needs an earlier bedtime or restorative rest.
                </Text>
              </View>
            </ScrollView>

            {/* Got It Button pinned at bottom of card - ALWAYS visible */}
            <TouchableOpacity
              style={styles.gotItButton}
              onPress={() => setIsInfoModalOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.gotItButtonText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </TouchableOpacity>
      </Modal>

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

              {/* Active Tab: Sleep Reports */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  {
                    backgroundColor: 'rgba(124, 58, 237, 0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(124, 58, 237, 0.4)',
                  },
                ]}
                onPress={() => setIsMenuOpen(false)}
              >
                <Ionicons name="bar-chart" size={22} color="#8b5cf6" />
                <Text style={[styles.drawerNavText, { color: '#8b5cf6', fontWeight: 'bold' }]}>
                  Sleep Reports
                </Text>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 50,
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
    marginRight: 12,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(162, 89, 255, 0.4)',
  },
  greeting: {
    color: '#8b9bb4',
    fontSize: 13,
  },
  profileName: {
    color: '#ffffff',
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
    top: 3,
    right: 3,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#101524',
    zIndex: 10,
  },
  profileButton: {
    padding: 6,
  },

  content: {
    paddingHorizontal: 16,
  },

  // Title Row
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#8a99ad',
    marginTop: 2,
  },

  // Timeframe Switcher
  timeframeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 3,
  },
  timeframeButton: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
  },
  timeframeButtonActive: {
    backgroundColor: '#7c3aed',
  },
  timeframeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8a99ad',
  },
  timeframeButtonTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },

  // Cards
  card: {
    backgroundColor: '#161c2e',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 10,
  },
  infoModalButton: {
    padding: 4,
  },

  // Bar Chart Layout
  barChartContainer: {
    marginTop: 4,
    marginBottom: 6,
  },
  chartMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  chartScrollView: {
    flex: 1,
  },
  yAxisColumn: {
    width: 28,
    height: 175,
    position: 'relative',
    marginTop: 10,
  },
  yTickContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  yAxisLabel: {
    fontSize: 11,
    color: '#8a99ad',
    textAlign: 'left',
  },
  scrollablePlotArea: {
    position: 'relative',
    justifyContent: 'flex-end',
  },
  fullDashedLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderStyle: 'dashed',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    position: 'relative',
    zIndex: 2,
  },
  barColumn: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  floatingValueContainer: {
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  floatingBarValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c084fc',
    textAlign: 'center',
  },
  barTrack: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: 24,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  xAxisLabel: {
    fontSize: 12,
    color: '#8a99ad',
    marginTop: 10,
    fontWeight: '500',
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendBox: {
    width: 14,
    height: 10,
    borderRadius: 2,
    marginRight: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 13,
    color: '#8a99ad',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#161c2e',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statIconBadgeGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statFlameIcon: {
    marginBottom: 12,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#8a99ad',
  },

  // Line Chart
  lineLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  lineChartWrapper: {
    alignItems: 'center',
    marginVertical: 4,
  },
  lineChartStyle: {
    borderRadius: 16,
    marginLeft: -16,
  },

  // AI Insight
  insightText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 15,
    lineHeight: 22,
  },

  // Info Guide Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContainer: {
    backgroundColor: '#161c2e',
    borderRadius: 24,
    padding: 18,
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  infoModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 10,
  },
  infoModalCloseButton: {
    padding: 4,
  },
  infoModalScroll: {
    flexShrink: 1,
  },
  infoSectionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoSectionHeading: {
    fontSize: 14.5,
    fontWeight: 'bold',
  },
  infoSectionText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18.5,
    marginTop: 6,
  },
  gotItButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  gotItButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
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
