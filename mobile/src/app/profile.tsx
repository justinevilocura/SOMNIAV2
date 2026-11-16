import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, TextInput, ScrollView, Platform } from 'react-native';
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
  const [isHealthConnectLive, setIsHealthConnectLive] = useState(false);
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
        cachedAge = authData.age || '';
        cachedGender = authData.gender || '';

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
            const finalAge = (isCustomized === 'true' && cachedAge) ? cachedAge : (json.userData.age ? String(json.userData.age) : '');
            const finalGender = (isCustomized === 'true' && cachedGender) ? cachedGender : (json.userData.gender || '');
            const finalAvatar = json.userData.avatar || cachedAvatar || '';

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
      const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
      const res = await fetch(`${backendUrl}/api/user/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        })
      });

      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const json = await res.json();
        if (json.success) {
          Toast.show({
            type: 'success',
            text1: 'Password Updated',
            text2: 'Your password was changed successfully.',
          });
          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
          setActiveTab('settings');
        } else {
          Alert.alert('Error', json.message || 'Could not change password.');
        }
      } else {
        Alert.alert('Notice', 'Password change request sent.');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
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

  const handleConnectAppleHealth = () => {
    if (Platform.OS !== 'ios') {
      Toast.show({
        type: 'info',
        text1: 'Apple Health',
        text2: 'Apple Health is supported on Apple iOS devices.',
      });
      return;
    }
    Toast.show({
      type: 'info',
      text1: 'Apple Health',
      text2: 'Connecting to Apple HealthKit...',
    });
  };

  return (
    <View style={styles.card}>
      {activeTab === 'profile' ? (
        // ─── DEDICATED PROFILE VIEW ──────────────────────────────────────────
        <View key="profile-details-view">
          <TouchableOpacity
            onPress={() => setActiveTab('settings')}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#a259ff" />
            <Text style={{ color: '#a259ff', fontSize: 15, fontWeight: '600', marginLeft: 6 }}>
              Back to Settings
            </Text>
          </TouchableOpacity>

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

            <Text style={styles.profileName}>{userData.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{userData.email}</Text>
            <Text style={{ color: '#a29bfe', fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
              Tap camera to change photo
            </Text>
          </View>

          {/* ─── PERSONAL DETAILS SECTION ─── */}
          <View style={styles.personalDetailsCard}>
            <View style={styles.detailsHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="person-circle-outline" size={20} color="#a259ff" style={{ marginRight: 6 }} />
                <Text style={styles.detailsTitle}>Personal Details</Text>
              </View>

              {!isEditing && (
                <TouchableOpacity
                  onPress={handleStartEdit}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 4 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={16} color="#a259ff" style={{ marginRight: 4 }} />
                  <Text style={styles.editActionText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {isEditing ? (
              // ── EDIT MODE ──
              <View style={{ marginTop: 6 }}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editForm.name}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, name: text }))}
                    placeholder="Enter full name"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Age</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editForm.age}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, age: text.replace(/[^0-9]/g, '') }))}
                    placeholder="e.g. 25"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Gender</Text>
                  <View style={styles.genderContainer}>
                    {['Male', 'Female', 'Prefer not to say', 'Other'].map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.genderPill,
                          editForm.gender === option && styles.genderPillActive,
                        ]}
                        onPress={() => setEditForm(prev => ({ ...prev, gender: option }))}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.genderText,
                            editForm.gender === option && styles.genderTextActive,
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Save / Cancel buttons */}
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setIsEditing(false)}
                    disabled={isSaving}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveProfile}
                    disabled={isSaving}
                    activeOpacity={0.7}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // ── DISPLAY MODE ──
              <View style={{ marginTop: 4 }}>
                <View style={styles.detailRow}>
                  <View style={styles.detailLabelContainer}>
                    <Ionicons name="person-outline" size={17} color="#a259ff" />
                    <Text style={styles.detailLabel}>Full Name</Text>
                  </View>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {userData.name || 'Not set'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailLabelContainer}>
                    <Ionicons name="calendar-outline" size={17} color="#a259ff" />
                    <Text style={styles.detailLabel}>Age</Text>
                  </View>
                  <Text style={styles.detailValue}>
                    {userData.age ? `${userData.age} years old` : 'Not set'}
                  </Text>
                </View>

                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.detailLabelContainer}>
                    <Ionicons name="transgender-outline" size={17} color="#a259ff" />
                    <Text style={styles.detailLabel}>Gender</Text>
                  </View>
                  <Text style={styles.detailValue}>
                    {userData.gender || 'Not set'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : activeTab === 'account_privacy' ? (
        // ─── DEDICATED ACCOUNT AND PRIVACY VIEW ──────────────────────────────
        <View key="account-privacy-view">
          <TouchableOpacity
            onPress={() => setActiveTab('settings')}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#a259ff" />
            <Text style={{ color: '#a259ff', fontSize: 15, fontWeight: '600', marginLeft: 6 }}>
              Back to Settings
            </Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { fontSize: 20, marginTop: 4, marginBottom: 16, textAlign: 'left' }]}>
            Account and Privacy
          </Text>

          {/* Change Password Card */}
          <View style={styles.personalDetailsCard}>
            <View style={styles.detailsHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="key-outline" size={20} color="#a259ff" style={{ marginRight: 6 }} />
                <Text style={styles.detailsTitle}>Change Password</Text>
              </View>
            </View>

            <View style={{ marginTop: 6 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    key={showCurrentPass ? 'curr-txt' : 'curr-sec'}
                    style={styles.passwordInput}
                    value={passwordForm.currentPassword}
                    onChangeText={(t) => setPasswordForm(prev => ({ ...prev, currentPassword: t }))}
                    placeholder="Enter current password"
                    placeholderTextColor="#666"
                    secureTextEntry={!showCurrentPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showCurrentPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    key={showNewPass ? 'new-txt' : 'new-sec'}
                    style={styles.passwordInput}
                    value={passwordForm.newPassword}
                    onChangeText={(t) => setPasswordForm(prev => ({ ...prev, newPassword: t }))}
                    placeholder="At least 6 characters"
                    placeholderTextColor="#666"
                    secureTextEntry={!showNewPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showNewPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    key={showConfirmPass ? 'conf-txt' : 'conf-sec'}
                    style={styles.passwordInput}
                    value={passwordForm.confirmPassword}
                    onChangeText={(t) => setPasswordForm(prev => ({ ...prev, confirmPassword: t }))}
                    placeholder="Re-type new password"
                    placeholderTextColor="#666"
                    secureTextEntry={!showConfirmPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { marginTop: 8 }]}
                onPress={handleChangePassword}
                disabled={isChangingPass}
                activeOpacity={0.7}
              >
                {isChangingPass ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Delete Account (Danger Zone) */}
          <View style={styles.dangerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="warning-outline" size={20} color="#ff5252" style={{ marginRight: 6 }} />
              <Text style={styles.dangerTitle}>Delete Account</Text>
            </View>
            <Text style={styles.dangerDesc}>
              Permanently delete your SOMNIA account and erase all sleep sessions, health data, and history. This cannot be undone.
            </Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}
              activeOpacity={0.8}
            >
              {isDeletingAccount ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.deleteBtnText}>Delete My Account</Text>
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
            <View style={styles.wearableIconContainer}>
              <Ionicons name="fitness" size={24} color="#a259ff" />
            </View>
            <View style={styles.wearableTextContainer}>
              <Text style={styles.wearableTitle}>Health Connect</Text>
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

          {/* Apple Health (iOS) */}
          <View style={styles.wearableRow}>
            <View style={[styles.wearableIconContainer, { backgroundColor: '#fff' }]}>
              <Ionicons name="logo-apple" size={24} color="#000" />
            </View>
            <View style={styles.wearableTextContainer}>
              <Text style={styles.wearableTitle}>Apple Health</Text>
              <Text style={styles.wearableStatusDisconnected}>
                {Platform.OS === 'ios' ? 'Disconnected' : 'Available on iOS'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.connectButton,
                Platform.OS !== 'ios' && { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }
              ]}
              onPress={handleConnectAppleHealth}
              activeOpacity={0.7}
            >
              <Text style={[styles.connectButtonText, Platform.OS !== 'ios' && { color: '#888' }]}>
                {Platform.OS === 'ios' ? '+ Connect' : 'iOS Only'}
              </Text>
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
