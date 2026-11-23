import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Ionicons';
import styles from '../../assets/styles/register.styles';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const GENDER_OPTIONS = ['Prefer not to say', 'Male', 'Female'];

export default function Register() {
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('Prefer not to say');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Verification Screen State
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [registeredToken, setRegisteredToken] = useState('');
  const [registeredUserId, setRegisteredUserId] = useState('');

  const inputRefs = useRef<Array<TextInput | null>>([]);
  const router = useRouter();

  const backendUrl =
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    'https://somniav2-production.up.railway.app';

  // ─── Google Sign-Up / In (OAuth) ──────────────────────────────────────────
  const iosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    '1087911574541-2d7d9rhuvrmekirapltq6ku7kmlccfpv.apps.googleusercontent.com';
  const webClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '1087911574541-igmmhfckvfr41vpk9uertjea4g10qn9v.apps.googleusercontent.com';

  const iosClientScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId,
    webClientId,
    scopes: ['profile', 'email'],
    redirectUri: makeRedirectUri({
      native: `${iosClientScheme}:/oauth2redirect`,
    }),
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const accessToken =
        googleResponse.authentication?.accessToken ||
        (googleResponse.params as any)?.access_token;
      if (accessToken) {
        handleGoogleBackendRegister(accessToken);
      }
    }
  }, [googleResponse]);

  const handleGoogleBackendRegister = async (accessToken: string) => {
    setIsLoading(true);
    try {
      const response = await axios.post(
        `${backendUrl}/api/auth/google`,
        { accessToken },
        { timeout: 15000 }
      );

      if (response.data.success) {
        const { token, user_id, name: gName, avatar, age, gender: gGender } = response.data;
        await AsyncStorage.setItem('token', token);

        let realName = gName || '';
        let userAvatar = avatar || '';
        let userAge = age ? String(age) : '';
        let userGender = gGender || '';

        try {
          const userRes = await fetch(`${backendUrl}/api/user/data`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const userJson = await userRes.json();
          if (userJson.success && userJson.userData) {
            realName = userJson.userData.name || realName;
            userAvatar = userJson.userData.avatar || userAvatar;
            userAge = userJson.userData.age ? String(userJson.userData.age) : userAge;
            userGender = userJson.userData.gender || userGender;
          }
        } catch (_) {}

        await AsyncStorage.setItem(
          'authData',
          JSON.stringify({
            token,
            timestamp: new Date().getTime(),
            isAuthenticated: true,
            user_id,
            name: realName || 'User',
            avatar: userAvatar,
            age: userAge,
            gender: userGender,
          })
        );

        Toast.show({ type: 'success', text1: 'Welcome!', text2: 'Signed up with Google.' });
        router.replace('/home');
      } else {
        Toast.show({ type: 'error', text1: 'Google Sign-Up Failed', text2: response.data.message });
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not sign up with Google.' });
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Resend Timer Countdown ───────────────────────────────────────────────
  useEffect(() => {
    let timer: any;
    if (step === 'verify' && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  // ─── Manual Register ──────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Please fill in all required fields!',
      });
      return;
    }

    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Password too short',
        text2: 'Password must be at least 6 characters.',
      });
      return;
    }

    setIsLoading(true);

    const bdate = birthdate.trim() ? birthdate.trim() : '2000-01-01';
    const userData = {
      name: name.trim(),
      email: email.trim(),
      password,
      birthdate: bdate,
      gender: gender || 'Prefer not to say',
    };

    try {
      const response = await axios.post(`${backendUrl}/api/auth/register`, userData, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        timeout: 15000,
      });

      if (response.data.success) {
        // Automatically attempt login to get token and trigger verify OTP
        try {
          const loginRes = await axios.post(
            `${backendUrl}/api/auth/login`,
            { email: email.trim(), password },
            { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
          );

          if (loginRes.data.success) {
            const token = loginRes.data.token;
            const uId = loginRes.data.user_id;
            setRegisteredToken(token);
            setRegisteredUserId(uId);

            // Request OTP email
            await axios.post(
              `${backendUrl}/api/auth/send-verify-otp`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );
          }
        } catch (_) {
          // If auto login fails, send-verify-otp endpoint can still be called
        }

        Toast.show({
          type: 'success',
          text1: 'Verification Code Sent!',
          text2: 'Please enter the 6-digit code sent to your email.',
        });
        setResendCooldown(60);
        setStep('verify');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Registration failed',
          text2: response.data.message || 'Please try again.',
        });
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'An error occurred. Please try again.';
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setIsLoading(false);
    }
  };

  // ─── OTP Input Handling ───────────────────────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ─── Verify Email ─────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      Toast.show({ type: 'error', text1: 'Please enter the full 6-digit code' });
      return;
    }

    setIsVerifying(true);
    try {
      const response = await axios.post(
        `${backendUrl}/api/auth/verify-account`,
        { otp: code, userId: registeredUserId },
        {
          headers: registeredToken ? { Authorization: `Bearer ${registeredToken}` } : {},
          withCredentials: true,
          timeout: 15000,
        }
      );

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Email Verified!',
          text2: 'Your account is ready. Please log in.',
        });
        router.replace('/(auth)/login');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Verification Failed',
          text2: response.data.message || 'Invalid OTP code.',
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Verification Error',
        text2: error.response?.data?.message || 'Could not verify code. Please try again.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // ─── Resend Code ──────────────────────────────────────────────────────────
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    try {
      const response = await axios.post(
        `${backendUrl}/api/auth/send-verify-otp`,
        { email: email.trim() },
        {
          headers: registeredToken ? { Authorization: `Bearer ${registeredToken}` } : {},
          withCredentials: true,
          timeout: 15000,
        }
      );

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Code Resent!',
          text2: 'A new 6-digit code was sent to your email.',
        });
        setResendCooldown(60);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed to resend',
          text2: response.data.message,
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Resend Failed',
        text2: error.response?.data?.message || 'Could not resend verification code.',
      });
    } finally {
      setIsResending(false);
    }
  };

  // Masked email for display (e.g. te****@gmail.com)
  const maskedEmail = email
    ? email.replace(/^(..)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.min(b.length, 4))}${c}`)
    : 'your email';

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#101522', '#18213a', '#2d325a']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <View style={styles.headerContainer}>
          <Image source={require('../../assets/images/somnia.png')} style={styles.logo} resizeMode="contain" />
        </View>

        {step === 'form' ? (
          /* ─── Sign Up Form ───────────────────────────────────────────────── */
          <View style={styles.cardNew}>
            {/* Tab Switcher */}
            <View style={styles.tabSwitcher}>
              <Pressable style={styles.tab} onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.tabText}>Log In</Text>
              </Pressable>
              <View style={[styles.tab, styles.tabActive]}>
                <Text style={styles.tabTextActive}>Sign Up</Text>
              </View>
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

            {/* Birthday and Gender Row */}
            <View style={localStyles.sideBySideRow}>
              {/* Birthday */}
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Birthday</Text>
                <TouchableOpacity
                  style={localStyles.compactInputRow}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Icon name="calendar-outline" size={18} color="#888" style={{ marginRight: 6 }} />
                  <Text style={[localStyles.compactInput, { lineHeight: 48, color: birthdate ? '#222' : '#aaa' }]}>
                    {birthdate || 'MM/DD/YYYY'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Gender */}
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.label}>Gender</Text>
                <TouchableOpacity
                  style={localStyles.compactInputRow}
                  onPress={() => setGenderModalVisible(true)}
                >
                  <Icon name="person-outline" size={18} color="#888" style={{ marginRight: 6 }} />
                  <Text style={localStyles.genderText} numberOfLines={1}>
                    {gender}
                  </Text>
                  <Icon name="chevron-down" size={16} color="#888" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </View>
            </View>

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

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Sign up with Google */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialBtnFull}
                onPress={() => promptGoogleAsync()}
                disabled={!googleRequest || isLoading}
              >
                <Image source={require('../../assets/images/google.png')} style={styles.socialIconFull} />
                <Text style={styles.socialBtnText}>Sign up with Google</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ─── Verify Email Screen ────────────────────────────────────────── */
          <View style={styles.cardNew}>
            {/* Back to Sign Up */}
            <TouchableOpacity style={localStyles.backBtn} onPress={() => setStep('form')}>
              <Icon name="arrow-back" size={20} color="#333" />
              <Text style={localStyles.backText}>Back to Sign Up</Text>
            </TouchableOpacity>

            {/* Mail Icon Circle */}
            <View style={localStyles.mailCircle}>
              <Icon name="mail-outline" size={36} color="#3578e5" />
            </View>

            <Text style={localStyles.verifyTitle}>Verify Your Email</Text>
            <Text style={localStyles.verifySubtitle}>
              We've sent a 6-digit code to{'\n'}
              <Text style={localStyles.emailHighlight}>{maskedEmail}</Text>
            </Text>

            {/* 6-Box OTP Input */}
            <View style={localStyles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[localStyles.otpBox, digit ? localStyles.otpBoxFilled : null]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={(e) => handleOtpKeyPress(e, index)}
                />
              ))}
            </View>

            {/* Verify Email Button */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleVerifyOtp}
              disabled={isVerifying}
            >
              <Text style={styles.loginButtonText}>
                {isVerifying ? 'Verifying...' : 'Verify Email'}
              </Text>
            </TouchableOpacity>

            {/* Resend Code Section */}
            <View style={localStyles.resendContainer}>
              <Text style={localStyles.resendPrompt}>Didn't receive the code?</Text>
              {resendCooldown > 0 ? (
                <Text style={localStyles.cooldownText}>Resend in {resendCooldown}s</Text>
              ) : (
                <TouchableOpacity onPress={handleResendCode} disabled={isResending}>
                  <Text style={localStyles.resendBtnText}>
                    {isResending ? 'Resending...' : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ─── Android Material Calendar Modal for iOS ─────────────────────── */}
      <Modal
        transparent
        animationType="fade"
        visible={showDatePicker}
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={calStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <TouchableOpacity activeOpacity={1} style={calStyles.dialog}>
            {/* Dark Header Banner */}
            <View style={calStyles.header}>
              <Text style={calStyles.headerYear}>{selectedDate.getFullYear()}</Text>
              <Text style={calStyles.headerDate}>
                {selectedDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
            </View>

            {/* Calendar Controls */}
            <View style={calStyles.monthNavRow}>
              <TouchableOpacity
                onPress={() => {
                  const d = new Date(selectedDate);
                  d.setMonth(d.getMonth() - 1);
                  setSelectedDate(d);
                }}
                style={calStyles.navArrow}
              >
                <Icon name="chevron-back" size={20} color="#333" />
              </TouchableOpacity>
              <Text style={calStyles.monthNavText}>
                {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const d = new Date(selectedDate);
                  d.setMonth(d.getMonth() + 1);
                  setSelectedDate(d);
                }}
                style={calStyles.navArrow}
              >
                <Icon name="chevron-forward" size={20} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Weekday Labels (M T W T F S S) */}
            <View style={calStyles.weekDaysRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                <Text key={idx} style={calStyles.weekDayLabel}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={calStyles.daysGrid}>
              {(() => {
                const year = selectedDate.getFullYear();
                const month = selectedDate.getMonth();
                const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const cells = [];

                // Blank cells before first day
                for (let i = 0; i < firstDayIndex; i++) {
                  cells.push(<View key={`blank-${i}`} style={calStyles.dayCell} />);
                }

                // Day numbers
                for (let d = 1; d <= daysInMonth; d++) {
                  const isSelected = selectedDate.getDate() === d;
                  cells.push(
                    <TouchableOpacity
                      key={`day-${d}`}
                      style={calStyles.dayCell}
                      onPress={() => {
                        const newD = new Date(selectedDate);
                        newD.setDate(d);
                        setSelectedDate(newD);
                      }}
                    >
                      <View style={[calStyles.dayCircle, isSelected && calStyles.dayCircleSelected]}>
                        <Text style={[calStyles.dayText, isSelected && calStyles.dayTextSelected]}>
                          {d}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }

                return cells;
              })()}
            </View>

            {/* Bottom Actions: CANCEL / OK */}
            <View style={calStyles.actionsRow}>
              <TouchableOpacity
                style={calStyles.actionBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={calStyles.actionCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={calStyles.actionBtn}
                onPress={() => {
                  const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                  const dd = String(selectedDate.getDate()).padStart(2, '0');
                  const yyyy = selectedDate.getFullYear();
                  setBirthdate(`${mm}/${dd}/${yyyy}`);
                  setShowDatePicker(false);
                }}
              >
                <Text style={calStyles.actionOkText}>OK</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─── Gender Selection Modal ───────────────────────────────────────── */}
      <Modal
        visible={genderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGenderModalVisible(false)}
      >
        <TouchableOpacity
          style={localStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setGenderModalVisible(false)}
        >
          <View style={localStyles.modalCard}>
            <Text style={localStyles.modalTitle}>Select Gender</Text>
            {GENDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[localStyles.genderOption, gender === opt && localStyles.genderOptionSelected]}
                onPress={() => {
                  setGender(opt);
                  setGenderModalVisible(false);
                }}
              >
                <Text
                  style={[
                    localStyles.genderOptionText,
                    gender === opt && localStyles.genderOptionTextSelected,
                  ]}
                >
                  {opt}
                </Text>
                {gender === opt && <Icon name="checkmark" size={18} color="#3578e5" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const localStyles = StyleSheet.create({
  sideBySideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  compactInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  compactInput: {
    flex: 1,
    height: 48,
    color: '#222',
    fontSize: 15,
  },
  genderText: {
    flex: 1,
    color: '#222',
    fontSize: 14,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  mailCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ebf3ff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  verifyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'center',
    marginBottom: 8,
  },
  verifySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emailHighlight: {
    color: '#3578e5',
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  otpBox: {
    width: 44,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  otpBoxFilled: {
    borderColor: '#3578e5',
    backgroundColor: '#fff',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  resendPrompt: {
    fontSize: 14,
    color: '#888',
    marginBottom: 6,
  },
  cooldownText: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: '600',
  },
  resendBtnText: {
    fontSize: 14,
    color: '#3578e5',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  genderOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  genderOptionSelected: {
    backgroundColor: '#f0f5ff',
  },
  genderOptionText: {
    fontSize: 15,
    color: '#444',
  },
  genderOptionTextSelected: {
    color: '#3578e5',
    fontWeight: '700',
  },
});

const calStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  dialog: {
    backgroundColor: '#303030',
    borderRadius: 8,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 24,
  },
  header: {
    backgroundColor: '#424242',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  headerYear: {
    color: '#bdbdbd',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  headerDate: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 8,
  },
  navArrow: {
    padding: 6,
  },
  monthNavText: {
    color: '#e0e0e0',
    fontSize: 14,
    fontWeight: '600',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  weekDayLabel: {
    width: 36,
    textAlign: 'center',
    color: '#9e9e9e',
    fontSize: 12,
    fontWeight: '500',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    minHeight: 210,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleSelected: {
    backgroundColor: '#80cbc4', // Material Teal matching the Android screenshot
  },
  dayText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '400',
  },
  dayTextSelected: {
    color: '#121212',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  actionCancelText: {
    color: '#80cbc4',
    fontSize: 14,
    fontWeight: '700',
  },
  actionOkText: {
    color: '#80cbc4',
    fontSize: 14,
    fontWeight: '700',
  },
});
