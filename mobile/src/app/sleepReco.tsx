import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from '../assets/styles/sleepReco.styles';

interface SleepRecoProps {
  efficiency?: number;
  durationFormatted?: string;
  durationHours?: number;
}

export default function SleepReco({ efficiency, durationFormatted, durationHours }: SleepRecoProps = {}) {
  const [latestDurationHours, setLatestDurationHours] = useState<number>(durationHours || 7.5);
  const [latestFormatted, setLatestFormatted] = useState<string>(durationFormatted || '7h 30m');
  const [latestEfficiency, setLatestEfficiency] = useState<number>(efficiency !== undefined ? efficiency : 85);

  useEffect(() => {
    if (efficiency !== undefined) {
      setLatestEfficiency(efficiency);
    }
    if (durationFormatted) {
      setLatestFormatted(durationFormatted);
    }
    if (durationHours !== undefined) {
      setLatestDurationHours(durationHours);
    }
    loadLatestTelemetry();
  }, [efficiency, durationFormatted, durationHours]);

  const loadLatestTelemetry = async () => {
    try {
      const cached = await AsyncStorage.getItem('latestWearableSleep');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          if (durationHours === undefined) {
            if (parsed.hours !== undefined && parsed.minutes !== undefined) {
              const h = Number(parsed.hours) + Number(parsed.minutes) / 60;
              if (h > 0) setLatestDurationHours(h);
            } else if (parsed.totalMinutes) {
              setLatestDurationHours(parsed.totalMinutes / 60);
            }
          }
          if (!durationFormatted && parsed.totalSleepFormatted) {
            setLatestFormatted(parsed.totalSleepFormatted);
          }
          if (efficiency === undefined) {
            if (parsed.efficiency !== undefined && parsed.efficiency !== null) {
              setLatestEfficiency(Number(parsed.efficiency));
            } else if (parsed.deepMs || parsed.remMs || parsed.lightMs || parsed.awakeMs) {
              const stageTotal = (parsed.deepMs || 0) + (parsed.remMs || 0) + (parsed.lightMs || 0) + (parsed.awakeMs || 0);
              if (stageTotal > 0) {
                const rawAwakePct = Math.round(((parsed.awakeMs || 0) / stageTotal) * 100);
                const awakePct = Math.max(3, rawAwakePct);
                setLatestEfficiency(Math.min(97, Math.max(50, 100 - awakePct)));
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error loading telemetry in SleepReco:', e);
    }
  };

  const getSleepRecommendations = () => {
    const recommendations = [];

    // 1. Duration recommendation based on real latest session
    if (latestDurationHours < 6) {
      recommendations.push({
        category: 'Duration Alert',
        title: 'Short Sleep Recorded',
        message: `Your last tracked rest was ${latestFormatted}, which is below the recommended 7–9 hours. Prioritize an earlier bedtime tonight to recover.`,
        icon: 'warning-outline' as const,
        color: '#f97316',
      });
    } else if (latestDurationHours > 10) {
      recommendations.push({
        category: 'Recovery Sleep',
        title: 'Extended Rebound Rest',
        message: `Your last rest was ${latestFormatted}. Extended catch-up sleep clears accumulated sleep debt, but return to a steady 7–8h schedule to protect circadian rhythm.`,
        icon: 'bed-outline' as const,
        color: '#38bdf8',
      });
    } else {
      recommendations.push({
        category: 'Duration Goal',
        title: 'Optimal Sleep Duration',
        message: `Your sleep duration (${latestFormatted}) is within the optimal 7–9 hour range. Maintaining this promotes balanced daytime energy and cognition.`,
        icon: 'checkmark-circle-outline' as const,
        color: '#22c55e',
      });
    }

    // 2. Sleep quality & efficiency recommendation
    if (latestEfficiency < 75) {
      recommendations.push({
        category: 'Quality & Depth',
        title: 'Restlessness Detected',
        message: `Sleep efficiency is at ${latestEfficiency}%. Avoid caffeine after 2 PM and reduce late evening screen exposure to increase deep sleep continuity.`,
        icon: 'pulse-outline' as const,
        color: '#a855f7',
      });
    } else {
      recommendations.push({
        category: 'Quality & Depth',
        title: 'High Sleep Efficiency',
        message: `Your sleep efficiency is at ${latestEfficiency}%. Your body is spending high-quality restorative time across deep and REM stages.`,
        icon: 'star-outline' as const,
        color: '#ffd166',
      });
    }

    // 3. Sleep environment tip
    recommendations.push({
      category: 'Environment',
      title: 'Cool & Dark Sanctuary',
      message: 'Keep bedroom temperature near 18–20°C (65–68°F) and minimize light. A cool environment triggers natural melatonin production.',
      icon: 'moon-outline' as const,
      color: '#818cf8',
    });

    // 4. Bedtime routine tip
    recommendations.push({
      category: 'Circadian Routine',
      title: 'Consistent Wind-Down',
      message: 'Aim to sleep and wake within a 30-minute window daily. Regularity reinforces your biological clock and enhances morning alertness.',
      icon: 'time-outline' as const,
      color: '#ec4899',
    });

    return recommendations;
  };

  const recommendations = getSleepRecommendations();

  return (
    <View style={styles.card}>
      {/* Sleek Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconBadge}>
            <Ionicons name="sparkles" size={18} color="#a259ff" />
          </View>
          <View>
            <Text style={styles.cardTitle}>Sleep Recommendations</Text>
            <Text style={styles.cardSubtitle}>Personalized insights for better recovery</Text>
          </View>
        </View>
      </View>

      {/* Neat List of Recommendations */}
      {recommendations.map((rec, index) => (
        <View key={index} style={styles.recommendationItem}>
          {/* Subtle colored accent strip on the left */}
          <View style={[styles.accentBar, { backgroundColor: rec.color }]} />

          {/* Rounded Tinted Icon Badge */}
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: `${rec.color}15`,
                borderColor: `${rec.color}35`,
                borderWidth: 1,
              },
            ]}
          >
            <Ionicons name={rec.icon} size={20} color={rec.color} />
          </View>

          {/* Text Content */}
          <View style={styles.recommendationContent}>
            <View style={styles.titleRow}>
              <Text style={[styles.categoryTag, { color: rec.color }]}>
                {rec.category}
              </Text>
            </View>
            <Text style={styles.recommendationTitle}>{rec.title}</Text>
            <Text style={styles.recommendationMessage}>{rec.message}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
