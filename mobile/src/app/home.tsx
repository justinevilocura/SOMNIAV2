import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions, RefreshControl } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import styles from '../assets/styles/home.styles';
import LinearGradient from 'react-native-linear-gradient';
import BottomNav from '../components/BottomNav';
import { LineChart } from 'react-native-chart-kit';
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
  const [exerSession, setExerSession] = useState("");
  const [exerType, setExerType] = useState("");
  const [latestHeartRate, setLatestHeartRate] = useState(0);
  const [totalSleepHours, setTotalSleepHours] = useState("");
  const [totalSteps, setTotalSteps] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
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

  const fetchHealthData = useCallback(async () => {
    const authDataString = await AsyncStorage.getItem('authData');
    if (authDataString) {
      const authData = JSON.parse(authDataString);
      setUserData({
        name: authData.name || 'User',
        email: authData.email || '',
        user_id: authData.user_id || ''
      });
    }

    let isInitialized = false;
    let steps = [];
    let heartRate = [];
    let sleep = [];
    let exerciseSession = [];

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
        steps = await readSteps() || [];
        heartRate = await readHeartRate() || [];
        sleep = await readSleepSession() || [];
        exerciseSession = await readExerciseSession() || [];

        console.log(`=== APPLE HEALTH REAL DATA ===`);
        console.log(`Real Steps Count: ${steps.length}`);
        console.log(`Real Heart Rate Count: ${heartRate.length}`);
        console.log(`Real Sleep Count: ${sleep.length}`);
        console.log(`Real Exercise Count: ${exerciseSession.length}`);
      }
    } catch (error) {
      console.warn('Apple Health not available:', error);
    }

    if (exerciseSession.length > 0) {
      const lastExercise = exerciseSession.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];
      const start = new Date(lastExercise.startTime);
      const end = new Date(lastExercise.endTime);
      const totalExerciseMs = end.getTime() - start.getTime();
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

      const getExerciseName = (value: number): string | undefined => {
        return Object.keys(ExerciseType).find(
          (key) => ExerciseType[key as keyof typeof ExerciseType] === value
        );
      };
      const exerciseName = getExerciseName(exerciseSession[0].exerciseType);
      let displayName = exerciseName || 'Unknown';

      if (displayName === 'OTHER' && exerciseSession[0].activityName) {
        const rawName = exerciseSession[0].activityName;
        // Split camelCase/PascalCase into words (e.g. "FunctionalStrengthTraining" -> "Functional Strength Training")
        displayName = rawName
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
          .trim();
      } else {
        if (displayName === 'WALKING') displayName = 'Walking';
        else if (displayName === 'RUNNING') displayName = 'Running';
        else if (displayName === 'CYCLING') displayName = 'Cycling';
        else if (displayName === 'SWIMMING') displayName = 'Swimming';
        else if (displayName === 'HIKING') displayName = 'Hiking';
        else if (displayName === 'OTHER') displayName = 'Other';
      }

      setExerType(displayName);
    } else {
      setExerSession("No recent exercise");
      setExerType("None");
    }

    setHeartRateData(heartRate);
    setStepsData(steps);
    const totalStepsSum = steps.reduce((sum: number, s: any) => sum + (s.count || 0), 0);
    setTotalSteps(Math.floor(totalStepsSum));
    if (heartRate.length > 0 && heartRate[0].samples.length > 0) {
      setLatestHeartRate(heartRate[0].samples[0].beatsPerMinute);
    }

    if (sleep.length > 0) {
      setSleepDataRaw(sleep);

      const sortedSleep = [...sleep].sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
      const latestSleep = sortedSleep[0];

      const start = new Date(latestSleep.startTime);
      const end = new Date(latestSleep.endTime);

      const today = new Date();
      const endedToday = end.getDate() === today.getDate() &&
        end.getMonth() === today.getMonth() &&
        end.getFullYear() === today.getFullYear();

      if (endedToday) {
        let asleepMs = latestSleep.asleepMs;
        if (asleepMs === undefined || asleepMs === null) {
          const sleepStages = latestSleep.stages || [];
          asleepMs = 0;
          sleepStages.forEach(s => {
            if ([SleepStageType.LIGHT, SleepStageType.DEEP, SleepStageType.REM, SleepStageType.SLEEPING].includes(s.stage)) {
              const sStart = new Date(s.startTime).getTime();
              const sEnd = new Date(s.endTime).getTime();
              asleepMs += (sEnd - sStart);
            }
          });

          // Fallback to total duration if no asleep stages were found
          if (asleepMs === 0) {
            asleepMs = end.getTime() - start.getTime();
          }
        }

        const totalMinutes = Math.ceil(asleepMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const formattedSleep = `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        setTotalSleepHours(formattedSleep);
      } else {
        setTotalSleepHours("0 hours and 0 minutes");
      }
    } else {
      setTotalSleepHours("0 hours and 0 minutes");
    }

    const labels: string[] = [];
    const data: number[] = [];

    const getStageValue = (value: number): number => {
      switch (value) {
        case SleepStageType.AWAKE: return 1;
        case SleepStageType.LIGHT: return 2;
        case SleepStageType.DEEP: return 3;
        case SleepStageType.REM: return 4;
        default: return 0;
      }
    };

    if (sleep.length > 0) {
      const sortedSleep = [...sleep].sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
      const latestSleep = sortedSleep[0];
      const end = new Date(latestSleep.endTime);
      const today = new Date();
      const endedToday = end.getDate() === today.getDate() &&
        end.getMonth() === today.getMonth() &&
        end.getFullYear() === today.getFullYear();

      if (endedToday) {
        const sleepStages = [...(latestSleep.stages || [])].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        sleepStages.forEach((stage) => {
          const start = new Date(stage.startTime);
          const hour = start.getHours();
          const minute = String(start.getMinutes()).padStart(2, '0');
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour % 12 || 12;
          labels.push(`${displayHour}:${minute} ${ampm}`);
          const numericValue = getStageValue(stage.stage);
          data.push(numericValue);
        });
      }
    }

    setSleepData({
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: [
        {
          data: data.length > 0 ? data : [0],
          color: (opacity = 1) => `rgba(162, 89, 255, ${opacity})`,
          strokeWidth: 0,
        },
      ],
    });
  }, [readExerciseSession, readHeartRate, readSleepSession, readSteps]);

  useFocusEffect(
    useCallback(() => {
      fetchHealthData();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHealthData();
    setRefreshing(false);
  }, [fetchHealthData]);

  const params = useLocalSearchParams();
  const [selectedTab, setSelectedTab] = useState(params.tab ? params.tab.toString() : 'home');

  useEffect(() => {
    const loadUserData = async () => {
      const authDataString = await AsyncStorage.getItem('authData');
      if (authDataString) {
        const authData = JSON.parse(authDataString);
        setUserData({
          name: authData.name || 'User',
          email: authData.email || '',
          user_id: authData.user_id || ''
        });
      }
    };
    loadUserData();
  }, []);

  const statBoxes = [
    { label: exerSession, value: exerType, unit: '', icon: 'barbell-outline', color: '#ff8c42' },
    { label: 'Total Steps Today', value: totalSteps, unit: '', icon: 'walk-outline', color: '#43e97b' },
    { label: 'Hours of Sleep', value: totalSleepHours, unit: '', icon: 'moon-outline', color: '#5d3fd3' },
    { label: 'Latest Heart Rate', value: latestHeartRate, unit: 'bpm', icon: 'heart-outline', color: '#ff4d6d' },
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
            tintColor="#a259ff"
            colors={["#a259ff"]}
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
            {sleepData.labels.length > 0 && (
              <ScrollView horizontal>

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

            <View style={styles.statsBoxContainer}>
              {statBoxes.map((box, idx) => (
                <View key={idx} style={[styles.statBox, { backgroundColor: box.color + '22' }]}>
                  <Ionicons name={box.icon} size={28} color={box.color} style={{ marginBottom: 6 }} />
                  <Text style={[styles.statBoxValue, { color: box.color }]}>{box.value} <Text style={styles.statBoxUnit}>{box.unit}</Text></Text>
                  <Text style={styles.statBoxLabel}>{box.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.syncButton}
              onPress={async () => {
                if (!userData.user_id) {
                  Toast.show({ type: 'error', text1: 'Sync Failed', text2: 'No user ID found!' });
                  return;
                }
                try {
                  Toast.show({ type: 'info', text1: 'Syncing...', text2: 'Please wait' });
                  await syncToDB(heartRateData, sleepDataRaw, stepsData, userData.user_id);
                  Toast.show({ type: 'success', text1: 'Sync Successful', text2: 'Health data saved to database!' });
                } catch (error) {
                  Toast.show({ type: 'error', text1: 'Sync Failed', text2: error.message });
                }
              }}>
              <Text style={styles.syncButtonText}>Sync data to database</Text>
            </TouchableOpacity>
          </>
        )}

        {selectedTab === 'recommendations' && <Tips />}
        {selectedTab === 'diary' && <Diary />}
        {selectedTab === 'profile' && <Profile />}
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