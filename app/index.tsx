import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useOperationalStore } from '../store';
import { getStoredToken, getStoredUser, clearTokens } from '../services/auth';
import { LoginScreen } from '../components/LoginScreen';
import { ConnectSourcesScreen } from '../components/ConnectSourcesScreen';
import { NarrativeStatement } from '../components/NarrativeStatement';
import { TimelineView } from '../components/TimelineView';
import { InterventionCard } from '../components/InterventionCard';
import { ReasoningChain } from '../components/ReasoningChain';
import { AsyncDraftSheet } from '../components/AsyncDraftSheet';
import { CalibrationOverlay } from '../components/CalibrationOverlay';

export default function Home() {
  const {
    phase,
    user,
    operationalState,
    interventions,
    isRefreshing,
    errorMessage,
    showReasoning,
    showAsyncDraft,
    showCalibration,
    setAuthenticated,
    setUnauthenticated,
    refresh,
    triggerCalibration,
  } = useOperationalStore();

  // Check for stored auth on mount
  useEffect(() => {
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      const token = await getStoredToken();
      const storedUser = await getStoredUser();
      if (token && storedUser) {
        setAuthenticated(token, storedUser);
      }
    } catch (error) {
      console.error('Error checking stored auth:', error);
    }
  };

  const handleSignOut = async () => {
    await clearTokens();
    setUnauthenticated();
  };

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // ---- UNAUTHENTICATED ----
  if (phase === 'unauthenticated') {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen />
      </>
    );
  }

  // ---- CONNECTING SOURCES ----
  if (phase === 'connecting-sources') {
    return (
      <>
        <StatusBar style="dark" />
        <ConnectSourcesScreen />
      </>
    );
  }

  // ---- LOADING ----
  if (phase === 'loading') {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#6e5c40" />
        <Text className="font-hanken text-sm text-secondary mt-4">
          🪸 Querying Coral sources...
        </Text>
      </View>
    );
  }

  // ---- ERROR ----
  if (phase === 'error') {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-8">
        <StatusBar style="dark" />
        <Ionicons name="alert-circle-outline" size={48} color="#6e5c40" />
        <Text className="font-hanken-medium text-base text-primary mt-4 text-center">
          Something went wrong
        </Text>
        <Text className="font-hanken text-sm text-secondary mt-2 text-center">
          {errorMessage || 'Unable to load your calendar data.'}
        </Text>
        <View className="flex-row gap-3 mt-6">
          <Pressable
            onPress={() => refresh()}
            className="bg-primary/10 rounded-xl px-5 py-3"
          >
            <Text className="font-hanken-medium text-sm text-primary">Retry</Text>
          </Pressable>
          <Pressable
            onPress={handleSignOut}
            className="bg-primary/5 rounded-xl px-5 py-3"
          >
            <Text className="font-hanken text-sm text-secondary">Sign Out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- READY / INTERVENING / RESOLVED / CALIBRATING ----
  const greeting = getGreeting(user?.name?.split(' ')[0] || 'there');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View className="flex-1 bg-surface">
      <StatusBar style="dark" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#6e5c40"
          />
        }
      >
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(600)}
          className="px-6 pt-16 pb-4"
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-hanken text-sm text-secondary/60">{dateStr}</Text>
              <Text className="font-eb-garamond text-2xl text-primary mt-1">
                {greeting}
              </Text>
            </View>
            <Pressable
              onPress={handleSignOut}
              className="w-9 h-9 rounded-full bg-primary/5 items-center justify-center"
            >
              <Ionicons name="person-outline" size={18} color="#6e5c40" />
            </Pressable>
          </View>

          {/* Coral connection status badge */}
          <View className="flex-row items-center gap-2 mt-3 bg-white border border-[#b2eaa5] rounded-full px-3 py-1.5 self-start shadow-sm" style={{ shadowColor: '#398125', shadowOpacity: 0.1, shadowRadius: 8 }}>
            <Text style={{ fontSize: 13 }}>🪸</Text>
            <View className="w-1.5 h-1.5 rounded-full bg-[#398125]" />
            <Text className="font-hanken-medium text-xs text-[#398125]">
              Coral Live Connected
            </Text>
          </View>
          
        </Animated.View>

        {/* Narrative Statement */}
        <View className="px-6 py-4">
          <NarrativeStatement />
        </View>

        {/* Timeline */}
        <View className="px-6 py-4">
          <Text className="font-hanken-medium text-xs text-secondary/50 uppercase tracking-widest mb-3">
            Your Day
          </Text>
          <TimelineView />
        </View>

        {/* Interventions */}
        {interventions.length > 0 && (
          <View className="px-6 py-4">
            <Text className="font-hanken-medium text-xs text-secondary/50 uppercase tracking-widest mb-3">
              Suggestions
            </Text>
            <InterventionCard />
          </View>
        )}

        {/* Empty state when no interventions */}
        {interventions.length === 0 && phase === 'ready' && (
          <Animated.View entering={FadeIn.delay(300)} className="px-6 py-8">
            <View className="bg-primary/[0.03] rounded-2xl p-5 items-center">
              <Ionicons name="checkmark-circle-outline" size={28} color="#6e5c40" />
              <Text className="font-hanken text-sm text-secondary mt-2 text-center">
                No interventions needed right now.{'\n'}Your day looks manageable.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Calibration trigger */}
        {phase === 'ready' && now.getHours() >= 17 && (
          <Pressable
            onPress={triggerCalibration}
            className="mx-6 mt-4 mb-2 bg-primary/[0.03] rounded-2xl p-4 flex-row items-center gap-3"
          >
            <Ionicons name="pulse-outline" size={20} color="#6e5c40" />
            <View className="flex-1">
              <Text className="font-hanken-medium text-sm text-primary">
                End of day reflection
              </Text>
              <Text className="font-hanken text-xs text-secondary/60">
                How was today's pace?
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#6e5c40" />
          </Pressable>
        )}
      </ScrollView>

      {/* Overlays */}
      {showReasoning && <ReasoningChain />}
      {showAsyncDraft && <AsyncDraftSheet />}
      {showCalibration && <CalibrationOverlay />}
    </View>
  );
}

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}
