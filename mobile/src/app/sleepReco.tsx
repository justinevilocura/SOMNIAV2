import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../assets/styles/sleepReco.styles';

export default function SleepReco() {
  // Mock data for sleep statistics
  const sleepStats = {
    averageSleep: '7.5',
    sleepQuality: '85%',
    sleepStreak: '5 days',
  };

  // Example sleep data for the past 7 days
  const sleepData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [7, 6.5, 8, 7.5, 8.3, 7, 8],
        color: (opacity = 1) => `rgba(162, 89, 255, ${opacity})`,
        strokeWidth: 3,
      },
    ],
  };

  // Function to get sleep recommendations
  const getSleepRecommendations = () => {
    const lastSleepHours = sleepData.datasets[0].data[sleepData.datasets[0].data.length - 1];
    const recommendations = [];

    // Sleep duration recommendations
    if (lastSleepHours < 6) {
      recommendations.push({
        title: 'Sleep Duration Alert',
        message: 'Your sleep duration is below the recommended minimum. Try to aim for 7-9 hours of sleep.',
        icon: 'warning-outline',
        color: '#ff4d6d'
      });
    } else if (lastSleepHours > 9) {
      recommendations.push({
        title: 'Oversleeping Notice',
        message: 'You\'re sleeping more than the recommended amount. While rest is important, too much sleep can affect your energy levels.',
        icon: 'information-circle-outline',
        color: '#ffd60a'
      });
    } else {
      recommendations.push({
        title: 'Good Sleep Duration',
        message: 'Your sleep duration is within the recommended range of 7-9 hours. Keep up the good work!',
        icon: 'checkmark-circle-outline',
        color: '#43e97b'
      });
    }

    // Sleep quality recommendations
    if (parseInt(sleepStats.sleepQuality) < 70) {
      recommendations.push({
        title: 'Sleep Quality Improvement',
        message: 'Your sleep quality could be improved. Consider establishing a consistent sleep schedule and creating a relaxing bedtime routine.',
        icon: 'moon-outline',
        color: '#5d3fd3'
      });
    } else {
      recommendations.push({
        title: 'Excellent Sleep Quality',
        message: 'Your sleep quality is excellent! Continue maintaining your healthy sleep habits.',
        icon: 'star-outline',
        color: '#ffd60a'
      });
    }

    // General sleep tips
    recommendations.push({
      title: 'Sleep Environment Tip',
      message: 'Keep your bedroom cool, dark, and quiet for optimal sleep conditions.',
      icon: 'home-outline',
      color: '#a259ff'
    });

    recommendations.push({
      title: 'Bedtime Routine',
      message: 'Try to maintain a consistent bedtime routine to signal your body it\'s time to sleep.',
      icon: 'time-outline',
      color: '#ff8c42'
    });

    return recommendations;
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Sleep Recommendations</Text>
      {getSleepRecommendations().map((rec, index) => (
        <View key={index} style={[styles.recommendationItem, { borderLeftColor: rec.color }]}>
          <Ionicons name={rec.icon} size={24} color={rec.color} style={styles.recommendationIcon} />
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>{rec.title}</Text>
            <Text style={styles.recommendationMessage}>{rec.message}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
