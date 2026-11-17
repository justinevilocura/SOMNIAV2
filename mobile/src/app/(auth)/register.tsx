import { View, Text, TouchableOpacity, Image, TextInput, Pressable, Platform, Modal, FlatList, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import styles from '../../assets/styles/register.styles';
import LinearGradient from 'react-native-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import DateTimePicker from '@react-native-community/datetimepicker';

WebBrowser.maybeCompleteAuthSession();

export default function Register() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('Prefer not to say');
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  const genderOptions = ['Male', 'Female', 'Prefer not to say', 'Other'];

  const router = useRouter();
  const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';

  // ─── Google Sign-In ────────────────────────────────────────────────────
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '1087911574541-88bl14n8rvhvbhf95qrkfara50au83sn.apps.googleusercontent.com';
  const androidClientScheme = `com.googleusercontent.apps.${androidClientId.replace('.apps.googleusercontent.com', '')}`;

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    androidClientId,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ['profile', 'email'],
    redirectUri: makeRedirectUri({
      native: `${androidClientScheme}:/oauth2redirect`,
    }),
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const accessToken =
        googleResponse.authentication?.accessToken ||
        (googleResponse.params as any)?.access_token;
      if (accessToken) {
        handleGoogleBackendLogin(accessToken);
      }
    }
  }, [googleResponse]);

  const handleGoogleBackendLogin = async (accessToken: string) => {
    setIsLoading(true);
    try {
      const response = await axios.post(
        `${backendUrl}/api/auth/google`,
        { accessToken },
        { timeout: 15000 }
      );
      if (response.data.success) {
        const { token, user_id, name: googleName, avatar, age, gender } = response.data;
        await AsyncStorage.setItem('token', token);

        let realName = googleName || '';
        let userAvatar = avatar || '';
        let userAge = age ? String(age) : '';
        let userGender = gender || '';

        try {
          const userRes = await fetch(`${backendUrl}/api/user/data`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const userJson = await userRes.json();
          if (userJson.success && userJson.userData) {
            realName = userJson.userData.name || realName;
            userAvatar = userJson.userData.avatar || userAvatar;
            userAge = userJson.userData.age ? String(userJson.userData.age) : userAge;
            userGender = userJson.userData.gender || userGender;
          }
        } catch (_) {}

        await AsyncStorage.setItem('authData', JSON.stringify({
          token,
          timestamp: new Date().getTime(),
          isAuthenticated: true,
          user_id,
          name: realName || 'User',
          avatar: userAvatar,
          age: userAge,
          gender: userGender,
        }));
        Toast.show({ type: 'success', text1: 'Welcome!', text2: 'Signed in with Google.' });
        router.replace('/home');
      } else {
        Toast.show({ type: 'error', text1: 'Google Sign Up Failed', text2: response.data.message });
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not sign in with Google.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    console.log('Register button pressed!');
    console.log('Form data:', { email, name, password });

    if (!email || !name || !password) {
      console.log('Missing fields detected');
      Toast.show({
        type: 'error',
        text1: 'Please fill in all fields!',
      });
      return;
    }

    if (!birthdate) {
      Toast.show({
        type: 'error',
        text1: 'Please select your birthday!',
      });
      return;
    }

    console.log('Starting registration...');
    setIsLoading(true);
    const userData = {
      email,
      name,
      password,
      birthdate: birthdate.toISOString().split('T')[0],
      gender,
    };
    try {
      console.log('Sending request to:', `${backendUrl}/api/auth/register`);
      const response = await axios.post(`${backendUrl}/api/auth/register`, userData, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      });

      console.log('Registration response:', response.data);

      if (response.data.success) {
        Toast.show({ type: 'success', text1: 'Account created successfully!' });
        router.replace('/(auth)/login');
      } else {
        Toast.show({ type: 'error', text1: 'Registration failed. Please try again.' });
      }
    } catch (error) {
      console.log('Registration error:', error);
      console.log('Error response:', error.response?.data);
      console.log('Error status:', error.response?.status);

      const errorMessage = error.response?.data?.message || 'An error occurred. Please try again later.';
      Toast.show({ type: 'error', text1: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#101522', '#18213a', '#2d325a']}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.headerContainer}>
        <Image source={require('../../assets/images/somnia.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.cardNew}>
        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <Pressable style={styles.tab} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.tabText}>Log In</Text>
          </Pressable>
          <View style={[styles.tab, styles.tabActive]}><Text style={styles.tabTextActive}>Sign Up</Text></View>
        </View>
        {/* Full Name */}
        <Text style={styles.label}>Full Name</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputNew}
            placeholder="Enter your full name"
            placeholderTextColor="#aaa"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>
        {/* Email Address */}
        <Text style={styles.label}>Email Address</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputNew}
            placeholder="Enter your email address"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        {/* Birthday & Gender Row */}
        <View style={styles.birthdayGenderRow}>
          {/* Birthday */}
          <View style={styles.halfInput}>
            <Text style={styles.label}>Birthday</Text>
            <TouchableOpacity
              style={styles.inputRow}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Icon name="calendar-outline" size={20} color="#888" style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, fontSize: 15, color: birthdate ? '#222' : '#aaa' }}>
                {birthdate
                  ? `${birthdate.getMonth() + 1}/${birthdate.getDate()}/${birthdate.getFullYear()}`
                  : 'MM/DD/YYYY'}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Gender */}
          <View style={styles.halfInput}>
            <Text style={styles.label}>Gender</Text>
            <TouchableOpacity
              style={styles.inputRow}
              onPress={() => setShowGenderPicker(true)}
              activeOpacity={0.7}
            >
              <Icon name="person-outline" size={20} color="#888" style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, fontSize: 15, color: '#222' }} numberOfLines={1}>
                {gender}
              </Text>
              <Icon name="chevron-down" size={18} color="#888" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Picker Modal (Android shows as dialog) */}
        {showDatePicker && (
          <DateTimePicker
            value={birthdate || new Date(2000, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            minimumDate={new Date(1920, 0, 1)}
            onChange={(event: any, selectedDate?: Date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) {
                setBirthdate(selectedDate);
              }
            }}
          />
        )}

        {/* Gender Picker Modal */}
        <Modal
          visible={showGenderPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowGenderPicker(false)}
        >
          <Pressable
            style={styles.genderModalOverlay}
            onPress={() => setShowGenderPicker(false)}
          >
            <View style={styles.genderModalContent}>
              <Text style={styles.genderModalTitle}>Select Gender</Text>
              {genderOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.genderOption,
                    gender === option && styles.genderOptionActive,
                  ]}
                  onPress={() => {
                    setGender(option);
                    setShowGenderPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      gender === option && styles.genderOptionTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                  {gender === option && (
                    <Icon name="checkmark" size={20} color="#3578e5" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Password */}
        <Text style={styles.label}>Password</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputNew}
            placeholder="Enter your password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Icon name={showPassword ? 'eye-off' : 'eye'} size={22} color="#888" style={styles.eyeIcon} />
          </TouchableOpacity>
        </View>
        {/* Sign Up Button */}
        <TouchableOpacity style={styles.loginButton} onPress={handleRegister} disabled={isLoading}>
          <Text style={styles.loginButtonText}>{isLoading ? 'Loading...' : 'Sign Up'}</Text>
        </TouchableOpacity>
        <View style={styles.signUpSpacing} />

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.orText}>Or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Buttons */}
        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.socialBtnFull}
            onPress={() => promptGoogleAsync()}
            disabled={!googleRequest || isLoading}
          >
            <Image source={require('../../assets/images/google.png')} style={styles.socialIconFull} />
            <Text style={styles.socialBtnText}>Google</Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
    </LinearGradient>
  );
}