import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OAuth2RedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    // Route back to whichever screen initiated Google Auth so its listener completes the login
    const handleRedirect = async () => {
      try {
        const origin = (await AsyncStorage.getItem('googleAuthOrigin')) || '/(auth)/login';
        router.replace(origin as any);
      } catch {
        router.replace('/(auth)/login');
      }
    };

    const timer = setTimeout(handleRedirect, 200);
    return () => clearTimeout(timer);
  }, [router]);

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
