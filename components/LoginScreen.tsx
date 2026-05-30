import React, { useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogleNative, saveTokens, saveUser } from '../services/auth';
import { useOperationalStore } from '../store';

export function LoginScreen() {
  const setAuthenticated = useOperationalStore((s) => s.setAuthenticated);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const { accessToken, user } = await signInWithGoogleNative();
      // Assume token expires in 1 hour (standard for Google OAuth access tokens)
      await saveTokens(accessToken, 3600);
      await saveUser(user);
      setAuthenticated(accessToken, user);
    } catch (error) {
      console.error('Login failed:', error);
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-surface items-center justify-center px-8">
      <Animated.View entering={FadeIn.duration(800)} className="items-center mb-16">
        <Text className="font-eb-garamond text-5xl text-primary mb-3">
          Black Pearl
        </Text>
        <Text className="font-hanken text-base text-secondary text-center leading-6">
          A calm operational cognition layer{'\n'}for your real day.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).duration(600)} className="w-full items-center">
        <Text className="font-hanken text-sm text-secondary/60 text-center mb-6 leading-5">
          Black Pearl interprets operational pressure across your work systems.
        </Text>

        <Pressable
          onPress={handleLogin}
          disabled={isLoading}
          className={`w-full bg-primary rounded-2xl py-4 px-6 flex-row items-center justify-center gap-3 ${isLoading ? 'opacity-70' : 'active:opacity-80'}`}
        >
          {isLoading ? (
            <ActivityIndicator color="#fcf9f4" />
          ) : (
            <Ionicons name="logo-google" size={20} color="#fcf9f4" />
          )}
          <Text className="font-hanken-medium text-base text-surface">
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            const store = useOperationalStore.getState();
            store.setAuthenticated('coral-live', { email: 'coral@withcoral.com', name: 'Coral User', picture: '' });
            useOperationalStore.setState({ phase: 'connecting-sources' });
          }}
          disabled={isLoading}
          className="w-full bg-[#0e1010] rounded-2xl py-4 px-6 flex-row items-center justify-center gap-3 mt-3 active:opacity-80"
        >
          <Text style={{ fontSize: 18 }}>🪸</Text>
          <Text className="font-hanken-medium text-base text-[#b2eaa5]">
            Connect via Coral (Live)
          </Text>
        </Pressable>

        <Text className="font-hanken text-xs text-secondary/40 text-center mt-5 leading-4">
          Coral connects to GitHub, Slack, and Calendar{'\n'}via cross-source SQL queries.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(800).duration(600)} className="absolute bottom-12">
        <Text className="font-hanken text-xs text-secondary/30 text-center">
          Selective intervention · Emotional compression{'\n'}Confidence modeling
        </Text>
      </Animated.View>
    </View>
  );
}
