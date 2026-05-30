import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { 
  EBGaramond_400Regular,
  EBGaramond_500Medium
} from '@expo-google-fonts/eb-garamond';
import { 
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold
} from '@expo-google-fonts/hanken-grotesk';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import '../global.css';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'EBGaramond-Regular': EBGaramond_400Regular,
    'EBGaramond-Medium': EBGaramond_500Medium,
    'HankenGrotesk-Regular': HankenGrotesk_400Regular,
    'HankenGrotesk-Medium': HankenGrotesk_500Medium,
    'HankenGrotesk-SemiBold': HankenGrotesk_600SemiBold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fcf9f4' } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
