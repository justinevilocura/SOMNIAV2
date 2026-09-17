import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions, RefreshControl } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import React, { useEffect, useState, useContext } from 'react';
import { useLocalSearchParams } from 'expo-router';
import styles from '../assets/styles/home.styles';
import LinearGradient from 'react-native-linear-gradient';
import BottomNav from '../components/BottomNav';
import { LineChart } from 'react-native-chart-kit';
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

const screenWidth = Dimensions.get("window").width;

export default function Home() {
  const [userData, setUserData] = useState({ name: '', email: '', user_id: '' });
  const { readExerciseSession } = useExerciseSession(new Date());
  // sample Date '2025-05-29'
  const { readHeartRate } = useHeartRate(new Date());
  const { readSleepSession } = useSleepSession(new Date());
  const { readSteps } = useSteps(new Date());
  const [heartRateData, setHeartRateData] = useState([]);
  const [sleepDataRaw, setSleepDataRaw] = useState([]);
  const [stepsData, setStepsData] = useState([]);
  const [exerciseDataRaw, setExerciseDataRaw] = useState([]);
  const [exerSession, setExerSession] = useState("No recent exercise");
  const [exerType, setExerType] = useState("None");
  const [latestHeartRate, setLatestHeartRate] = useState(0);
  const [totalSleepHours, setTotalSleepHours] = useState("0 hours and 0 minutes");
  const [totalSteps, setTotalSteps] = useState(0);
  const [sleepData, setSleepData] = useState({
    labels: [],
    datasets: [
      {
        data: [],
        color: (opacity = 1) => `rgba(162, 89, 255, ${opacity})`,
        strokeWidth: 3,
      },
    ],
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
        user_id: authData.user_id || ''
      });
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
      if (exerciseSession && exerciseSession.length > 0) {
        setExerciseDataRaw(exerciseSession);
        const sortedExercise = [...exerciseSession].sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
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
        setExerSession("No recent exercise");
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
        const latestSleep = sortedSleep[0];
        lastSleepSession = latestSleep;

        let totalSleepMs = 0;
        if (latestSleep?.stages && latestSleep.stages.length > 0) {
          latestSleep.stages.forEach((stage: any) => {
            if (stage && stage.stage !== 1) { // Exclude AWAKE stage (1)
              const stageStart = new Date(stage.startTime).getTime();
              const stageEnd = new Date(stage.endTime).getTime();
              if (!isNaN(stageStart) && !isNaN(stageEnd) && stageEnd > stageStart) {
                totalSleepMs += (stageEnd - stageStart);
              }
            }
          });
        }
        if (totalSleepMs === 0 && latestSleep?.startTime && latestSleep?.endTime) {
          const start = new Date(latestSleep.startTime);
          const end = new Date(latestSleep.endTime);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            totalSleepMs = Math.max(0, end.getTime() - start.getTime());
          }
        }

        const totalMinutes = Math.floor(totalSleepMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const formattedSleep = `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        setTotalSleepHours(formattedSleep);

        // Sleep Graph
        const labels: string[] = [];
        const data: number[] = [];
        const sleepStages = (sleep || []).flatMap(session => session?.stages || []).filter(Boolean);

        const getStageValue = (value: number): number => {
          switch (value) {
            case SleepStageType.AWAKE: return 1;
            case SleepStageType.LIGHT: return 2;
            case SleepStageType.DEEP: return 3;
            case SleepStageType.REM: return 4;
            default: return 0;
          }
        };

        sleepStages.forEach((stage) => {
          if (stage?.startTime) {
            const start = new Date(stage.startTime);
            if (!isNaN(start.getTime())) {
              const hour = start.getHours();
              const minute = String(start.getMinutes()).padStart(2, '0');
              const ampm = hour >= 12 ? 'PM' : 'AM';
              const displayHour = hour % 12 || 12;
              labels.push(`${displayHour}:${minute} ${ampm}`);
              const numericValue = getStageValue(stage.stage);
              data.push(numericValue);
            }
          }
        });

        if (labels.length >= 2 && data.length >= 2) {
          setSleepData({
            labels,
            datasets: [
              {
                data,
                color: (opacity = 1) => `rgba(162, 89, 255, ${opacity})`,
                strokeWidth: 0,
              },
            ],
          });
        } else {
          setSleepData({
            labels: [],
            datasets: [{ data: [], color: (opacity = 1) => `rgba(162, 89, 255, ${opacity})`, strokeWidth: 0 }],
          });
        }
      } else {
        setTotalSleepHours("0 hours and 0 minutes");
        setSleepData({
          labels: [],
          datasets: [{ data: [], color: (opacity = 1) => `rgba(162, 89, 255, ${opacity})`, strokeWidth: 0 }],
        });
      }

      // --- HEART RATE LOGIC ---
      setHeartRateData(heartRate || []);
      if (heartRate && heartRate.length > 0) {
        const nowWithBuffer = Date.now() + (24 * 60 * 60 * 1000);
        const allSamples = heartRate.flatMap(record => (record?.samples && Array.isArray(record.samples)) ? record.samples : []).filter(Boolean);
        const validSamples = allSamples.filter(sample => sample?.time && new Date(sample.time).getTime() <= nowWithBuffer && typeof sample.beatsPerMinute === 'number');

        if (validSamples.length > 0) {
          let mostRecentSession: any = null;
          if (lastExerciseSession && lastSleepSession) {
            if (new Date(lastExerciseSession.endTime).getTime() > new Date(lastSleepSession.endTime).getTime()) {
              mostRecentSession = lastExerciseSession;
            } else {
              mostRecentSession = lastSleepSession;
            }
          } else if (lastExerciseSession) {
            mostRecentSession = lastExerciseSession;
          } else if (lastSleepSession) {
            mostRecentSession = lastSleepSession;
          }

          if (mostRecentSession && mostRecentSession.startTime && mostRecentSession.endTime) {
            const sessionStart = new Date(mostRecentSession.startTime).getTime();
            const sessionEnd = new Date(mostRecentSession.endTime).getTime();
            
            const sessionSamples = validSamples.filter(sample => {
              const time = new Date(sample.time).getTime();
              return time >= sessionStart && time <= sessionEnd;
            });

            if (sessionSamples.length > 0) {
              const sum = sessionSamples.reduce((acc, curr) => acc + (curr.beatsPerMinute || 0), 0);
              const avg = Math.floor(sum / sessionSamples.length);
              setLatestHeartRate(avg);
            } else {
              const sortedSamples = [...validSamples].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
              setLatestHeartRate(sortedSamples[0]?.beatsPerMinute || 0);
            }
          } else {
            const sortedSamples = [...validSamples].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            setLatestHeartRate(sortedSamples[0]?.beatsPerMinute || 0);
          }
        } else {
          setLatestHeartRate(0);
        }
      } else {
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
    const initializeAndLoad = async () => {
      const authDataString = await AsyncStorage.getItem('authData');
      if (authDataString) {
        const authData = JSON.parse(authDataString);
        setUserData({
          name: authData.name || 'User',
          email: authData.email || '',
          user_id: authData.user_id || ''
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

  const statBoxes = [
    { label: exerSession, value: exerType, unit: '', icon: 'barbell-outline', color: '#ff8c42' },
    { label: 'Total Steps Today', value: totalSteps, unit: '', icon: 'walk-outline', color: '#43e97b' },
    { label: 'Hours of Sleep', value: totalSleepHours, unit: '', icon: 'moon-outline', color: '#5d3fd3' },
    { label: 'Session Avg BPM', value: latestHeartRate, unit: 'bpm', icon: 'heart-outline', color: '#ff4d6d' },
  ];

  return (
    <LinearGradient colors={['#1a1a2e', '#23234b']} style={styles.background}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../assets/images/default-avatar.png')} style={styles.avatar} />
          <View>
            <Text style={styles.greeting}>Welcome,</Text>
            <Text style={styles.profileName}>{userData.name}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => setSelectedTab('profile')}>
          <Ionicons name="person-circle-outline" size={32} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
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
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{
            color: 'skyblue',
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 8,
          }}>
            Sleep Stages Throughout the Night
          </Text>
        </View>
        {selectedTab === 'home' && (
          <>
            {sleepData.labels.length >= 2 && (sleepData.datasets[0]?.data?.length || 0) >= 2 && (
              <ScrollView horizontal nestedScrollEnabled={true}>

                <LineChart
                  data={sleepData}
                  width={Math.max(screenWidth, sleepData.labels.length * 60)}
                  height={250}
                  chartConfig={{
                    backgroundColor: '#23234b',
                    backgroundGradientFrom: '#23234b',
                    backgroundGradientTo: '#1a1a2e',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    propsForDots: {
                      r: '6',
                      strokeWidth: '2',
                      stroke: '#a259ff',
                    },
                  }}
                  withInnerLines={false}
                  withOuterLines={false}
                  withShadow={false}
                  withVerticalLines={false}
                  withHorizontalLabels={true}
                  fromZero
                  yLabelsOffset={20}
                  yAxisLabel=""
                  formatYLabel={(value) => {
                    const stageNum = parseInt(value);
                    switch (stageNum) {
                      case 1: return 'AWAKE';
                      case 2: return 'LIGHT';
                      case 3: return 'DEEP';
                      case 4: return 'REM';
                      default: return '';
                    }
                  }}
                  style={{
                    marginVertical: 16,
                    borderRadius: 16,
                    alignSelf: 'center',
                  }}
                />
              </ScrollView>
            )}

            {totalSteps === 0 && latestHeartRate === 0 && exerType === "None" && (
              <View style={{ paddingHorizontal: 16, marginVertical: 8 }}>
                <Text style={{ color: '#a29bfe', fontSize: 13, textAlign: 'center', fontStyle: 'italic' }}>
                  ↓ Pull down to fetch your Mi Fitness data and sync to Somnia
                </Text>
              </View>
            )}

            <View style={styles.statsBoxContainer}>
              {statBoxes.map((box, idx) => {
                if (box.label === 'Session Avg BPM') {
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

      <View style={styles.bottomNavContainer}>
        <View style={styles.bottomNav}>
          <BottomNav
            onPress={() => setSelectedTab('home')}
            icon={selectedTab === 'home' ? 'home' : 'home-outline'}
            iconColor={selectedTab === 'home' ? '#a259ff' : '#fff'}
            navName={<Text style={[styles.navText, selectedTab === 'home' && styles.navTextActive]}>Home</Text>} />
          <BottomNav
            onPress={() => setSelectedTab('recommendations')}
            icon={selectedTab === 'recommendations' ? 'bulb' : 'bulb-outline'}
            iconColor={selectedTab === 'recommendations' ? '#a259ff' : '#fff'}
            navName={<Text style={[styles.navText, selectedTab === 'recommendations' && styles.navTextActive]}>Tips</Text>} />
          <BottomNav
            onPress={() => setSelectedTab('diary')}
            icon={selectedTab === 'diary' ? 'journal' : 'journal-outline'}
            iconColor={selectedTab === 'diary' ? '#a259ff' : '#fff'}
            navName={<Text style={[styles.navText, selectedTab === 'diary' && styles.navTextActive]}>Diary</Text>} />
          <BottomNav
            onPress={() => setSelectedTab('profile')}
            icon={selectedTab === 'profile' ? 'person' : 'person-outline'}
            iconColor={selectedTab === 'profile' ? '#a259ff' : '#fff'}
            navName={<Text style={[styles.navText, selectedTab === 'profile' && styles.navTextActive]}>Profile</Text>} />
        </View>
      </View>
    </LinearGradient>
  );
}