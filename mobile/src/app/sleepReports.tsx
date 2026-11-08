import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Platform, StatusBar, Image, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import LinearGradient from 'react-native-linear-gradient';
import { BarChart } from 'react-native-chart-kit';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;

export default function SleepReports() {
  const router = useRouter();

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
        const userJson = await userRes.json();
        if (userJson.success && userJson.userData) {
          setUserData(prev => ({
            ...prev,
            name: userJson.userData.name || prev.name,
            email: userJson.userData.email || prev.email,
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

      if (!token) return;

      const response = await fetch(`${backendUrl}/api/sleepSession/history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const json = await response.json();

      if (json.success && json.data && json.data.sessions) {
        const daysArray = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dynamicLabels = [];
        const weeklyData = [];
        let totalHours = 0;
        let daysWithSleep = 0;

        // Loop backwards from 6 days ago to today (matching Web Dashboard)
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          dynamicLabels.push(daysArray[date.getDay()]);

          // Find sessions for this specific calendar day (based on wake-up time / endTime)
          const sessionsForDay = json.data.sessions.filter((session: any) => {
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

          // Calculate net sleep duration in hours (excluding awake stages, exactly matching Web Dashboard)
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
          uniqueDaySessions.forEach((s: any) => {
            dayHours += getSessionNetHours(s);
          });

          // Round to 2 decimal places to avoid floating-point artifacts like 7.44999999999
          dayHours = Math.round(Math.min(dayHours, 24) * 100) / 100;
          weeklyData.push(dayHours);

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
      }
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
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.replace({ pathname: '/home', params: { tab: 'profile' } })}>
          <Ionicons name="person-circle-outline" size={32} color="#fff" />
        </TouchableOpacity>
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
                onPress={() => setIsMenuOpen(false)}
              >
                <Ionicons name="bar-chart-outline" size={22} color="#3b82f6" />
                <Text style={styles.drawerNavText}>Sleep Reports</Text>
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

              <TouchableOpacity
                style={styles.drawerNavItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.replace({ pathname: '/home', params: { tab: 'profile' } });
                }}
              >
                <Ionicons name="person-outline" size={22} color="#a259ff" />
                <Text style={styles.drawerNavText}>Profile & Settings</Text>
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
  }
});
