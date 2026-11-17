import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function OAuth2RedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    // Gracefully route back to the login screen where the auth listener completes the flow
    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
    }, 300);

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
