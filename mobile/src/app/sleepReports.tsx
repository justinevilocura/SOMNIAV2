import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Platform, StatusBar, Image, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import LinearGradient from 'react-native-linear-gradient';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationBadge } from '../hooks/useSleepRisk';

const screenWidth = Dimensions.get('window').width;

export default function SleepReports() {
  const router = useRouter();
  const hasNotificationBadge = useNotificationBadge();

  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState({ name: '', email: '', avatar: '' });
  const [avgDuration, setAvgDuration] = useState('0h 0m');
  const [consistency, setConsistency] = useState('0%');
  const [aiInsight, setAiInsight] = useState('Analyzing your sleep patterns...');
  const [chartData, setChartData] = useState({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }],
  });
  const [recoveryTrend, setRecoveryTrend] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [burnoutTrend, setBurnoutTrend] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [stagesBreakdown, setStagesBreakdown] = useState({
    deep: { duration: '1h 45m', percent: 24 },
    rem: { duration: '1h 35m', percent: 22 },
    light: { duration: '3h 30m', percent: 49 },
    awake: { duration: '25m', percent: 5 },
  });
  const [latestSleepDuration, setLatestSleepDuration] = useState('0h 0m');
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  useEffect(() => {
    fetchSleepData();
    loadUserProfile();
  }, []);

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
      console.log('Error loading user profile in sleep reports:', e);
    }
  };

  const fetchSleepData = async () => {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
      const token = await AsyncStorage.getItem('token');

      let allSessions: any[] = [];

      // 1. Fetch cloud & wearable sessions from backend
      if (token) {
        try {
          const response = await fetch(`${backendUrl}/api/sleepSession/history`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const json = await response.json();
          if (json.success && json.data && Array.isArray(json.data.sessions)) {
            allSessions = json.data.sessions;
          }
        } catch (backendErr) {
          console.warn('Backend history fetch error in sleep reports:', backendErr);
        }
      }

      // 2. Merge local manual sleep logs
      try {
        const storedLogs = await AsyncStorage.getItem('sleepLogs');
        if (storedLogs) {
          const parsed = JSON.parse(storedLogs);
          if (Array.isArray(parsed)) {
            parsed.forEach((l: any) => {
              if (l.date || l.bedtime) {
                const sDate = l.date || l.bedtime;
                const existing = allSessions.some(
                  (s: any) =>
                    new Date(s.endTime || s.startTime).toDateString() ===
                    new Date(sDate).toDateString()
                );
                if (!existing) {
                  const bTime = l.bedtime ? new Date(l.bedtime) : new Date(sDate);
                  const wTime = l.wakeTime
                    ? new Date(l.wakeTime)
                    : new Date(bTime.getTime() + (l.totalDurationMinutes || 450) * 60000);
                  const stages: any[] = [];
                  if (l.deepSleep) {
                    const match = l.deepSleep.match(/(\d+)h\s*(\d+)?m?/);
                    const dMin = match
                      ? parseInt(match[1]) * 60 + (parseInt(match[2]) || 0)
                      : Math.round((l.totalDurationMinutes || 450) * 0.24);
                    stages.push({
                      startTime: bTime.toISOString(),
                      endTime: new Date(bTime.getTime() + dMin * 60000).toISOString(),
                      stage: 5, // Deep
                    });
                  }
                  if (l.remSleep) {
                    const match = l.remSleep.match(/(\d+)h\s*(\d+)?m?/);
                    const rMin = match
                      ? parseInt(match[1]) * 60 + (parseInt(match[2]) || 0)
                      : Math.round((l.totalDurationMinutes || 450) * 0.22);
                    stages.push({
                      startTime: new Date(wTime.getTime() - rMin * 60000).toISOString(),
                      endTime: wTime.toISOString(),
                      stage: 6, // REM
                    });
                  }
                  allSessions.push({
                    startTime: bTime.toISOString(),
                    endTime: wTime.toISOString(),
                    title: `Manual Sleep Log - ${l.sleepQuality || 'Good'}`,
                    durationHours: (l.totalDurationMinutes || 450) / 60,
                    stages,
                  });
                }
              }
            });
          }
        }
      } catch (logErr) {
        console.warn('Error reading local sleepLogs in reports:', logErr);
      }

      // 3. Merge sleep diary entries if not already represented
      try {
        const storedDiary = await AsyncStorage.getItem('sleepDiaryEntries');
        if (storedDiary) {
          const parsedDiary = JSON.parse(storedDiary);
          if (Array.isArray(parsedDiary)) {
            parsedDiary.forEach((d: any) => {
              if (d.date || d.bedtime) {
                const sDate = d.date || d.bedtime;
                const existing = allSessions.some(
                  (s: any) =>
                    new Date(s.endTime || s.startTime).toDateString() ===
                    new Date(sDate).toDateString()
                );
                if (!existing && d.bedtime && d.wakeTime) {
                  const bTime = new Date(d.bedtime);
                  let wTime = new Date(d.wakeTime);
                  if (wTime.getTime() <= bTime.getTime()) {
                    wTime = new Date(wTime.getTime() + 24 * 3600000);
                  }
                  const durHours = (wTime.getTime() - bTime.getTime()) / 3600000;
                  allSessions.push({
                    startTime: bTime.toISOString(),
                    endTime: wTime.toISOString(),
                    title: `Diary Sleep - ${d.sleepQuality || 'Good'}`,
                    durationHours: durHours,
                    stages: [],
                  });
                }
              }
            });
          }
        }
      } catch (diaryErr) {
        console.warn('Error reading sleepDiaryEntries in reports:', diaryErr);
      }

      const daysArray = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dynamicLabels = [];
      const weeklyData = [];
      const weeklyRecTrend: number[] = [];
      const weeklyBurnTrend: number[] = [];
      let totalHours = 0;
      let daysWithSleep = 0;

      let weekDeepMs = 0;
      let weekRemMs = 0;
      let weekLightMs = 0;
      let weekAwakeMs = 0;

      // Loop backwards from 6 days ago to today (matching Web Dashboard)
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dynamicLabels.push(daysArray[date.getDay()]);

        // Find sessions for this specific calendar day (based on wake-up time / endTime)
        const sessionsForDay = allSessions.filter((session: any) => {
          const sessionDate = new Date(session.endTime || session.startTime);
          return sessionDate.toDateString() === date.toDateString();
        });

        // Sort sessions by start time
        const sortedSessions = [...sessionsForDay].sort(
          (a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

        // Filter out redundant sessions completely contained within another session (matching Web)
        const uniqueDaySessions = sortedSessions.filter((sessionA: any, idxA: number) => {
          const aStart = new Date(sessionA.startTime).getTime();
          const aEnd = new Date(sessionA.endTime).getTime();
          return !sortedSessions.some((sessionB: any, idxB: number) => {
            if (idxA === idxB) return false;
            const bStart = new Date(sessionB.startTime).getTime();
            const bEnd = new Date(sessionB.endTime).getTime();
            return bStart <= aStart && bEnd >= aEnd && (bEnd - bStart) > (aEnd - aStart);
          });
        });

        // Calculate net sleep duration in hours (excluding awake stages)
        const getSessionNetHours = (session: any) => {
          if (session.durationHours !== undefined && session.durationHours !== null) {
            return session.durationHours;
          }
          if (session.durationMinutes !== undefined && session.durationMinutes !== null) {
            return session.durationMinutes / 60;
          }
          if (session.stages && session.stages.length > 0) {
            let stageMs = 0;
            session.stages.forEach((stage: any) => {
              if (stage.startTime && stage.endTime && stage.stage !== 1 && stage.stage !== 3) {
                const s = new Date(stage.startTime).getTime();
                const e = new Date(stage.endTime).getTime();
                if (!isNaN(s) && !isNaN(e) && e > s) {
                  stageMs += (e - s);
                }
              }
            });
            if (stageMs > 0) return stageMs / (1000 * 60 * 60);
          }
          const start = new Date(session.startTime).getTime();
          const end = new Date(session.endTime).getTime();
          if (!isNaN(start) && !isNaN(end) && end > start) {
            return (end - start) / (1000 * 60 * 60);
          }
          return 0;
        };

        // Sum net sleep duration across all valid sessions for this day
        let dayHours = 0;
        let dayDeepMs = 0;
        let dayRemMs = 0;
        let dayLightMs = 0;
        let dayAwakeMs = 0;

        uniqueDaySessions.forEach((s: any) => {
          const netH = getSessionNetHours(s);
          dayHours += netH;

          // Accumulate stage metrics
          let sessionHasStages = false;
          if (s.stages && s.stages.length > 0) {
            s.stages.forEach((stg: any) => {
              const sTime = new Date(stg.startTime).getTime();
              const eTime = new Date(stg.endTime).getTime();
              if (!isNaN(sTime) && !isNaN(eTime) && eTime > sTime) {
                const dur = eTime - sTime;
                const st = stg.stage;
                if (st === 5 || st === '5' || st === 'DEEP' || st === 'STAGE_DEEP') {
                  dayDeepMs += dur;
                  sessionHasStages = true;
                } else if (st === 6 || st === '6' || st === 'REM' || st === 'STAGE_REM') {
                  dayRemMs += dur;
                  sessionHasStages = true;
                } else if (st === 4 || st === '4' || st === 'LIGHT' || st === 'STAGE_LIGHT' || st === 2 || st === '2' || st === 'SLEEPING') {
                  dayLightMs += dur;
                  sessionHasStages = true;
                } else if (st === 1 || st === '1' || st === 'AWAKE' || st === 3 || st === '3' || st === 'OUT_OF_BED') {
                  dayAwakeMs += dur;
                  sessionHasStages = true;
                }
              }
            });
          }

          if (!sessionHasStages && netH > 0) {
            const durMs = netH * 3600000;
            dayDeepMs += Math.round(durMs * 0.24);
            dayRemMs += Math.round(durMs * 0.22);
            dayLightMs += Math.round(durMs * 0.49);
            dayAwakeMs += Math.round(durMs * 0.05);
          }
        });

        weekDeepMs += dayDeepMs;
        weekRemMs += dayRemMs;
        weekLightMs += dayLightMs;
        weekAwakeMs += dayAwakeMs;

        // Round to 2 decimal places
        dayHours = Math.round(Math.min(dayHours, 24) * 100) / 100;
        weeklyData.push(dayHours);

        // Calculate accurate clinical Recovery and Burnout for this day
        if (dayHours > 0 && dayHours < 16) {
          const baseRec = (dayHours / 8.0) * 85;
          const dayTotalStage = dayDeepMs + dayRemMs + dayLightMs + dayAwakeMs;
          let stageBonus = 0;
          if (dayTotalStage > 0) {
            if (dayDeepMs / dayTotalStage >= 0.20) stageBonus += 5;
            if (dayRemMs / dayTotalStage >= 0.20) stageBonus += 5;
          }
          const dayRec = Math.min(98, Math.max(15, Math.round(baseRec + stageBonus)));
          const sleepDebt = Math.max(0, 8.0 - dayHours);
          const dayBurn = Math.max(10, Math.min(85, Math.round(100 - dayRec * 0.82 + sleepDebt * 3.5)));
          weeklyRecTrend.push(dayRec);
          weeklyBurnTrend.push(dayBurn);
        } else {
          weeklyRecTrend.push(0);
          weeklyBurnTrend.push(0);
        }

        // Only include realistic numbers (less than 14 hours) for the average
        if (dayHours > 0 && dayHours < 14) {
          totalHours += dayHours;
          daysWithSleep++;
        }
      }

      const avgVal = daysWithSleep > 0 ? (totalHours / daysWithSleep) : 0;
      const avgH = Math.floor(avgVal);
      const avgM = Math.round((avgVal - avgH) * 60);
      const formattedAvg = avgM > 0 ? `${avgH}h ${avgM}m` : `${avgH}h`;
      setAvgDuration(formattedAvg);

      // Calculate Consistency similar to Web Dashboard Efficiency (Target: 8 hours)
      let efficiency = avgVal > 0 ? (avgVal / 8) * 100 : 0;
      efficiency = Math.min(100, Math.round(efficiency));
      setConsistency(`${efficiency}%`);

      // Compute Latest Session Stage Composition & Duration (matching Live Dashboard Telemetry)
      let latestTotalFormatted = '0h 0m';
      let latestDeepDuration = '0h 0m';
      let latestRemDuration = '0h 0m';
      let latestLightDuration = '0h 0m';
      let latestAwakeDuration = '0h 0m';
      let latestDeepPct = 34;
      let latestRemPct = 24;
      let latestLightPct = 38;
      let latestAwakePct = 4;
      let foundDashboardTelemetry = false;

      // 1. Check if cached live wearable sleep telemetry exists from the dashboard
      try {
        const cachedRaw = await AsyncStorage.getItem('latestWearableSleep');
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && (cached.totalSleepFormatted || cached.totalMinutes || cached.totalSleepHours)) {
            let formatted = cached.totalSleepFormatted;
            if (!formatted && cached.hours !== undefined && cached.minutes !== undefined) {
              formatted = `${cached.hours}h ${cached.minutes}m`;
            } else if (!formatted && cached.totalSleepHours) {
              const match = cached.totalSleepHours.match(/(\d+)\s*hour.*?(\d+)\s*min/i);
              if (match) {
                formatted = `${match[1]}h ${match[2]}m`;
              }
            }

            if (formatted) {
              latestTotalFormatted = formatted;
              foundDashboardTelemetry = true;

              const totalMs =
                cached.totalSleepMs ||
                ((cached.hours || 0) * 60 + (cached.minutes || 0)) * 60000;
              const dMs = cached.deepMs || Math.round(totalMs * 0.34);
              const rMs = cached.remMs || Math.round(totalMs * 0.24);
              const ltMs = cached.lightMs || Math.round(totalMs * 0.38);
              const aMs = cached.awakeMs || Math.round(totalMs * 0.04);

              const fmtDur = (ms: number) => {
                const totalM = Math.round(ms / 60000);
                const h = Math.floor(totalM / 60);
                const m = totalM % 60;
                if (h > 0) return `${h}h ${m}m`;
                return `${m}m`;
              };

              latestDeepDuration = fmtDur(dMs);
              latestRemDuration = fmtDur(rMs);
              latestLightDuration = fmtDur(ltMs);
              latestAwakeDuration = fmtDur(aMs);
              latestDeepPct = 34;
              latestRemPct = 24;
              latestLightPct = 38;
              latestAwakePct = 4;
            }
          }
        }
      } catch (cacheErr) {
        console.warn('Error reading latestWearableSleep in reports:', cacheErr);
      }

      // 2. If not cached from live dashboard yet, calculate with identical net sleep logic
      if (!foundDashboardTelemetry && allSessions.length > 0) {
        // Sort sessions descending by endTime / startTime to find the latest
        const sortedSessions = [...allSessions].sort((a, b) => {
          const tA = new Date(a.endTime || a.startTime).getTime();
          const tB = new Date(b.endTime || b.startTime).getTime();
          return tB - tA;
        });

        const latestSession = sortedSessions[0];

        // Group all sessions from the same night as the most recent session (matching home.tsx)
        const latestEndDate = new Date(latestSession.endTime || latestSession.startTime).toDateString();
        const latestStartDate = new Date(latestSession.startTime || latestSession.endTime).toDateString();
        const nightSessions = sortedSessions.filter((s: any) => {
          const sEnd = new Date(s.endTime || s.startTime).toDateString();
          const sStart = new Date(s.startTime || s.endTime).toDateString();
          return sEnd === latestEndDate || sStart === latestEndDate || sEnd === latestStartDate;
        });

        // Collect ALL stages across all sessions for this night
        let allStages: any[] = [];
        nightSessions.forEach((session: any) => {
          if (session?.stages && session.stages.length > 0) {
            allStages = allStages.concat(session.stages.filter(Boolean));
          }
        });

        let netSleepMs = 0;
        let lDeepMs = 0;
        let lRemMs = 0;
        let lLightMs = 0;
        let lAwakeMs = 0;
        let hasGranular = false;

        if (allStages.length > 0) {
          allStages.forEach((stage: any) => {
            const sTime = new Date(stage.startTime).getTime();
            const eTime = new Date(stage.endTime).getTime();
            if (!isNaN(sTime) && !isNaN(eTime) && eTime > sTime) {
              const dur = eTime - sTime;
              const st = stage.stage;

              // Net sleep: Exclude AWAKE (1) and OUT_OF_BED (3)
              if (st !== 1 && st !== 3 && st !== 'AWAKE' && st !== 'OUT_OF_BED') {
                netSleepMs += dur;
              }

              if (st === 5 || st === '5' || st === 'DEEP' || st === 'STAGE_DEEP') {
                lDeepMs += dur;
                hasGranular = true;
              } else if (st === 6 || st === '6' || st === 'REM' || st === 'STAGE_REM') {
                lRemMs += dur;
                hasGranular = true;
              } else if (
                st === 4 ||
                st === '4' ||
                st === 'LIGHT' ||
                st === 'STAGE_LIGHT' ||
                st === 2 ||
                st === '2' ||
                st === 'SLEEPING'
              ) {
                lLightMs += dur;
                hasGranular = true;
              } else if (
                st === 1 ||
                st === '1' ||
                st === 'AWAKE' ||
                st === 3 ||
                st === '3' ||
                st === 'OUT_OF_BED'
              ) {
                lAwakeMs += dur;
                hasGranular = true;
              }
            }
          });
        }

        if (netSleepMs === 0 && latestSession.startTime && latestSession.endTime) {
          const s = new Date(latestSession.startTime).getTime();
          const e = new Date(latestSession.endTime).getTime();
          if (!isNaN(s) && !isNaN(e) && e > s) {
            netSleepMs = e - s;
          }
        }
        if (netSleepMs === 0 && latestSession.durationHours) {
          netSleepMs = latestSession.durationHours * 3600000;
        }

        const totalMins = Math.floor(netSleepMs / (1000 * 60));
        const lH = Math.floor(totalMins / 60);
        const lM = totalMins % 60;
        latestTotalFormatted = lM > 0 ? `${lH}h ${lM}m` : `${lH}h`;

        if (!hasGranular && netSleepMs > 0) {
          // Standard distribution matching home.tsx: Deep 34%, REM 24%, Light 38%, Awake 4%
          lDeepMs = Math.round(netSleepMs * 0.34);
          lRemMs = Math.round(netSleepMs * 0.24);
          lLightMs = Math.round(netSleepMs * 0.38);
          lAwakeMs = Math.round(netSleepMs * 0.04);
        }

        const lTotalStageMs = lDeepMs + lRemMs + lLightMs + lAwakeMs;
        if (lTotalStageMs > 0) {
          latestDeepPct = Math.round((lDeepMs / lTotalStageMs) * 100);
          latestRemPct = Math.round((lRemMs / lTotalStageMs) * 100);
          latestLightPct = Math.round((lLightMs / lTotalStageMs) * 100);
          latestAwakePct = Math.max(1, 100 - latestDeepPct - latestRemPct - latestLightPct);
        }

        const formatMins = (ms: number) => {
          const mins = Math.round(ms / 60000);
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          if (h > 0) return `${h}h ${m}m`;
          return `${m}m`;
        };

        latestDeepDuration = formatMins(lDeepMs);
        latestRemDuration = formatMins(lRemMs);
        latestLightDuration = formatMins(lLightMs);
        latestAwakeDuration = formatMins(lAwakeMs);
      }

      setLatestSleepDuration(latestTotalFormatted);
      setStagesBreakdown({
        deep: {
          duration: latestDeepDuration,
          percent: latestDeepPct,
        },
        rem: {
          duration: latestRemDuration,
          percent: latestRemPct,
        },
        light: {
          duration: latestLightDuration,
          percent: latestLightPct,
        },
        awake: {
          duration: latestAwakeDuration,
          percent: latestAwakePct,
        },
      });

      setRecoveryTrend(weeklyRecTrend);
      setBurnoutTrend(weeklyBurnTrend);

      // Generate dynamic AI Insight using friendly clock format
      if (avgVal >= 7 && avgVal <= 9) {
        setAiInsight(`Your average sleep duration is ${formattedAvg}, which is within the optimal range of 7-9 hours. Keep up the great work!`);
      } else if (avgVal > 0 && avgVal < 7) {
        setAiInsight(`You are averaging ${formattedAvg} of sleep, which is below the recommended 7 hours. Try gradually adjusting your bedtime earlier to get more rest.`);
      } else if (avgVal > 9) {
        setAiInsight(`You are averaging ${formattedAvg} of sleep. While sleep is important, oversleeping consistently can sometimes leave you feeling groggy.`);
      } else {
        setAiInsight("Not enough realistic sleep data to generate an insight for this week.");
      }

      setChartData({
        labels: dynamicLabels,
        datasets: [{ data: weeklyData }]
      });
    } catch (e) {
      console.error('Failed to fetch sleep history:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const chartConfig = {
    backgroundGradientFrom: '#1a1a2e',
    backgroundGradientTo: '#1a1a2e',
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    color: (opacity = 1) => `rgba(162, 89, 255, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.55,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    formatTopBarValue: (val: number) => {
      if (!val || val <= 0) return '';
      const h = Math.floor(val);
      const m = Math.round((val - h) * 60);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    },
  };

  return (
    <LinearGradient colors={['#1a1a2e', '#23234b']} style={styles.container}>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bar-chart" size={24} color="#a259ff" />
            <Text style={styles.cardTitle}>Weekly Summary</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator size="large" color="#a259ff" style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={chartData}
                width={Math.max(screenWidth - 50, 440)}
                height={225}
                yAxisSuffix="h"
                yAxisLabel=""
                chartConfig={chartConfig}
                style={styles.chartStyle}
                showValuesOnTopOfBars={true}
                fromZero={true}
              />
            </ScrollView>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { borderColor: 'rgba(67, 233, 123, 0.3)' }]}>
            <Ionicons name="checkmark-circle" size={28} color="#43e97b" style={styles.statIcon} />
            <Text style={styles.statValue}>{avgDuration}</Text>
            <Text style={styles.statLabel}>Avg Duration</Text>
          </View>

          <View style={[styles.statBox, { borderColor: 'rgba(255, 140, 66, 0.3)' }]}>
            <Ionicons name="flame" size={28} color="#ff8c42" style={styles.statIcon} />
            <Text style={styles.statValue}>{consistency}</Text>
            <Text style={styles.statLabel}>Consistency</Text>
          </View>
        </View>

        {/* 1. Recovery vs. Burnout Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="pulse" size={24} color="#22c55e" />
              <Text style={styles.cardTitle}>Recovery vs. Burnout</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsInfoModalOpen(true)}
              style={styles.infoIconButton}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="help-circle-outline" size={22} color="#8a99ad" />
            </TouchableOpacity>
          </View>

          {/* Chart Legend */}
          <View style={styles.chartLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.legendText}>Recovery</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Burnout</Text>
            </View>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#22c55e" style={{ marginVertical: 30 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: chartData.labels,
                  datasets: [
                    {
                      data: recoveryTrend,
                      color: () => '#22c55e',
                      strokeWidth: 2.5,
                    },
                    {
                      data: burnoutTrend,
                      color: () => '#f59e0b',
                      strokeWidth: 2.5,
                    },
                  ],
                }}
                width={Math.max(screenWidth - 50, 440)}
                height={190}
                chartConfig={{
                  backgroundColor: '#1a1a2e',
                  backgroundGradientFrom: '#1a1a2e',
                  backgroundGradientTo: '#1a1a2e',
                  backgroundGradientFromOpacity: 0,
                  backgroundGradientToOpacity: 0,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.4})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.8})`,
                  propsForDots: {
                    r: '4',
                    strokeWidth: '1.5',
                  },
                  propsForBackgroundLines: {
                    stroke: 'rgba(255, 255, 255, 0.06)',
                  },
                }}
                bezier
                style={styles.chartStyle}
                fromZero={true}
              />
            </ScrollView>
          )}
        </View>

        {/* 2. Sleep Stage Breakdown Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithBadge}>
            <View style={styles.stageTitleRow}>
              <Ionicons name="layers" size={20} color="#38bdf8" />
              <Text style={styles.stageCardTitleHeader} numberOfLines={1}>
                Sleep Stage Breakdown
              </Text>
            </View>
            <View style={styles.latestDurationBadge}>
              <Text style={styles.latestDurationBadgeText}>
                {latestSleepDuration} total
              </Text>
            </View>
          </View>

          <Text style={styles.stageSubtitle}>
            Latest session stage composition
          </Text>

          {/* 2x2 Grid of Stage Metric Cards */}
          <View style={styles.stagesGrid}>
            {/* Deep Sleep */}
            <View style={[styles.stageCard, { borderLeftColor: '#38bdf8' }]}>
              <View style={styles.stageCardHeader}>
                <View style={[styles.stageDot, { backgroundColor: '#38bdf8' }]} />
                <Text style={styles.stageCardTitle}>Deep Sleep</Text>
              </View>
              <View style={styles.stageValuesRow}>
                <Text style={styles.stageDurationText}>{stagesBreakdown.deep.duration}</Text>
                <Text style={[styles.stagePercentBadge, { color: '#38bdf8' }]}>
                  {stagesBreakdown.deep.percent}%
                </Text>
              </View>
              <Text style={styles.stageDescText}>Tissue repair & physical recovery</Text>
            </View>

            {/* REM Sleep */}
            <View style={[styles.stageCard, { borderLeftColor: '#a855f7' }]}>
              <View style={styles.stageCardHeader}>
                <View style={[styles.stageDot, { backgroundColor: '#a855f7' }]} />
                <Text style={styles.stageCardTitle}>REM Sleep</Text>
              </View>
              <View style={styles.stageValuesRow}>
                <Text style={styles.stageDurationText}>{stagesBreakdown.rem.duration}</Text>
                <Text style={[styles.stagePercentBadge, { color: '#a855f7' }]}>
                  {stagesBreakdown.rem.percent}%
                </Text>
              </View>
              <Text style={styles.stageDescText}>Memory consolidation & dreams</Text>
            </View>

            {/* Light Sleep */}
            <View style={[styles.stageCard, { borderLeftColor: '#818cf8' }]}>
              <View style={styles.stageCardHeader}>
                <View style={[styles.stageDot, { backgroundColor: '#818cf8' }]} />
                <Text style={styles.stageCardTitle}>Light Sleep</Text>
              </View>
              <View style={styles.stageValuesRow}>
                <Text style={styles.stageDurationText}>{stagesBreakdown.light.duration}</Text>
                <Text style={[styles.stagePercentBadge, { color: '#818cf8' }]}>
                  {stagesBreakdown.light.percent}%
                </Text>
              </View>
              <Text style={styles.stageDescText}>Core sleep & mental reset</Text>
            </View>

            {/* Awake */}
            <View style={[styles.stageCard, { borderLeftColor: '#f87171' }]}>
              <View style={styles.stageCardHeader}>
                <View style={[styles.stageDot, { backgroundColor: '#f87171' }]} />
                <Text style={styles.stageCardTitle}>Awake</Text>
              </View>
              <View style={styles.stageValuesRow}>
                <Text style={styles.stageDurationText}>{stagesBreakdown.awake.duration}</Text>
                <Text style={[styles.stagePercentBadge, { color: '#f87171' }]}>
                  {stagesBreakdown.awake.percent}%
                </Text>
              </View>
              <Text style={styles.stageDescText}>Brief natural night wakeups</Text>
            </View>
          </View>
        </View>

        {/* 3. AI Insight Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle" size={24} color="#5d3fd3" />
            <Text style={styles.cardTitle}>AI Insight</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color="#5d3fd3" />
          ) : (
            <Text style={styles.insightText}>{aiInsight}</Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Recovery vs. Burnout Info Guide Modal */}
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
          <View style={styles.infoModalContainer}>
            <View style={styles.infoModalHeader}>
              <View style={styles.infoModalTitleRow}>
                <Ionicons name="information-circle" size={22} color="#22c55e" />
                <Text style={styles.infoModalTitle}>Recovery vs. Burnout</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsInfoModalOpen(false)}
                style={styles.infoModalCloseButton}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Recovery Item */}
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

              {/* Burnout Item */}
              <View style={styles.infoSectionBox}>
                <View style={styles.infoSectionHeader}>
                  <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                  <Text style={[styles.infoSectionHeading, { color: '#f59e0b' }]}>
                    Burnout (Orange Line)
                  </Text>
                </View>
                <Text style={styles.infoSectionText}>
                  Measures physiological fatigue and stress accumulation driven by sleep debt and short rest. Lower is better (Target: 10–30).
                </Text>
              </View>

              {/* How to Read */}
              <View style={styles.infoTipBox}>
                <Ionicons name="bulb-outline" size={18} color="#ffd166" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTipTitle}>How to read this chart:</Text>
                  <Text style={styles.infoTipText}>
                    Keep the green recovery line safely above the orange burnout line. When the lines converge or cross, your body is experiencing sleep deficit and needs an earlier bedtime or restorative rest.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.infoGotItButton}
              onPress={() => setIsInfoModalOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.infoGotItText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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

              {/* Active Tab: Sleep Reports */}
              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  {
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(59, 130, 246, 0.35)',
                  },
                ]}
                onPress={() => setIsMenuOpen(false)}
              >
                <Ionicons name="bar-chart" size={22} color="#3b82f6" />
                <Text style={[styles.drawerNavText, { color: '#3b82f6', fontWeight: 'bold' }]}>
                  Sleep Reports
                </Text>
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
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#0d0d1a',
    zIndex: 10,
    elevation: 6,
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
  },
  greeting: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
  profileName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileButton: {
    padding: 8,
  },
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
  content: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  chartStyle: {
    marginVertical: 8,
    borderRadius: 16,
    alignSelf: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIcon: {
    marginBottom: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  insightText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 15,
    lineHeight: 22,
  },
  chartLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  cardHeaderWithBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
    gap: 8,
  },
  stageCardTitleHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  latestDurationBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    alignSelf: 'center',
  },
  latestDurationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  stageSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 16,
    marginTop: 0,
  },
  stagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  stageCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3.5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  stageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stageCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  stageValuesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  stageDurationText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  stagePercentBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  stageDescText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.45)',
    lineHeight: 13,
  },
  cardHeaderWithInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoIconButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#161c2e',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoModalCloseButton: {
    padding: 4,
  },
  infoSectionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoSectionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 18,
  },
  infoTipBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 209, 102, 0.08)',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.2)',
    marginBottom: 12,
  },
  infoTipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffd166',
    marginBottom: 4,
  },
  infoTipText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 17,
  },
  infoGotItButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  infoGotItText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
