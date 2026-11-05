import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Platform, StatusBar } from 'react-native';
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
  const [avgDuration, setAvgDuration] = useState('0h 0m');
  const [consistency, setConsistency] = useState('0%');
  const [aiInsight, setAiInsight] = useState('Analyzing your sleep patterns...');
  const [chartData, setChartData] = useState({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }],
  });

  useEffect(() => {
    fetchSleepData();
  }, []);

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

          // Merge overlapping intervals to prevent double-counting (matching Web Dashboard)
          const intervals = sessionsForDay
            .map((s: any) => ({
              start: new Date(s.startTime).getTime(),
              end: new Date(s.endTime).getTime(),
            }))
            .filter((int: any) => !isNaN(int.start) && !isNaN(int.end) && int.end > int.start)
            .sort((a: any, b: any) => a.start - b.start);

          let dayHours = 0;
          if (intervals.length > 0) {
            const merged = [{ ...intervals[0] }];
            for (let j = 1; j < intervals.length; j++) {
              const prev = merged[merged.length - 1];
              const curr = intervals[j];
              if (curr.start <= prev.end) {
                prev.end = Math.max(prev.end, curr.end);
              } else {
                merged.push({ ...curr });
              }
            }
            const totalMs = merged.reduce((sum: number, int: any) => sum + (int.end - int.start), 0);
            dayHours = totalMs / (1000 * 60 * 60);
          } else {
            sessionsForDay.forEach((s: any) => {
              dayHours += (s.durationHours || 0);
            });
          }

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
    barPercentage: 0.6,
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
        <TouchableOpacity onPress={() => router.replace({ pathname: '/home', params: { tab: 'profile' } })} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sleep Reports</Text>
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
            <BarChart
              data={chartData}
              width={screenWidth - 80}
              height={220}
              yAxisSuffix="h"
              yAxisLabel=""
              chartConfig={chartConfig}
              style={styles.chartStyle}
              showValuesOnTopOfBars={true}
              fromZero={true}
            />
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 48,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
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
