import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function Stats() {
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

  const qualityData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [85, 75, 90, 80, 70, 95, 85],
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
        <Text style={styles.title}>Sleep Statistics</Text>
        <Text style={styles.subtitle}>Weekly Overview</Text>
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Sleep Duration</Text>
        <LineChart
          data={sleepData}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Sleep Quality</Text>
        <BarChart
          data={qualityData}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
        />
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#a259ff" />
          <Text style={styles.statValue}>7.5h</Text>
          <Text style={styles.statLabel}>Avg. Sleep</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="trending-up-outline" size={24} color="#4cd964" />
          <Text style={styles.statValue}>85%</Text>
          <Text style={styles.statLabel}>Avg. Quality</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="bed-outline" size={24} color="#ff9500" />
          <Text style={styles.statValue}>11:30 PM</Text>
          <Text style={styles.statLabel}>Avg. Bedtime</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="sunny-outline" size={24} color="#ff9500" />
          <Text style={styles.statValue}>7:00 AM</Text>
          <Text style={styles.statLabel}>Avg. Wake-up</Text>
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
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  statCard: {
    width: '50%',
    padding: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 5,
  },
}); 