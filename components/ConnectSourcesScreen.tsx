import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useOperationalStore } from '../store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import Constants from 'expo-constants';

const hostUri = Constants.expoConfig?.hostUri;
const serverIp = hostUri ? hostUri.split(':')[0] : (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
const CORAL_SERVER = `https://blackpearl-dhjr.onrender.com`;

interface SourceConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  envKey: string;
  placeholder: string;
  helpUrl: string;
  helpText: string;
}

const SOURCES: SourceConfig[] = [
  {
    id: 'github',
    name: 'GitHub',
    icon: 'logo-github',
    description: 'Pull requests, issues, reviews',
    envKey: 'GITHUB_TOKEN',
    placeholder: 'ghp_xxxxxxxxxxxx',
    helpUrl: 'https://github.com/settings/tokens',
    helpText: 'Use a classic PAT with repo access',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: 'chatbubbles',
    description: 'Messages, threads, mentions',
    envKey: 'SLACK_TOKEN',
    placeholder: 'xoxb-xxxxxxxxxxxx',
    helpUrl: 'https://api.slack.com/apps',
    helpText: 'Use your User OAuth Token',
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    icon: 'calendar',
    description: 'Events, meetings, schedules',
    envKey: 'GOOGLE_CALENDAR_ACCESS_TOKEN',
    placeholder: 'ya29.xxxxxxxxxxxx',
    helpUrl: 'https://developers.google.com/oauthplayground',
    helpText: 'Use your OAuth2 Access Token',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: 'mail',
    description: 'Emails, threads, communication',
    envKey: 'GMAIL_TOKEN',
    placeholder: 'ya29.xxxxxxxxxxxx',
    helpUrl: 'https://developers.google.com/oauthplayground',
    helpText: 'Use your Google account token',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: 'logo-discord',
    description: 'Servers, channels, messages',
    envKey: 'DISCORD_TOKEN',
    placeholder: 'Bot xxxxxxxxxxxx',
    helpUrl: 'https://discord.com/developers/applications',
    helpText: 'Use your Discord bot token',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'logo-linkedin',
    description: 'Professional networking, messages',
    envKey: 'LINKEDIN_TOKEN',
    placeholder: 'AQVxxxxxxxxxxxx',
    helpUrl: 'https://www.linkedin.com/developers/apps',
    helpText: 'Use your LinkedIn access token',
  },
];

function SourceCard({
  source,
  isConnected,
  isConnecting,
  onConnect,
}: {
  source: SourceConfig;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(SOURCES.indexOf(source) * 100).duration(400)}>
      <View
        className="rounded-2xl p-5 mb-3"
        style={{
          backgroundColor: isConnected ? 'rgba(178, 234, 165, 0.08)' : '#fff',
          borderWidth: 1,
          borderColor: isConnected ? 'rgba(178, 234, 165, 0.3)' : 'rgba(196, 199, 199, 0.2)',
          shadowColor: '#2d2d2d',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1">
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: isConnected ? 'rgba(178, 234, 165, 0.15)' : 'rgba(110, 92, 64, 0.06)' }}
            >
              <Ionicons
                name={source.icon as any}
                size={20}
                color={isConnected ? '#398125' : '#6e5c40'}
              />
            </View>
            <View className="flex-1">
              <Text className="font-hanken-medium text-base text-primary">{source.name}</Text>
              <Text className="font-hanken text-xs text-secondary mt-0.5">{source.description}</Text>
            </View>
          </View>

          {isConnected ? (
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-[#b2eaa5]" />
              <Text className="font-hanken-medium text-xs text-[#398125]">Connected</Text>
            </View>
          ) : (
            <Pressable
              onPress={onConnect}
              disabled={isConnecting}
              className="bg-primary/5 rounded-xl px-4 py-2 active:opacity-70"
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color="#6e5c40" />
              ) : (
                <Text className="font-hanken-medium text-sm text-primary">Connect</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export function ConnectSourcesScreen() {
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const store = useOperationalStore();
  const accessToken = store.accessToken;

  const handleConnect = async (source: SourceConfig) => {
    // Google Calendar auto-connects with existing token if manually set (bypassed for oauth flow)
    if (source.id === 'google_calendar' && accessToken && accessToken.length > 50) {
      submitToken(source, accessToken);
      return;
    }

    setConnectingId(source.id);
    try {
      const returnUrl = Linking.createURL('');
      const authUrl = `${CORAL_SERVER}/api/auth/login/${source.id}?returnTo=${encodeURIComponent(returnUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);

      if (result.type === 'success' && result.url) {
        const { queryParams } = Linking.parse(result.url);
        if (queryParams?.token) {
          await submitToken(source, queryParams.token as string);
        } else if (queryParams?.error) {
          Alert.alert('Authentication Failed', (queryParams.error as string) || 'Could not connect.');
          setConnectingId(null);
        }
      } else {
        setConnectingId(null); // User cancelled or it failed
      }
    } catch (err: any) {
      console.error('OAuth flow error:', err);
      Alert.alert('Error', 'Could not open authentication screen.');
      setConnectingId(null);
    }
  };

  const submitToken = async (source: SourceConfig, token: string) => {
    setIsSubmitting(true);
    setConnectingId(source.id);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${CORAL_SERVER}/api/sources/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: source.id, token }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const result = await response.json();

      if (result.status === 'ok') {
        setConnectedIds((prev) => [...new Set([...prev, source.id])]);
        store.addConnectedSource(source.id);
      } else {
        Alert.alert('Connection Failed', result.message || 'Could not connect to ' + source.name);
      }
    } catch (err: any) {
      Alert.alert(
        'Server Error',
        `Could not reach the Coral backend at ${CORAL_SERVER}.\n\n${err.message || 'Network request failed'}`
      );
    } finally {
      setIsSubmitting(false);
      setConnectingId(null);
    }
  };

  const handleContinue = () => {
    // Switch to live mode and load data
    store.setLiveMode();
    store.loadOperationalState();
  };

  const hasConnections = connectedIds.length > 0;

  return (
    <View className="flex-1 bg-surface px-6 pt-16">
      {/* Header */}
      <Animated.View entering={FadeIn.duration(600)} className="mb-8">
        <Text className="font-eb-garamond text-3xl text-primary mb-2">
          Connect your sources
        </Text>
        <Text className="font-hanken text-sm text-secondary leading-5">
          Black Pearl reads across your work systems{'\n'}to detect operational pressure via Coral SQL.
        </Text>
      </Animated.View>

      {/* Coral badge */}
      <Animated.View entering={FadeIn.delay(200).duration(400)} className="mb-6">
        <View className="flex-row items-center gap-2 bg-white border border-[#b2eaa5] rounded-full px-3 py-1.5 self-start shadow-sm" style={{ shadowColor: '#398125', shadowOpacity: 0.1, shadowRadius: 8 }}>
          <Text style={{ fontSize: 13 }}>🪸</Text>
          <View className="w-1.5 h-1.5 rounded-full bg-[#398125]" />
          <Text className="font-hanken-medium text-xs text-[#398125]">
            Powered by Coral · Cross-source SQL
          </Text>
        </View>
      </Animated.View>

      {/* Source cards */}
      <View className="mb-8">
        {SOURCES.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            isConnected={connectedIds.includes(source.id)}
            isConnecting={connectingId === source.id}
            onConnect={() => handleConnect(source)}
          />
        ))}
      </View>

      {/* Connected count */}
      {hasConnections && (
        <Animated.View entering={FadeIn.duration(300)} className="mb-4">
          <Text className="font-hanken text-xs text-secondary text-center">
            {connectedIds.length} source{connectedIds.length !== 1 ? 's' : ''} connected ·{' '}
            {connectedIds.length >= 2 ? 'Cross-source JOINs enabled' : 'Add more for cross-source synthesis'}
          </Text>
        </Animated.View>
      )}

      {/* Continue button */}
      <Pressable
        onPress={handleContinue}
        disabled={!hasConnections}
        className="w-full rounded-2xl py-4 items-center active:opacity-80"
        style={{
          backgroundColor: hasConnections ? '#1c1c19' : 'rgba(28, 28, 25, 0.08)',
        }}
      >
        <Text
          className="font-hanken-medium text-base"
          style={{ color: hasConnections ? '#fcf9f4' : 'rgba(28, 28, 25, 0.3)' }}
        >
          {hasConnections ? 'Continue to Black Pearl' : 'Connect at least one source'}
        </Text>
      </Pressable>

    </View>
  );
}
