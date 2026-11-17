import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Linking } from 'react-native';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Toast from 'react-native-toast-message';

function extractAccessToken(url: string): string | null {
  if (!url) return null;
  const match = url.match(/[#?&]access_token=([^&]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

export default function OAuth2RedirectHandler() {
  const router = useRouter();
  const localParams = useLocalSearchParams();
  const globalParams = useGlobalSearchParams();

  useEffect(() => {
    let isHandled = false;

    const processLogin = async (accessToken: string) => {
      if (isHandled) return;
      isHandled = true;

      try {
        const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';
        const response = await axios.post(
          `${backendUrl}/api/auth/google`,
          { accessToken },
          { timeout: 15000 }
        );

        if (response.data.success) {
          const { token, user_id, name, email, avatar, age, gender } = response.data;
          await AsyncStorage.setItem('token', token);

          let realName = name || '';
          let realEmail = email || '';
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
              realEmail = userJson.userData.email || realEmail;
              userAvatar = userJson.userData.avatar || userAvatar;
              userAge = userJson.userData.age ? String(userJson.userData.age) : userAge;
              userGender = userJson.userData.gender || userGender;
            }
          } catch (_) {}

          await AsyncStorage.removeItem('profileCustomized');
          await AsyncStorage.setItem('authData', JSON.stringify({
            token,
            timestamp: new Date().getTime(),
            isAuthenticated: true,
            user_id,
            email: realEmail,
            name: realName || 'User',
            avatar: userAvatar,
            age: userAge,
            gender: userGender,
          }));

          Toast.show({ type: 'success', text1: 'Welcome!', text2: `Signed in as ${realEmail}` });
          router.replace('/home');
          return;
        }
      } catch (err) {
        console.error('oauth2redirect backend login error:', err);
      }

      // If backend login failed or token was invalid, route back to origin
      const origin = (await AsyncStorage.getItem('googleAuthOrigin')) || '/(auth)/login';
      router.replace(origin as any);
    };

    const checkUrl = async () => {
      // 1. Check local search params (Expo Router query parameters)
      if (localParams.access_token) {
        return processLogin(String(localParams.access_token));
      }
      if (globalParams.access_token) {
        return processLogin(String(globalParams.access_token));
      }

      // 2. Check Linking initial URL
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const tokenFromUrl = extractAccessToken(initialUrl);
          if (tokenFromUrl) {
            return processLogin(tokenFromUrl);
          }
        }
      } catch (_) {}

      // 3. Fallback: wait briefly in case Google.useAuthRequest completes on the auth screen
      setTimeout(async () => {
        if (!isHandled) {
          const origin = (await AsyncStorage.getItem('googleAuthOrigin')) || '/(auth)/login';
          router.replace(origin as any);
        }
      }, 1500);
    };

    checkUrl();

    // 4. Listen for incoming deep link events
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const tokenFromUrl = extractAccessToken(url);
      if (tokenFromUrl) {
        processLogin(tokenFromUrl);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#a259ff" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1527',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
  },
});
