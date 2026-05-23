import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from '../assets/styles/profile.styles';

export default function Profile() {
  const router = useRouter();
  const [userData, setUserData] = useState({
    name: '',
    email: ''
  });
  const [isLoading, setIsLoading] = useState(true);

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
      <View style={styles.settingsList}>
        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="notifications-outline" size={24} color="#fff" />
          <Text style={styles.settingText}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="moon-outline" size={24} color="#fff" />
          <Text style={styles.settingText}>Sleep Goals</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
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