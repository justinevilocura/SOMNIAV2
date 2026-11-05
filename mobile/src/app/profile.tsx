import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  initialize,
  requestPermission,
  getGrantedPermissions,
  openHealthConnectSettings,
} from 'react-native-health-connect';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import styles from '../assets/styles/profile.styles';

export default function Profile() {
  const router = useRouter();
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    avatar: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isHealthConnectLive, setIsHealthConnectLive] = useState(false);

  useEffect(() => {
    loadUserData();
    checkHealthConnect();
  }, []);

  const checkHealthConnect = async () => {
    try {
      // 1. Check local cache first for instant render
      const status = await AsyncStorage.getItem('healthConnectLive');
      if (status === 'true') {
        setIsHealthConnectLive(true);
      }

      // 2. Query real Health Connect API directly
      const isInitialized = await initialize();
      if (isInitialized) {
        const granted = (await getGrantedPermissions()) || [];
        const hasPermissions = Array.isArray(granted) && granted.length > 0;
        setIsHealthConnectLive(hasPermissions);
        await AsyncStorage.setItem('healthConnectLive', hasPermissions ? 'true' : 'false');
      }
    } catch (e) {
      console.log('Error verifying Health Connect status:', e);
    }
  };

  const loadUserData = async () => {
    try {
      // 1. Load from cache first for instantaneous render
      const authDataString = await AsyncStorage.getItem('authData');
      if (authDataString) {
        const authData = JSON.parse(authDataString);
        setUserData({
          name: authData.name || 'User',
          email: authData.email || '',
          avatar: authData.avatar || '',
        });
      }

      // 2. Fetch fresh real user profile from backend (real registered name & avatar)
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
        const res = await fetch(`${backendUrl}/api/user/data`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && json.userData) {
          const freshData = {
            name: json.userData.name || 'User',
            email: json.userData.email || '',
            avatar: json.userData.avatar || '',
          };
          setUserData(freshData);

          // Update local cache so home and other screens have the real full name
          if (authDataString) {
            const parsed = JSON.parse(authDataString);
            parsed.name = freshData.name;
            parsed.avatar = freshData.avatar;
            await AsyncStorage.setItem('authData', JSON.stringify(parsed));
          }
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Needed',
          'Please allow photo library access in phone settings to change your profile picture.'
        );
        return;
      }

      // Launch picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const base64Image = `data:image/jpeg;base64,${asset.base64}`;

        setIsUploading(true);
        // Optimistic UI update
        setUserData(prev => ({ ...prev, avatar: base64Image }));

        // Upload to backend
        const token = await AsyncStorage.getItem('token');
        const authDataString = await AsyncStorage.getItem('authData');
        let userId = '';
        if (authDataString) {
          try {
            const authData = JSON.parse(authDataString);
            userId = authData.user_id || authData.id || authData._id;
          } catch (_) {}
        }

        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
        const res = await fetch(`${backendUrl}/api/user/update-avatar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ userId, avatar: base64Image })
        });

        const json = await res.json();
        if (json.success) {
          Toast.show({ type: 'success', text1: 'Photo Updated!', text2: 'Your new avatar is saved.' });
          // Update cache
          if (authDataString) {
            const parsed = JSON.parse(authDataString);
            parsed.avatar = base64Image;
            await AsyncStorage.setItem('authData', JSON.stringify(parsed));
          }
        } else {
          Toast.show({ type: 'error', text1: 'Upload Failed', text2: json.message || 'Could not save photo.' });
        }
      }
    } catch (err) {
      console.error('Error selecting avatar image:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not select photo.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('authData');
      await AsyncStorage.removeItem('token');
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleConnectFit = async () => {
    if (isHealthConnectLive) {
      Toast.show({
        type: 'success',
        text1: 'Health Connect Active',
        text2: 'Smartwatch data is linked and syncing normally.',
      });
      return;
    }

    try {
      const isInitialized = await initialize();
      if (!isInitialized) return;

      const granted = await requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'read', recordType: 'ExerciseSession' },
      ]);
      const hasPermissions = Array.isArray(granted) && granted.length > 0;
      setIsHealthConnectLive(hasPermissions);
      await AsyncStorage.setItem('healthConnectLive', hasPermissions ? 'true' : 'false');
    } catch (error) {
      console.log('Health Connect connection error', error);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.profileHeader}>
        {/* Interactive Avatar with Camera Edit Badge */}
        <TouchableOpacity
          onPress={handlePickImage}
          activeOpacity={0.8}
          style={styles.avatarContainer}
        >
          {userData.avatar ? (
            <Image
              source={{ uri: userData.avatar }}
              style={styles.profileImage}
            />
          ) : (
            <Image
              source={require('../assets/images/default-avatar.png')}
              style={styles.profileImage}
            />
          )}
          <View style={styles.editBadge}>
            {isUploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        {/* Real User Full Name (e.g. Justine Vilocura) */}
        <Text style={styles.profileName}>{userData.name || 'User'}</Text>
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
        <TouchableOpacity
          style={[styles.connectButton, isHealthConnectLive && styles.connectedBadge]}
          onPress={handleConnectFit}
          activeOpacity={isHealthConnectLive ? 0.8 : 0.7}
        >
          <Text style={[styles.connectButtonText, isHealthConnectLive && styles.connectedBadgeText]}>
            {isHealthConnectLive ? '✓ Connected' : '+ Connect'}
          </Text>
        </TouchableOpacity>
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
