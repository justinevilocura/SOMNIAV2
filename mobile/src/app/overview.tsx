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
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import AppleHealthKit, { HealthInputOptions } from 'react-native-health';
import { groupSleepSamplesIntoSessions } from '../utils/sleepHelper';
import { SleepStageType } from '../utils/healthCompatibility';
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
        {score > 0 ? (
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
        ) : null}
      </Svg>
      <View style={overviewStyles.gaugeCenterText}>
        <Text
          style={[
            overviewStyles.gaugeValue,
            centerValue === '--'
              ? { fontSize: 26, fontWeight: '800', color: '#ffffff' }
              : typeof centerValue === 'string' && centerValue.length > 5
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

export default function OverviewScreen() {
  const router = useRouter();
  const hasNotificationBadge = useNotificationBadge();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState({ name: 'User', email: '', avatar: '' });
  const [refreshing, setRefreshing] = useState(false);

  // Day filter: 'Today' (last night's sleep) vs 'Yesterday'
  const [selectedDay, setSelectedDay] = useState<'Today' | 'Yesterday'>('Today');

  // Overview metrics state for the selected day
  const [hasDataForDay, setHasDataForDay] = useState(false);
  const [recoveryScore, setRecoveryScore] = useState<number>(0);
  const [recoveryStatus, setRecoveryStatus] = useState('No Data');
  const [sleepRiskLevel, setSleepRiskLevel] = useState<'--' | 'Low' | 'Moderate' | 'High'>('--');
  const [sleepRiskPct, setSleepRiskPct] = useState<number>(0);
  const [sleepDebt, setSleepDebt] = useState('--');
  const [sleepQuality, setSleepQuality] = useState('No Record');
  const [qualityEmoji, setQualityEmoji] = useState('🌙');
  const [recommendationText, setRecommendationText] = useState(
    'No sleep session recorded for last night. Wear your tracker tonight or log your sleep in the Sleep Log to view recovery insights.'
  );

  // Target window state
  const [targetWindow, setTargetWindow] = useState({
    timeRange: '--',
    status: 'No Data',
    statusColor: '#8a99ad',
    dotPercent: 50,
    windDown: '--',
    target: '--',
    goal: '--',
    rhythmText: 'No recorded sleep rhythm',
    consistencyText: 'No record',
  });

  useEffect(() => {
    loadUserData();
    fetchOverviewData();
  }, [selectedDay]);

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
          setUserData((prev) => ({
            ...prev,
            name: isCustomized === 'true' && prev.name ? prev.name : userJson.userData.name || prev.name,
            email: isCustomized === 'true' && prev.email ? prev.email : userJson.userData.email || prev.email,
            avatar: userJson.userData.avatar || prev.avatar,
          }));
        }
      }
    } catch (e) {
      console.log('Error refreshing user profile in overview:', e);
    }
  };

  // Helper to query Apple HealthKit sleep sessions for the last 10 days
  const queryHealthKitSleep = async (): Promise<any[]> => {
    return new Promise((resolve) => {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 10);
      startDate.setHours(0, 0, 0, 0);

      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
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
  };

  const fetchOverviewData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const backendUrl =
        process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';

      // 1. Get user sleep goal target (default 8.0 hours)
      let targetDurationHours = 8.0;
      let targetBedtimeHour = 22;
      let targetBedtimeMinute = 30;
      let targetWakeHour = 6;
      let targetWakeMinute = 30;

      try {
        const goalsStr = await AsyncStorage.getItem('sleepGoals');
        if (goalsStr) {
          const goals = JSON.parse(goalsStr);
          if (goals.sleepDuration && typeof goals.sleepDuration === 'number') {
            targetDurationHours = goals.sleepDuration;
          }
          if (goals.bedtimeHour !== undefined) targetBedtimeHour = goals.bedtimeHour;
          if (goals.bedtimeMinute !== undefined) targetBedtimeMinute = goals.bedtimeMinute;
          if (goals.wakeUpHour !== undefined) targetWakeHour = goals.wakeUpHour;
          if (goals.wakeUpMinute !== undefined) targetWakeMinute = goals.wakeUpMinute;
        }
      } catch (_) {}

      // Format target window string
      const fmtTime = (h: number, m: number) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hr = h % 12 || 12;
        return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
      };
      const windDownMinutes = targetBedtimeHour * 60 + targetBedtimeMinute - 30;
      const windDownH = Math.floor((windDownMinutes + 1440) % 1440 / 60);
      const windDownM = (windDownMinutes + 1440) % 60;

      // 2. Collect sleep sessions from both HealthKit and Backend
      let allSessions: any[] = [];

      // A. Apple HealthKit
      try {
        const hkSessions = await queryHealthKitSleep();
        if (hkSessions && hkSessions.length > 0) {
          allSessions = allSessions.concat(hkSessions);
        }
      } catch (hkErr) {
        console.warn('HealthKit query error in overview:', hkErr);
      }

      // B. Backend Sleep Sessions
      if (token) {
        try {
          const response = await fetch(`${backendUrl}/api/sleepSession/history`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await response.json();
          if (json.success && json.data?.sessions?.length) {
            allSessions = allSessions.concat(json.data.sessions);
          }
        } catch (_) {}
      }

      // 3. Determine target date for selected day:
      // Today: dateOffset = 0 (last night's sleep)
      // Yesterday: dateOffset = 1 (yesterday's sleep)
      const now = new Date();
      const offsetDays = selectedDay === 'Today' ? 0 : 1;
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - offsetDays);
      const targetDateStr = targetDate.toDateString();

      // Evening before target date
      const eveningBefore = new Date(targetDate);
      eveningBefore.setDate(targetDate.getDate() - 1);
      const eveningBeforeStr = eveningBefore.toDateString();

      // Find sessions for this specific night:
      // A night's sleep concludes in the morning/day of targetDate
      const matchingNightSessions = allSessions.filter((s: any) => {
        const sEnd = new Date(s.endTime || s.lastModifiedTime).toDateString();
        return sEnd === targetDateStr;
      });

      // Calculate total sleep duration for this night
      let nightSleepMs = 0;
      let sessionCount = matchingNightSessions.length;

      matchingNightSessions.forEach((s: any) => {
        if (s.asleepMs && typeof s.asleepMs === 'number' && s.asleepMs > 0) {
          nightSleepMs += s.asleepMs;
        } else if (s.stages && Array.isArray(s.stages) && s.stages.length > 0) {
          s.stages.forEach((st: any) => {
            if (st && st.stage !== SleepStageType.AWAKE && st.stage !== SleepStageType.OUT_OF_BED) {
              const start = new Date(st.startTime).getTime();
              const end = new Date(st.endTime).getTime();
              if (end > start) nightSleepMs += end - start;
            }
          });
        } else if (s.startTime && s.endTime) {
          const start = new Date(s.startTime).getTime();
          const end = new Date(s.endTime).getTime();
          if (end > start) nightSleepMs += end - start;
        }
      });

      const nightSleepHours = nightSleepMs / 3600000;

      // 4. Update UI according to data presence
      if (sessionCount > 0 && nightSleepHours >= 0.5) {
        setHasDataForDay(true);

        // Clinical Recovery Score:
        const CLINICAL_BENCHMARK = 8.0;
        const dailyDebtHours = Math.max(0, CLINICAL_BENCHMARK - nightSleepHours);
        const debtH = Math.floor(dailyDebtHours);
        const debtM = Math.round((dailyDebtHours - debtH) * 60);
        setSleepDebt(dailyDebtHours > 0 ? `${debtH}h ${debtM}m` : '0h 0m');

        const durationPts = Math.min(48, (nightSleepHours / CLINICAL_BENCHMARK) * 48);
        const debtPenalty = Math.min(16, dailyDebtHours * 10);
        const regularityPts = Math.max(15, 42 - debtPenalty);
        const computedScore = Math.min(96, Math.max(38, Math.round(durationPts + regularityPts)));
        setRecoveryScore(computedScore);

        const risk = Math.max(12, Math.min(85, Math.round(100 - computedScore)));
        setSleepRiskPct(risk);

        // Target window & Circadian Shift Analysis
        const firstSession = matchingNightSessions[0];
        const actualStart = new Date(firstSession.startTime);
        const actualHour = actualStart.getHours();
        const actualMin = actualStart.getMinutes();
        const actualMinutes = actualHour * 60 + actualMin;
        const targetMinutes = targetBedtimeHour * 60 + targetBedtimeMinute;

        // Shift calculation (handles crossing midnight)
        let diffMin = actualMinutes - targetMinutes;
        if (diffMin > 720) diffMin -= 1440;
        if (diffMin < -720) diffMin += 1440;

        const absDiff = Math.abs(diffMin);
        const isShifted = absDiff >= 60; // 1 hour or more variance
        const isLate = diffMin > 30;
        const isEarly = diffMin < -30;

        let windowStatus = 'On Track';
        let statusColor = '#22c55e'; // Green
        let dotPercent = 50;

        if (absDiff <= 30) {
          windowStatus = 'On Track';
          statusColor = '#22c55e';
          dotPercent = 50;
        } else if (diffMin > 90) {
          windowStatus = 'Shifted';
          statusColor = '#f97316'; // Orange
          dotPercent = Math.min(90, 50 + (diffMin / 180) * 40);
        } else if (diffMin > 30) {
          windowStatus = 'Delayed';
          statusColor = '#f59e0b'; // Amber
          dotPercent = Math.min(75, 50 + (diffMin / 90) * 25);
        } else if (diffMin < -60) {
          windowStatus = 'Early Shift';
          statusColor = '#38bdf8'; // Cyan
          dotPercent = Math.max(10, 50 + (diffMin / 180) * 40);
        } else {
          windowStatus = 'Early';
          statusColor = '#38bdf8';
          dotPercent = Math.max(25, 50 + (diffMin / 90) * 25);
        }

        const rhythmScore = Math.max(45, Math.min(98, Math.round(100 - absDiff * 0.45)));
        const rhythmLabel =
          absDiff <= 45
            ? 'Consistent sleep rhythm'
            : absDiff <= 90
            ? 'Varied sleep rhythm'
            : 'Circadian shift detected';

        // Human-readable shift text (e.g. "2h 15m late" or "1h early")
        const shiftH = Math.floor(absDiff / 60);
        const shiftM = absDiff % 60;
        const shiftDurationStr =
          shiftH > 0 && shiftM > 0
            ? `${shiftH}h ${shiftM}m`
            : shiftH > 0
            ? `${shiftH}h`
            : `${shiftM}m`;
        const shiftText = isLate
          ? `${shiftDurationStr} late`
          : isEarly
          ? `${shiftDurationStr} early`
          : 'on schedule';

        const debtStr = dailyDebtHours > 0 ? `${debtH}h ${debtM}m` : '0h 0m';

        // Recovery Recommendation matching Android exactly
        if (computedScore >= 80) {
          setRecoveryStatus('Good');
          setSleepRiskLevel('Low');
          setSleepQuality('Good');
          setQualityEmoji('😊');
          setRecommendationText(
            'Great job! Your body is recovering well. Maintain your sleep schedule and try some relaxation before bed.'
          );
        } else if (computedScore >= 65) {
          setRecoveryStatus('Moderate');
          setSleepRiskLevel('Moderate');
          setSleepQuality('Fair');
          setQualityEmoji('😐');
          setRecommendationText(
            `Moderate strain detected (${debtStr} deficit). Consider turning in 30 minutes earlier tonight to prevent cumulative sleep debt.`
          );
        } else {
          setRecoveryStatus('Needs Rest');
          setSleepRiskLevel('High');
          setSleepQuality('Poor');
          setQualityEmoji('🥱');
          setRecommendationText(
            `High sleep debt detected (${debtStr}). Prioritize 8+ hours of recovery rest tonight and practice 4-7-8 breathing before bed.`
          );
        }

        setTargetWindow({
          timeRange: `${fmtTime(targetBedtimeHour, targetBedtimeMinute)} → ${fmtTime(targetWakeHour, targetWakeMinute)}`,
          status: windowStatus,
          statusColor,
          dotPercent,
          windDown: fmtTime(windDownH, windDownM),
          target: fmtTime(targetBedtimeHour, targetBedtimeMinute),
          goal: `${targetDurationHours}h 0m`,
          rhythmText: rhythmLabel,
          consistencyText: `${rhythmScore}% consistency`,
        });
      } else {
        // EXACT EMPTY STATES MATCHING SCREENSHOTS
        setHasDataForDay(false);
        setRecoveryScore(0);
        setRecoveryStatus('No Data');
        setSleepRiskLevel('--');
        setSleepRiskPct(0);
        setSleepDebt('--');
        setSleepQuality('No Record');
        setQualityEmoji('🌙');

        if (selectedDay === 'Today') {
          setRecommendationText(
            'No sleep session recorded for last night. Wear your tracker tonight or log your sleep in the Sleep Log to view recovery insights.'
          );
        } else {
          setRecommendationText(
            'No sleep session recorded for yesterday. Keep your wearable synced or log past sleep to maintain consistent trend data.'
          );
        }

        setTargetWindow({
          timeRange: '--',
          status: 'No Data',
          statusColor: '#8a99ad',
          dotPercent: 50,
          windDown: '--',
          target: '--',
          goal: '--',
          rhythmText: 'No recorded sleep rhythm',
          consistencyText: 'No record',
        });
      }

    } catch (e) {
      console.warn('Could not load overview stats:', e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    await fetchOverviewData();
    setRefreshing(false);
  }, [selectedDay]);

  return (
    <LinearGradient colors={['#101524', '#151a2e', '#1c213a']} style={overviewStyles.screenContainer}>
      {/* ─── Header matching Home Dashboard ───────────────────────────────── */}
      <View style={homeStyles.header}>
        <View style={homeStyles.headerLeft}>
          <TouchableOpacity
            style={homeStyles.menuButton}
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
        {/* ─── Section Header with Date Selector Pill (Matches Images 1 & 2) ─── */}
        <View style={overviewStyles.titleRow}>
          <View>
            <Text style={overviewStyles.mainTitle}>Sleep Overview</Text>
            <Text style={overviewStyles.subTitle}>
              {selectedDay === 'Today' ? "Last night's sleep" : "Yesterday's sleep"}
            </Text>
          </View>

          {/* Date Selector Capsule: < Today > or < Yesterday > */}
          <View style={overviewStyles.datePill}>
            <TouchableOpacity
              onPress={() => setSelectedDay('Yesterday')}
              disabled={selectedDay === 'Yesterday'}
              style={{ opacity: selectedDay === 'Yesterday' ? 0.35 : 1, paddingHorizontal: 4 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={16} color="#fff" />
            </TouchableOpacity>

            <Text style={overviewStyles.datePillText}>{selectedDay}</Text>

            <TouchableOpacity
              onPress={() => setSelectedDay('Today')}
              disabled={selectedDay === 'Today'}
              style={{ opacity: selectedDay === 'Today' ? 0.35 : 1, paddingHorizontal: 4 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 1. Recovery Score & Sleep Risk Cards (2 Columns) ─────────────── */}
        <View style={overviewStyles.scoreRow}>
          {/* Recovery Score Card */}
          <View style={overviewStyles.scoreCard}>
            <Text style={overviewStyles.cardHeaderTitle}>Recovery Score</Text>
            <View style={overviewStyles.gaugeWrapper}>
              <CircularGauge
                score={recoveryScore}
                primaryColor={recoveryScore >= 80 ? '#22c55e' : recoveryScore >= 65 ? '#f59e0b' : '#ef4444'}
                backgroundColor="rgba(255, 255, 255, 0.08)"
                centerValue={hasDataForDay ? recoveryScore : '--'}
              />
            </View>
            <Text style={overviewStyles.scoreStatusText}>{recoveryStatus}</Text>
          </View>

          {/* Sleep Risk Card */}
          <View style={overviewStyles.scoreCard}>
            <Text style={overviewStyles.cardHeaderTitle}>Sleep Risk</Text>
            <View style={overviewStyles.gaugeWrapper}>
              <CircularGauge
                score={sleepRiskPct}
                primaryColor={sleepRiskLevel === 'Low' ? '#06d6a0' : sleepRiskLevel === 'Moderate' ? '#f59e0b' : '#ef4444'}
                backgroundColor="rgba(255, 255, 255, 0.08)"
                centerValue={sleepRiskLevel}
                centerSub={hasDataForDay ? `${sleepRiskPct}%` : 'No Record'}
              />
            </View>
          </View>
        </View>

        {/* ─── 2. Recovery Recommendation Card (Image 1 & 2) ────────────────── */}
        <View style={overviewStyles.recommendationCard}>
          <View style={overviewStyles.moonIconBox}>
            <Ionicons name="moon-outline" size={24} color="#a259ff" />
          </View>
          <View style={overviewStyles.recommendationTextBox}>
            <Text style={overviewStyles.recommendationTitle}>Recovery Recommendation</Text>
            <Text style={overviewStyles.recommendationDesc}>{recommendationText}</Text>
          </View>
        </View>

        {/* ─── 3. Sleep Debt & Sleep Quality (2 Columns) ────────────────────── */}
        <View style={overviewStyles.metricsBar}>
          <View style={overviewStyles.metricItem}>
            <Text style={overviewStyles.metricLabel}>Sleep Debt</Text>
            <Text style={overviewStyles.metricValueBlue}>{sleepDebt}</Text>
          </View>

          <View style={overviewStyles.metricDivider} />

          <View style={overviewStyles.metricItem}>
            <Text style={overviewStyles.metricLabel}>Sleep Quality</Text>
            <View style={overviewStyles.qualityRow}>
              <Text style={overviewStyles.metricValueWhite}>{sleepQuality}</Text>
              <Text style={overviewStyles.qualityEmoji}>{qualityEmoji}</Text>
            </View>
          </View>
        </View>

        {/* ─── 4. Sleep Target Window Card (Matches Images 1 & 2) ───────────── */}
        <View style={overviewStyles.targetCard}>
          {/* Top row: Icon + SLEEP TARGET WINDOW + Badge */}
          <View style={overviewStyles.targetHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={overviewStyles.targetIconBox}>
                <Ionicons name="moon-outline" size={22} color="#a259ff" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={overviewStyles.targetCardLabel}>SLEEP TARGET WINDOW</Text>
                <Text style={overviewStyles.targetTimeRange}>{targetWindow.timeRange}</Text>
              </View>
            </View>

            <View
              style={[
                overviewStyles.targetBadge,
                hasDataForDay && {
                  backgroundColor: `${targetWindow.statusColor}22`,
                  borderColor: `${targetWindow.statusColor}55`,
                },
              ]}
            >
              <Text
                style={[
                  overviewStyles.targetBadgeText,
                  hasDataForDay && { color: targetWindow.statusColor },
                ]}
              >
                {targetWindow.status}
              </Text>
            </View>
          </View>

          {/* Inset Box with Wind-down, Target, Goal & Slider line */}
          <View style={overviewStyles.targetInnerBox}>
            <View style={overviewStyles.targetInnerRow}>
              <Text style={overviewStyles.targetInnerLabel}>
                Wind-down: <Text style={overviewStyles.targetInnerVal}>{targetWindow.windDown}</Text>
              </Text>
              <Text style={overviewStyles.targetInnerLabel}>
                Target: <Text style={overviewStyles.targetInnerVal}>{targetWindow.target}</Text>
              </Text>
              <Text style={overviewStyles.targetInnerLabel}>
                Goal: <Text style={overviewStyles.targetInnerVal}>{targetWindow.goal}</Text>
              </Text>
            </View>

            {/* Clean track bar (exact match to Android - no dot) */}
            <View style={overviewStyles.trackBarContainer}>
              <View style={overviewStyles.trackBarLine} />
            </View>
          </View>

          {/* Bottom row of card */}
          <View style={overviewStyles.targetBottomRow}>
            <Text style={overviewStyles.targetBottomLeft}>{targetWindow.rhythmText}</Text>
            <Text style={overviewStyles.targetBottomRight}>{targetWindow.consistencyText}</Text>
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
  screenContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },

  // Title Row with Date Pill
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38bdf8',
    marginTop: 2,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b2238',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  datePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginHorizontal: 8,
  },

  // 1. Recovery Score & Sleep Risk Cards
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  scoreCard: {
    width: '48.5%',
    backgroundColor: '#161c2e',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
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
  },
  gaugeValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  gaugeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8a99ad',
    marginTop: 2,
  },
  scoreStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8a99ad',
    marginTop: 10,
  },

  // 2. Recovery Recommendation Card
  recommendationCard: {
    flexDirection: 'row',
    backgroundColor: '#161c2e',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  moonIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(162, 89, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recommendationTextBox: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  recommendationDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },

  // 3. Sleep Debt / Sleep Quality 2-Column Row
  metricsBar: {
    flexDirection: 'row',
    backgroundColor: '#161c2e',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8a99ad',
    marginBottom: 6,
  },
  metricValueBlue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#38bdf8',
  },
  metricValueWhite: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qualityEmoji: {
    fontSize: 14,
  },

  // 4. Sleep Target Window Card
  targetCard: {
    backgroundColor: '#161c2e',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  targetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  targetIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(162, 89, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#a855f7',
    letterSpacing: 0.8,
  },
  targetTimeRange: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  targetBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  targetBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8a99ad',
  },
  targetInnerBox: {
    backgroundColor: '#121626',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  targetInnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  targetInnerLabel: {
    fontSize: 11,
    color: '#8a99ad',
  },
  targetInnerVal: {
    color: '#ffffff',
    fontWeight: '700',
  },
  trackBarContainer: {
    height: 6,
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  trackBarLine: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
  },
  targetBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetBottomLeft: {
    fontSize: 11,
    color: '#8a99ad',
  },
  targetBottomRight: {
    fontSize: 11,
    color: '#8a99ad',
  },

});
