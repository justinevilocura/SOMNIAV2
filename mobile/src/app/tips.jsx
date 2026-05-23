import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function Tips() {
  const tips = [
    {
      title: 'Maintain a Consistent Sleep Schedule',
      description: 'Go to bed and wake up at the same time every day, even on weekends.',
      icon: 'time-outline',
    },
    {
      title: 'Create a Relaxing Bedtime Routine',
      description: 'Take a warm bath, read a book, or practice meditation before bed.',
      icon: 'moon-outline',
    },
    {
      title: 'Optimize Your Sleep Environment',
      description: 'Keep your bedroom cool, dark, and quiet for optimal sleep conditions.',
      icon: 'bed-outline',
    },
    {
      title: 'Limit Screen Time Before Bed',
      description: 'Avoid electronic devices at least 1 hour before bedtime.',
      icon: 'phone-portrait-outline',
    },
    {
      title: 'Watch Your Caffeine Intake',
      description: 'Avoid caffeine after 2 PM to prevent sleep disruption.',
      icon: 'cafe-outline',
    },
    {
      title: 'Exercise Regularly',
      description: 'Regular physical activity can help you fall asleep faster and sleep better.',
      icon: 'fitness-outline',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sleep Tips</Text>
        <Text style={styles.subtitle}>Improve your sleep quality with these tips</Text>
      </View>

      {tips.map((tip, index) => (
        <TouchableOpacity key={index} style={styles.tipCard}>
          <View style={styles.tipIcon}>
            <Ionicons name={tip.icon} size={24} color="#a259ff" />
          </View>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>{tip.title}</Text>
            <Text style={styles.tipDescription}>{tip.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>
      ))}
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
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(162, 89, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  tipDescription: {
    fontSize: 14,
    color: '#ccc',
  },
}); 