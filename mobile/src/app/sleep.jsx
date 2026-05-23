import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

export default function Sleep() {
  const screenWidth = Dimensions.get('window').width;

  const sleepData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [7.5, 6.8, 8.2, 7.0, 6.5, 8.5, 7.8],
        color: (opacity = 1) => `rgba(162, 89, 255, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundGradientFrom: '#1a1a2e',
    backgroundGradientTo: '#1a1a2e',
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sleep Analysis</Text>
        <Text style={styles.subtitle}>Your sleep patterns this week</Text>
      </View>

      <View style={styles.chartContainer}>
        <LineChart
          data={sleepData}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="moon-outline" size={24} color="#a259ff" />
          <Text style={styles.statValue}>7.5h</Text>
          <Text style={styles.statLabel}>Average Sleep</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="bed-outline" size={24} color="#a259ff" />
          <Text style={styles.statValue}>11:30 PM</Text>
          <Text style={styles.statLabel}>Bedtime</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="sunny-outline" size={24} color="#a259ff" />
          <Text style={styles.statValue}>7:00 AM</Text>
          <Text style={styles.statLabel}>Wake-up Time</Text>
        </View>
      </View>

      <View style={styles.insightsContainer}>
        <Text style={styles.insightsTitle}>Sleep Insights</Text>
        <View style={styles.insightCard}>
          <Ionicons name="trending-up" size={24} color="#4cd964" />
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Sleep Quality Improved</Text>
            <Text style={styles.insightText}>
              Your sleep quality has improved by 15% compared to last week.
            </Text>
          </View>
        </View>

        <View style={styles.insightCard}>
          <Ionicons name="alert-circle" size={24} color="#ff9500" />
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Irregular Sleep Schedule</Text>
            <Text style={styles.insightText}>
              Try to maintain a consistent sleep schedule for better sleep quality.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
  },
  chartContainer: {
    padding: 20,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  statCard: {
    backgroundColor: 'rgba(162, 89, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: '30%',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 5,
  },
  insightsContainer: {
    padding: 20,
  },
  insightsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  insightContent: {
    marginLeft: 15,
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  insightText: {
    fontSize: 14,
    color: '#ccc',
  },
}); 