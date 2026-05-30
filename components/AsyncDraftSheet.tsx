import React from 'react';
import { View, Text, Pressable, ScrollView, Modal, Dimensions } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useOperationalStore } from '../store';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function AsyncDraftSheet() {
  const showAsyncDraft = useOperationalStore((s) => s.showAsyncDraft);
  const toggleAsyncDraft = useOperationalStore((s) => s.toggleAsyncDraft);
  const resolveIntervention = useOperationalStore((s) => s.resolveIntervention);
  const asyncDraft = useOperationalStore((s) => s.asyncDraft);

  if (!showAsyncDraft || !asyncDraft) return null;

  const handleSend = async () => {
    // Haptic only on successful stabilization — the moment of relief
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    resolveIntervention();
  };

  return (
    <Modal
      visible={showAsyncDraft}
      animationType="none"
      transparent
      onRequestClose={toggleAsyncDraft}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(28, 28, 25, 0.4)' }}>
        <Pressable className="flex-1" onPress={toggleAsyncDraft} />

        <Animated.View
          entering={SlideInDown.duration(400)}
          exiting={SlideOutDown.duration(300)}
          className="bg-surface rounded-t-2xl"
          style={{
            maxHeight: SCREEN_HEIGHT * 0.7,
            shadowColor: '#2d2d2d',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 20,
          }}
        >
          {/* Handle bar */}
          <View className="items-center pt-3 pb-2">
            <View
              className="rounded-full"
              style={{ width: 36, height: 4, backgroundColor: '#c4c7c7', opacity: 0.5 }}
            />
          </View>

          <ScrollView className="px-6 pb-8" showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="mb-5">
              <Text
                className="font-hanken-grotesk-semibold text-secondary"
                style={{ fontSize: 11, letterSpacing: 0.8, marginBottom: 6 }}
              >
                DRAFTED ASYNC UPDATE
              </Text>
              <Text
                className="font-eb-garamond-medium text-primary"
                style={{ fontSize: 22, lineHeight: 28 }}
              >
                {asyncDraft.subject}
              </Text>
            </View>

            {/* Recipients */}
            <View className="flex-row items-center gap-2 mb-4">
              <Ionicons name="people-outline" size={14} color="#747878" />
              <Text
                className="font-hanken-grotesk text-on-surface-variant"
                style={{ fontSize: 13 }}
              >
                {asyncDraft.to}
              </Text>
            </View>

            {/* Draft body */}
            <View
              className="bg-surface-container-low rounded-xl p-5 mb-5"
              style={{ borderWidth: 1, borderColor: 'rgba(196, 199, 199, 0.25)' }}
            >
              <Text
                className="font-hanken-grotesk text-primary"
                style={{ fontSize: 14, lineHeight: 22 }}
              >
                {asyncDraft.body}
              </Text>
            </View>

            {/* Confidence note */}
            <View className="flex-row items-center gap-2 mb-6">
              <View
                className="rounded-full"
                style={{
                  width: 5,
                  height: 5,
                  backgroundColor: asyncDraft.confidence > 0.7 ? '#6e5c40' : '#747878',
                }}
              />
              <Text
                className="font-hanken-grotesk text-on-surface-variant"
                style={{ fontSize: 12, opacity: 0.7 }}
              >
                {Math.round(asyncDraft.confidence * 100)}% confidence this covers the agenda
              </Text>
            </View>

            {/* Actions */}
            <View className="flex-row gap-3 mb-6">
              <Pressable
                onPress={handleSend}
                className="flex-1 bg-primary rounded-xl py-3.5 flex-row items-center justify-center gap-2 active:opacity-80"
              >
                <Text className="font-hanken-grotesk-semibold text-on-primary" style={{ fontSize: 15 }}>
                  Send & Protect Focus
                </Text>
                <Ionicons name="shield-checkmark" size={16} color="#fcf9f4" />
              </Pressable>
            </View>

            <Pressable onPress={toggleAsyncDraft} className="items-center mb-4">
              <Text
                className="font-hanken-grotesk text-on-surface-variant"
                style={{ fontSize: 13, textDecorationLine: 'underline', textDecorationColor: 'rgba(116, 120, 120, 0.3)' }}
              >
                Edit before sending
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
