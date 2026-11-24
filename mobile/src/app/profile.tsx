import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, TextInput, ScrollView, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AppleHealthKit from 'react-native-health';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import styles from '../assets/styles/profile.styles';

// ─── Age calculation from birthdate (matches Android & web logic) ─────────────
const calculateAge = (birthdate: any): string => {
  if (!birthdate) return '';
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age > 0 ? String(age) : '';
};

export default function Profile() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'settings' | 'profile' | 'account_privacy'>('settings');
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    avatar: '',
    age: '',
    gender: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isAppleHealthLive, setIsAppleHealthLive] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', age: '', gender: '' });

  // Account and Privacy states
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    loadUserData();
    checkAppleHealth();
  }, []);

  const checkAppleHealth = async () => {
    try {
      const status = await AsyncStorage.getItem('appleHealthLive');
      if (status === 'true') {
        setIsAppleHealthLive(true);
      }
      const permissions = {
        permissions: {
          read: [
            AppleHealthKit.Constants.Permissions.StepCount,
            AppleHealthKit.Constants.Permissions.HeartRate,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.Workout,
          ],
          write: [],
        },
      };
      AppleHealthKit.initHealthKit(permissions, (error) => {
        if (!error) {
          setIsAppleHealthLive(true);
          AsyncStorage.setItem('appleHealthLive', 'true');
        }
      });
    } catch (e) {
      console.log('Error verifying Apple Health status:', e);
    }
  };

  const loadUserData = async () => {
    try {
      const isCustomized = await AsyncStorage.getItem('profileCustomized');
      // 1. Load from cache first for instantaneous render
      const authDataString = await AsyncStorage.getItem('authData');
      let cachedName = '';
      let cachedEmail = '';
      let cachedAvatar = '';
      let cachedAge = '';
      let cachedGender = '';

      if (authDataString) {
        const authData = JSON.parse(authDataString);
        cachedName = authData.name || '';
        cachedEmail = authData.email || '';
        cachedAvatar = authData.avatar || '';
        cachedGender = authData.gender || '';

        // If age is missing but birthdate is stored, derive it now
        const cachedBirthdate = authData.birthdate || authData.birthday || '';
        cachedAge = authData.age || calculateAge(cachedBirthdate) || '';

        setUserData({
          name: cachedName || 'User',
          email: cachedEmail,
          avatar: cachedAvatar,
          age: cachedAge,
          gender: cachedGender,
        });
      }

      // 2. Fetch fresh real user profile from backend (real registered name & avatar)
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
        const res = await fetch(`${backendUrl}/api/user/data`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          const json = await res.json();
          if (json.success && json.userData) {
            // If user customized their profile locally, DO NOT overwrite with stale server data!
            const finalName = (isCustomized === 'true' && cachedName) ? cachedName : (json.userData.name || 'User');
            const finalEmail = (isCustomized === 'true' && cachedEmail) ? cachedEmail : (json.userData.email || '');
            const finalGender = (isCustomized === 'true' && cachedGender) ? cachedGender : (json.userData.gender || '');
            const finalAvatar = json.userData.avatar || cachedAvatar || '';

            // Derive age: prefer explicitly stored age, then calculate from birthdate
            const serverBirthdate = json.userData.birthdate || '';
            const serverAge = json.userData.age ? String(json.userData.age) : calculateAge(serverBirthdate);
            const finalAge = (isCustomized === 'true' && cachedAge) ? cachedAge : (serverAge || cachedAge || '');

            setUserData({
              name: finalName,
              email: finalEmail,
              avatar: finalAvatar,
              age: finalAge,
              gender: finalGender,
            });

            // Update local cache so home and other screens have the real full name
            if (authDataString) {
              const parsed = JSON.parse(authDataString);
              parsed.name = finalName;
              parsed.email = finalEmail;
              parsed.avatar = finalAvatar;
              parsed.age = finalAge;
              parsed.gender = finalGender;
              // Preserve birthdate in cache for future age recalculation
              if (serverBirthdate) parsed.birthdate = serverBirthdate;
              await AsyncStorage.setItem('authData', JSON.stringify(parsed));
            }
          }
        }
      }
    } catch (error) {
      console.log('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickImage = () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose how you want to update your profile photo:',
      [
        {
          text: 'Choose from Library',
          onPress: () => openPicker('library'),
        },
        {
          text: 'Take Photo',
          onPress: () => openPicker('camera'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const openPicker = async (type: 'library' | 'camera') => {
    try {
      if (type === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Needed',
            'Please allow camera access in iPhone Settings > SOMNiA to take a photo.'
          );
          return;
        }

        const cameraResult = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.4,
          base64: true,
        });

        handlePickerResult(cameraResult);
      } else {
        // iOS 14+ uses the system PHPickerViewController which runs out-of-process
        // and does NOT require permissions or cause binary SIGABRT crashes.
        const libraryResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.4,
          base64: true,
        });

        handlePickerResult(libraryResult);
      }
    } catch (err) {
      console.error('Error selecting avatar image:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not select photo.' });
      setIsUploading(false);
    }
  };

  const handlePickerResult = async (result: ImagePicker.ImagePickerResult) => {
    try {
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const base64Image = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

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
        let uploadSucceeded = false;
        try {
          const res = await fetch(`${backendUrl}/api/user/update-avatar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ userId, avatar: base64Image })
          });

          const contentType = res.headers.get('content-type');
          if (res.ok && contentType && contentType.includes('application/json')) {
            const json = await res.json();
            if (json.success) {
              uploadSucceeded = true;
            }
          }
        } catch (netErr) {
          console.log('Backend avatar sync skipped or offline:', netErr);
        }

        // Always save to phone cache so avatar persists across restarts
        if (authDataString) {
          const parsed = JSON.parse(authDataString);
          parsed.avatar = base64Image;
          await AsyncStorage.setItem('authData', JSON.stringify(parsed));
        }

        Toast.show({
          type: 'success',
          text1: 'Photo Updated!',
          text2: uploadSucceeded ? 'Synced to your account.' : 'Saved on this device.',
        });
      }
    } catch (err) {
      console.error('Error handling picker result:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartEdit = () => {
    setEditForm({
      name: userData.name || '',
      age: userData.age || '',
      gender: userData.gender || 'Prefer not to say',
    });
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('Validation Error', 'Full name cannot be empty.');
      return;
    }

    try {
      setIsSaving(true);
      const updatedName = editForm.name.trim();
      const updatedAge = editForm.age;
      const updatedGender = editForm.gender;

      // 1. Immediately update UI state
      setUserData(prev => ({
        ...prev,
        name: updatedName,
        age: updatedAge,
        gender: updatedGender,
      }));

      // 2. Persist locally to phone storage
      await AsyncStorage.setItem('profileCustomized', 'true');
      const authDataString = await AsyncStorage.getItem('authData');
      let userId = '';
      if (authDataString) {
        try {
          const authData = JSON.parse(authDataString);
          userId = authData.user_id || authData.id || authData._id;
          authData.name = updatedName;
          authData.age = updatedAge;
          authData.gender = updatedGender;
          await AsyncStorage.setItem('authData', JSON.stringify(authData));
        } catch (_) {}
      }

      // 3. Sync to backend if available (safely without breaking on HTML/offline response)
      try {
        const token = await AsyncStorage.getItem('token');
        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
        const res = await fetch(`${backendUrl}/api/user/update-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            userId,
            name: updatedName,
            age: updatedAge ? String(updatedAge) : '',
            gender: updatedGender,
          })
        });

        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          await res.json();
        }
      } catch (netErr) {
        console.log('Backend sync skipped or offline:', netErr);
      }

      Toast.show({
        type: 'success',
        text1: 'Profile Saved!',
        text2: 'Personal details updated successfully.',
      });
      setIsEditing(false);
    } catch (error) {
      console.log('Error saving profile:', error);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      Alert.alert('Required', 'Please enter your current password.');
      return;
    }
    if (!passwordForm.newPassword) {
      Alert.alert('Required', 'Please enter your new password.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      Alert.alert('Password Too Short', 'New password must be at least 6 characters long.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }

    try {
      setIsChangingPass(true);
      const token = await AsyncStorage.getItem('token');
      const authDataString = await AsyncStorage.getItem('authData');
      let userId = '';
      if (authDataString) {
        try {
          const authData = JSON.parse(authDataString);
          userId = authData.user_id || authData.id || authData._id || '';
        } catch (_) {}
      }
      const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
      const res = await fetch(`${backendUrl}/api/user/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          userId,
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        })
      });

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const json = await res.json();
        if (json.success) {
          Toast.show({
            type: 'success',
            text1: 'Password Updated! 🔒',
            text2: 'Your password was changed successfully.',
          });
          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
          setActiveTab('settings');
        } else {
          Alert.alert('Error', json.message || 'Could not change password.');
        }
      } else {
        // Non-JSON response (e.g. 401 from expired token or server error)
        Alert.alert('Session Expired', 'Please log out and log in again, then try changing your password.');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to update password. Please check your network connection.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and will wipe all your sleep and health records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingAccount(true);
              const token = await AsyncStorage.getItem('token');
              const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
              await fetch(`${backendUrl}/api/user/delete-account`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
              });

              await AsyncStorage.clear();
              Toast.show({
                type: 'success',
                text1: 'Account Deleted',
                text2: 'Your account has been permanently removed.',
              });
              router.replace('/(auth)/login');
            } catch (e) {
              await AsyncStorage.clear();
              router.replace('/(auth)/login');
            } finally {
              setIsDeletingAccount(false);
            }
          }
        }
      ]
    );
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

  const handleConnectAppleHealth = () => {
    if (isAppleHealthLive) {
      Toast.show({
        type: 'success',
        text1: 'Apple Health Active',
        text2: 'HealthKit data is linked and syncing normally.',
      });
      return;
    }

    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.StepCount,
          AppleHealthKit.Constants.Permissions.HeartRate,
          AppleHealthKit.Constants.Permissions.SleepAnalysis,
          AppleHealthKit.Constants.Permissions.Workout,
        ],
        write: [],
      },
    };

    AppleHealthKit.initHealthKit(permissions, (error) => {
      if (error) {
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Could not access Apple HealthKit.',
        });
      } else {
        setIsAppleHealthLive(true);
        AsyncStorage.setItem('appleHealthLive', 'true');
        Toast.show({
          type: 'success',
          text1: 'Apple Health Connected',
          text2: 'HealthKit permissions granted successfully.',
        });
      }
    });
  };

  const handleConnectFit = () => {
    Toast.show({
      type: 'info',
      text1: 'Health Connect',
      text2: 'Google Health Connect is available on Android devices.',
    });
  };

  return (
    <View style={styles.card}>
      {activeTab === 'profile' ? (
        // ─── DEDICATED PROFILE VIEW (1:1 with Screenshot 1 & 2) ─────────────
        <View key="profile-details-view">
          {/* Back Navigation Row: ← Profile Details */}
          <TouchableOpacity
            onPress={() => {
              if (isEditing) {
                setIsEditing(false);
              } else {
                setActiveTab('settings');
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', marginLeft: 12 }}>
              Profile Details
            </Text>
          </TouchableOpacity>

          {/* Profile Header: Avatar + Name + Email Capsule + Change Photo Pill */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            {/* Interactive Avatar with Camera Badge */}
            <TouchableOpacity
              onPress={handlePickImage}
              activeOpacity={0.8}
              style={{ position: 'relative', marginBottom: 12 }}
            >
              <View style={{
                width: 104,
                height: 104,
                borderRadius: 52,
                borderWidth: 2,
                borderColor: '#a855f7',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
              }}>
                {userData.avatar ? (
                  <Image
                    source={{ uri: userData.avatar }}
                    style={{ width: 96, height: 96, borderRadius: 48 }}
                  />
                ) : (
                  <Image
                    source={require('../assets/images/default-avatar.png')}
                    style={{ width: 96, height: 96, borderRadius: 48 }}
                  />
                )}
              </View>

              <View style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                backgroundColor: '#8b5cf6',
                borderRadius: 16,
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#161c2e',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
                elevation: 4,
              }}>
                {isUploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={16} color="#fff" />
                )}
              </View>
            </TouchableOpacity>

            {/* Profile Name */}
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#ffffff', marginBottom: 8, textAlign: 'center' }}>
              {userData.name || 'User'}
            </Text>

            {/* Email Capsule */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderRadius: 20,
              marginBottom: 10,
            }}>
              <Ionicons name="mail-outline" size={15} color="#94a3b8" style={{ marginRight: 8 }} />
              <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '500' }}>
                {userData.email}
              </Text>
            </View>

            {/* Tap photo to change pill */}
            <TouchableOpacity
              onPress={handlePickImage}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(168, 85, 247, 0.12)',
                borderWidth: 1,
                borderColor: 'rgba(168, 85, 247, 0.4)',
                paddingHorizontal: 16,
                paddingVertical: 7,
                borderRadius: 20,
              }}
            >
              <Ionicons name="camera-outline" size={15} color="#c084fc" style={{ marginRight: 6 }} />
              <Text style={{ color: '#c084fc', fontSize: 13, fontWeight: '600' }}>
                Tap photo to change
              </Text>
            </TouchableOpacity>
          </View>

          {/* ─── PERSONAL DETAILS SECTION (Card) ─── */}
          <View style={{
            backgroundColor: '#161c2e',
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.06)',
          }}>
            {/* Header: Person Icon Box + "Personal Details" + Edit Button */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: isEditing ? 8 : 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name="person" size={18} color="#c084fc" />
                </View>
                <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>
                  Personal Details
                </Text>
              </View>

              {!isEditing && (
                <TouchableOpacity
                  onPress={handleStartEdit}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(139, 92, 246, 0.15)',
                    borderWidth: 1,
                    borderColor: '#8b5cf6',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={16} color="#c084fc" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#c084fc', fontSize: 14, fontWeight: '600' }}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {isEditing ? (
              // ── EDIT MODE (Screenshot 2) ──
              <View style={{ marginTop: 6 }}>
                {/* FULL NAME */}
                <Text style={{
                  color: '#a855f7',
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  marginBottom: 8,
                  marginTop: 10,
                  textTransform: 'uppercase',
                }}>
                  FULL NAME
                </Text>
                <TextInput
                  style={{
                    backgroundColor: '#0d1322',
                    borderWidth: 1,
                    borderColor: '#26314d',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: '#ffffff',
                    fontSize: 15,
                    marginBottom: 16,
                  }}
                  value={editForm.name}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, name: text }))}
                  placeholder="Enter full name"
                  placeholderTextColor="#64748b"
                />

                {/* AGE */}
                <Text style={{
                  color: '#a855f7',
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}>
                  AGE
                </Text>
                <TextInput
                  style={{
                    backgroundColor: '#0d1322',
                    borderWidth: 1,
                    borderColor: '#26314d',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: '#ffffff',
                    fontSize: 15,
                    marginBottom: 16,
                  }}
                  value={editForm.age}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, age: text.replace(/[^0-9]/g, '') }))}
                  placeholder="e.g. 25"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  maxLength={3}
                />

                {/* GENDER */}
                <Text style={{
                  color: '#a855f7',
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  marginBottom: 10,
                  textTransform: 'uppercase',
                }}>
                  GENDER
                </Text>
                {/* Gender Pills: Row 1 (Male, Female, Prefer not to say), Row 2 (Other) */}
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {['Male', 'Female', 'Prefer not to say'].map((option) => {
                      const isSelected = editForm.gender === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 18,
                            borderRadius: 24,
                            borderWidth: 1,
                            borderColor: isSelected ? '#8b5cf6' : '#26314d',
                            backgroundColor: isSelected ? '#6d28d9' : '#0d1322',
                          }}
                          onPress={() => setEditForm(prev => ({ ...prev, gender: option }))}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={{
                              color: isSelected ? '#ffffff' : '#94a3b8',
                              fontSize: 14,
                              fontWeight: isSelected ? '700' : '500',
                            }}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: 10 }}>
                    {['Other'].map((option) => {
                      const isSelected = editForm.gender === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 18,
                            borderRadius: 24,
                            borderWidth: 1,
                            borderColor: isSelected ? '#8b5cf6' : '#26314d',
                            backgroundColor: isSelected ? '#6d28d9' : '#0d1322',
                          }}
                          onPress={() => setEditForm(prev => ({ ...prev, gender: option }))}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={{
                              color: isSelected ? '#ffffff' : '#94a3b8',
                              fontSize: 14,
                              fontWeight: isSelected ? '700' : '500',
                            }}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Save / Cancel action buttons */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#334155',
                      backgroundColor: '#1b2236',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={() => setIsEditing(false)}
                    disabled={isSaving}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 14,
                      backgroundColor: '#8b5cf6',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={handleSaveProfile}
                    disabled={isSaving}
                    activeOpacity={0.7}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // ── DISPLAY MODE (Screenshot 1) ──
              <View style={{ marginTop: 4 }}>
                {/* Row 1: Full Name */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255, 255, 255, 0.06)',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: 'rgba(139, 92, 246, 0.15)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons name="person-outline" size={17} color="#c084fc" />
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '500' }}>Full Name</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                    {userData.name || 'User'}
                  </Text>
                </View>

                {/* Row 2: Age */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255, 255, 255, 0.06)',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons name="calendar-outline" size={17} color="#38bdf8" />
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '500' }}>Age</Text>
                  </View>
                  <Text style={{ color: userData.age ? '#ffffff' : '#94a3b8', fontSize: 15, fontWeight: userData.age ? '600' : '500' }}>
                    {userData.age ? `${userData.age} years old` : 'Not set'}
                  </Text>
                </View>

                {/* Row 3: Gender */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 14,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: 'rgba(244, 114, 182, 0.15)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons name="transgender-outline" size={17} color="#f472b6" />
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '500' }}>Gender</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
                    {userData.gender || 'Not set'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : activeTab === 'account_privacy' ? (
        // ─── DEDICATED ACCOUNT AND PRIVACY VIEW (1:1 with Screenshot) ─────────
        <View key="account-privacy-view">
          {/* Back Navigation Row: ← Account and Privacy */}
          <TouchableOpacity
            onPress={() => setActiveTab('settings')}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', marginLeft: 12 }}>
              Account and Privacy
            </Text>
          </TouchableOpacity>

          {/* ─── 1. Change Password Card ─── */}
          <View style={{
            backgroundColor: '#161c2e',
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.06)',
            marginBottom: 16,
          }}>
            {/* Header: Key icon box + Title */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="key" size={18} color="#c084fc" />
              </View>
              <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>
                Change Password
              </Text>
            </View>

            {/* Field 1: CURRENT PASSWORD */}
            <Text style={{
              color: '#a855f7',
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 0.6,
              marginBottom: 8,
              marginTop: 18,
              textTransform: 'uppercase',
            }}>
              CURRENT PASSWORD
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#0d1322',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#26314d',
              paddingHorizontal: 16,
              paddingVertical: 14,
              marginBottom: 14,
            }}>
              <TextInput
                key={showCurrentPass ? 'curr-txt' : 'curr-sec'}
                style={{ flex: 1, color: '#ffffff', fontSize: 15 }}
                value={passwordForm.currentPassword}
                onChangeText={(t) => setPasswordForm(prev => ({ ...prev, currentPassword: t }))}
                placeholder="Enter current password"
                placeholderTextColor="#64748b"
                secureTextEntry={!showCurrentPass}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={showCurrentPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Field 2: NEW PASSWORD */}
            <Text style={{
              color: '#a855f7',
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 0.6,
              marginBottom: 8,
              textTransform: 'uppercase',
            }}>
              NEW PASSWORD
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#0d1322',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#26314d',
              paddingHorizontal: 16,
              paddingVertical: 14,
              marginBottom: 14,
            }}>
              <TextInput
                key={showNewPass ? 'new-txt' : 'new-sec'}
                style={{ flex: 1, color: '#ffffff', fontSize: 15 }}
                value={passwordForm.newPassword}
                onChangeText={(t) => setPasswordForm(prev => ({ ...prev, newPassword: t }))}
                placeholder="At least 6 characters"
                placeholderTextColor="#64748b"
                secureTextEntry={!showNewPass}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={showNewPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Field 3: CONFIRM NEW PASSWORD */}
            <Text style={{
              color: '#a855f7',
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 0.6,
              marginBottom: 8,
              textTransform: 'uppercase',
            }}>
              CONFIRM NEW PASSWORD
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#0d1322',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#26314d',
              paddingHorizontal: 16,
              paddingVertical: 14,
              marginBottom: 20,
            }}>
              <TextInput
                key={showConfirmPass ? 'conf-txt' : 'conf-sec'}
                style={{ flex: 1, color: '#ffffff', fontSize: 15 }}
                value={passwordForm.confirmPassword}
                onChangeText={(t) => setPasswordForm(prev => ({ ...prev, confirmPassword: t }))}
                placeholder="Re-type new password"
                placeholderTextColor="#64748b"
                secureTextEntry={!showConfirmPass}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Update Password Button */}
            <TouchableOpacity
              style={{
                backgroundColor: '#8b5cf6',
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={handleChangePassword}
              disabled={isChangingPass}
              activeOpacity={0.8}
            >
              {isChangingPass ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── 2. Delete Account Card (Danger Zone) ─── */}
          <View style={{
            backgroundColor: '#161c2e',
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.25)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            {/* Left: Trash Icon Box + Texts */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.3)',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700', marginBottom: 3 }}>
                  Delete Account
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 16 }}>
                  Permanently erase your account and all sleep history
                </Text>
              </View>
            </View>

            {/* Right: Delete Button Pill */}
            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.4)',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}
              activeOpacity={0.8}
            >
              {isDeletingAccount ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '700' }}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // ─── MAIN SETTINGS HUB ───────────────────────────────────────────────
        <View key="settings-hub-view">
          {/* Wearable Connections */}
          <Text style={[styles.sectionTitle, { fontSize: 15, marginTop: 20, marginBottom: 10, textAlign: 'left' }]}>
            Wearable Connections
          </Text>
          {/* Health Connect (Android) */}
          <View style={styles.wearableRow}>
            <View style={[styles.wearableIconContainer, { backgroundColor: '#fff' }]}>
              <Ionicons name="logo-apple" size={24} color="#000" />
            </View>
            <View style={styles.wearableTextContainer}>
              <Text style={styles.wearableTitle}>Apple Health</Text>
              {isAppleHealthLive ? (
                <Text style={styles.wearableStatusLive}>● LIVE</Text>
              ) : (
                <Text style={styles.wearableStatusDisconnected}>Disconnected</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.connectButton, isAppleHealthLive && styles.connectedBadge]}
              onPress={handleConnectAppleHealth}
              activeOpacity={0.8}
            >
              <Text style={[styles.connectButtonText, isAppleHealthLive && styles.connectedBadgeText]}>
                {isAppleHealthLive ? '✓ Connected' : '+ Connect'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Health Connect (Android) */}
          <View style={styles.wearableRow}>
            <View style={styles.wearableIconContainer}>
              <Ionicons name="fitness" size={24} color="#a259ff" />
            </View>
            <View style={styles.wearableTextContainer}>
              <Text style={styles.wearableTitle}>Health Connect</Text>
              <Text style={styles.wearableStatusDisconnected}>Available on Android</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.connectButton,
                { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }
              ]}
              onPress={handleConnectFit}
            >
              <Text style={[styles.connectButtonText, { color: '#888' }]}>Android Only</Text>
            </TouchableOpacity>
          </View>

          {/* Profile Tab — below Wearable Connections */}
          <View style={[styles.settingsList, { marginTop: 10 }]}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => setActiveTab('profile')}
              activeOpacity={0.7}
            >
              <Ionicons name="person-outline" size={24} color="#a259ff" />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.settingText}>Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, { marginTop: 10 }]}
              onPress={() => setActiveTab('account_privacy')}
              activeOpacity={0.7}
            >
              <Ionicons name="shield-checkmark-outline" size={24} color="#a259ff" />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.settingText}>Account and Privacy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>

          {/* Settings Options */}
          <View style={[styles.settingsList, { marginTop: 10 }]}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={24} color="#ff4444" />
              <Text style={[styles.settingText, { color: '#ff4444', marginLeft: 14 }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
