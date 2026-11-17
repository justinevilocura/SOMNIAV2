import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SafeScreen from "../components/SafeScreen";
import { Slot } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as WebBrowser from 'expo-web-browser';
import { syncAllNotifications, setupNotificationChannel } from "../utils/notificationService";

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  useEffect(() => {
    // Initialize notification channel and verify all active alarms on launch
    setupNotificationChannel();
    syncAllNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeScreen>
        <Slot />
      </SafeScreen>
      <Toast />
    </SafeAreaProvider>
  );
}
