import { View, Text, TextInput, TouchableOpacity, Image, Pressable, Keyboard } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import styles from '../../assets/styles/verifyEmail.styles';

export default function VerifyEmail() {
  const router = useRouter();
  const { token, user_id, email } = useLocalSearchParams<{
    token: string;
    user_id: string;
    email: string;
  }>();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handlePaste = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 6).split('');
    const newOtp = [...otp];
    digits.forEach((d, i) => { newOtp[i] = d; });
    setOtp(newOtp);
    // Focus last filled or the next empty
    const focusIndex = Math.min(digits.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      Toast.show({ type: 'error', text1: 'Please enter the full 6-digit code.' });
      return;
    }

    setIsVerifying(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token && token !== 'undefined' && token !== 'null') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${backendUrl}/api/auth/verify-account`,
        { otp: otpString, email, userId: user_id },
        { headers, timeout: 15000 }
      );

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Email Verified!',
          text2: 'Your account has been verified. Please log in.',
        });
        router.replace('/(auth)/login');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Verification Failed',
          text2: response.data.message || 'Invalid code. Please try again.',
        });
      }
    } catch (error: any) {
      const msg =
        error.response?.data?.message || 'Could not verify. Please try again.';
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;

    setIsResending(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token && token !== 'undefined' && token !== 'null') {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${backendUrl}/api/auth/send-verify-otp`,
        { email, userId: user_id },
        { headers, timeout: 15000 }
      );

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Code Resent',
          text2: 'A new verification code has been sent to your email.',
        });
        setCountdown(60); // 60-second cooldown
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Resend Failed',
          text2: response.data.message || 'Could not resend code.',
        });
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Could not resend verification code.';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: msg,
      });
    } finally {
      setIsResending(false);
    }
  };

  // Mask email for display
  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
    : 'your email';

  return (
    <LinearGradient
      colors={['#101522', '#18213a', '#2d325a']}
      style={{ flex: 1 }}
    >
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
        <View style={styles.headerContainer}>
          <Image
            source={require('../../assets/images/somnia.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.card}>
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Icon name="arrow-back" size={22} color="#555" />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Icon name="mail-outline" size={36} color="#3578e5" />
            </View>
          </View>

          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit verification code to{'\n'}
            <Text style={styles.emailText}>{maskedEmail}</Text>
          </Text>

          {/* OTP Input */}
          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[
                  styles.otpInput,
                  digit ? styles.otpInputFilled : null,
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, index)
                }
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={index === 0}
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              otp.join('').length !== 6 && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerify}
            disabled={isVerifying || otp.join('').length !== 6}
          >
            <Text style={styles.verifyButtonText}>
              {isVerifying ? 'Verifying...' : 'Verify Email'}
            </Text>
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code?</Text>
            <TouchableOpacity
              onPress={handleResendOtp}
              disabled={isResending || countdown > 0}
            >
              <Text
                style={[
                  styles.resendLink,
                  (isResending || countdown > 0) && styles.resendLinkDisabled,
                ]}
              >
                {isResending
                  ? 'Resending...'
                  : countdown > 0
                  ? `Resend in ${countdown}s`
                  : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </LinearGradient>
  );
}
