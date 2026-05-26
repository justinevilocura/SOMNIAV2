import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { initialize } from 'react-native-health-connect';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from '../assets/styles/profile.styles';

export default function Profile() {
  const router = useRouter();
  const [userData, setUserData] = useState({
    name: '',
    email: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isHealthConnectLive, setIsHealthConnectLive] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const authDataString = await AsyncStorage.getItem('authData');
      if (authDataString) {
        const authData = JSON.parse(authDataString);
        setUserData({
          name: authData.name || 'User',
          email: authData.email || ''
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('authData');
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleConnectFit = async () => {
    try {
      const isInitialized = await initialize();
      if (isInitialized) {
        setIsHealthConnectLive(true);
      }
    } catch (error) {
      console.log('Health Connect failed to initialize', error);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.profileHeader}>
        <Image
          source={require('../assets/images/default-avatar.png')}
          style={styles.profileImage}
        />
        <Text style={styles.profileName}>{userData.name}</Text>
        <Text style={styles.profileEmail}>{userData.email}</Text>
      </View>

      <Text style={styles.sectionTitle}>Wearable Connections</Text>
      <View style={styles.wearableRow}>
        <View style={styles.wearableIconContainer}>
          <Ionicons name="fitness" size={24} color="#a259ff" />
        </View>
        <View style={styles.wearableTextContainer}>
          <Text style={styles.wearableTitle}>Google Fit / Health Connect</Text>
          {isHealthConnectLive ? (
            <Text style={styles.wearableStatusLive}>● LIVE</Text>
          ) : (
            <Text style={styles.wearableStatusDisconnected}>Disconnected</Text>
          )}
        </View>
        {!isHealthConnectLive && (
          <TouchableOpacity style={styles.connectButton} onPress={handleConnectFit}>
            <Text style={styles.connectButtonText}>+ Connect</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.settingsList}>
        <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={24} color="#fff" />
          <Text style={styles.settingText}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/sleepGoals')}>
          <Ionicons name="moon-outline" size={24} color="#fff" />
          <Text style={styles.settingText}>Sleep Goals</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/sleepReports')}>
          <Ionicons name="analytics-outline" size={24} color="#fff" />
          <Text style={styles.settingText}>Sleep Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingItem}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color="#ff4444" />
          <Text style={[styles.settingText, { color: '#ff4444' }]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}