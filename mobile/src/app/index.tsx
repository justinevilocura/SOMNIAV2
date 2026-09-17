import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, Pressable, ScrollView, StatusBar, Image, Dimensions, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from '../assets/styles/index.styles';
import FeatureList from '../components/FeatureList';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: screenWidth } = Dimensions.get('window');
const imageWidth = Math.min(screenWidth - 60, 320);
const imageHeight = imageWidth / 0.449;

export default function LandingPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasSeenIntro = await AsyncStorage.getItem('hasSeenPermissionIntro');
        if (!hasSeenIntro) {
          setShowIntro(true);
        } else {
          setShowIntro(false);
        }
      } catch (error) {
        console.warn('Error checking first launch flag:', error);
        setShowIntro(false);
      } finally {
        setIsReady(true);
      }
    };
    checkFirstLaunch();
  }, []);

  const handleDismissIntro = async () => {
    try {
      await AsyncStorage.setItem('hasSeenPermissionIntro', 'true');
    } catch (error) {
      console.warn('Error saving first launch flag:', error);
    }
    setShowIntro(false);
  };

  if (!isReady) {
    return (
      <View style={[styles.container, { backgroundColor: '#1a1a2e' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" translucent />
      </View>
    );
  }

  // FIRST LAUNCH INTRODUCTORY SCREEN ONLY
  if (showIntro) {
    return (
      <View style={introStyles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101522" translucent />
        <LinearGradient colors={['#101522', '#18213a', '#23234b']} style={introStyles.gradient}>
          <ScrollView contentContainerStyle={introStyles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Setup Badge */}
            <View style={introStyles.badgeContainer}>
              <Ionicons name="shield-checkmark" size={16} color="#43e97b" style={{ marginRight: 6 }} />
              <Text style={introStyles.badgeText}>FIRST-TIME SETUP GUIDE</Text>
            </View>

            <Text style={introStyles.title}>Health Connect Access</Text>
            <Text style={introStyles.subtitle}>
              To accurately track and predict sleep quality, SOMNiA connects to your fitness data via Google Health Connect.
            </Text>

            {/* Introductory Image Card */}
            <View style={introStyles.imageCard}>
              <Text style={introStyles.instructionHeader}>
                <Ionicons name="information-circle" size={15} color="#a259ff" /> When Android prompts you, please enable <Text style={{ fontWeight: 'bold', color: '#fff' }}>"Allow all"</Text>:
              </Text>
              <Image
                source={require('../assets/images/permission-intro.png')}
                style={introStyles.introImage}
                resizeMode="contain"
              />
            </View>

            <Text style={introStyles.footerNote}>
              This introductory guide only appears on the first app launch after installation.
            </Text>

            {/* Action Button */}
            <Pressable
              onPress={handleDismissIntro}
              style={({ pressed }) => [introStyles.continueButton, pressed && introStyles.continueButtonPressed]}
            >
              <Text style={introStyles.continueButtonText}>Got It, Continue to SOMNiA</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
            </Pressable>
          </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  // Standard Landing Page (Shown after intro is dismissed or on any subsequent launches)
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" translucent />
      <LinearGradient colors={['#1a1a2e', '#23234b']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.contentContainer}>
            <Image source={require('../assets/images/somnia.png')} style={styles.logoOnly} resizeMode="contain" />
            <Text style={styles.subtitle}>
              Your personal sleep tracking and analysis companion. 
              Discover better sleep patterns and improve your overall well-being.
            </Text>
          </View>

          <View style={styles.featuresContainer}>
            <FeatureList icon="moon" title="Sleep Tracking" text="Monitor your sleep patterns and get detailed insights" />
            <FeatureList icon="analytics" title="Smart Analysis" text="Get personalized recommendations for better sleep" />
            <FeatureList icon="trending-up" title="Progress Tracking" text="Track your sleep improvement journey" />
          </View>

          <View style={styles.buttonContainer}>
            <Pressable
              onPress={() => router.push('/(auth)/login')}
              style={({ pressed }) => [styles.getStartedButton, pressed && styles.getStartedButtonPressed]}
            >
              <Text style={styles.getStartedButtonText}>Get Started</Text>
            </Pressable>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const introStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101522',
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 45,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(67, 233, 123, 0.15)',
    borderColor: 'rgba(67, 233, 123, 0.3)',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {
    color: '#43e97b',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  imageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(162, 89, 255, 0.25)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#a259ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  instructionHeader: {
    color: '#d8b4fe',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  introImage: {
    width: imageWidth,
    height: Math.min(imageHeight, 440),
    borderRadius: 14,
  },
  footerNote: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    fontStyle: 'italic',
  },
  continueButton: {
    backgroundColor: '#5d3fd3',
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#5d3fd3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  continueButtonPressed: {
    backgroundColor: '#4b2fc9',
    transform: [{ scale: 0.98 }],
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
