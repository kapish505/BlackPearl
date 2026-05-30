import React from 'react';
import { View, Text, Pressable, ScrollView, Modal, Dimensions } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useOperationalStore } from '../store';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const sourceIcons: Record<string, string> = {
  figma: 'color-palette',
  github: 'logo-github',
  slack: 'chatbubbles',
  calendar: 'calendar',
  cognition: 'body',
  survivability: 'shield-half',
  signals: 'pulse',
};

export function ReasoningChain() {
  const showReasoning = useOperationalStore((s) => s.showReasoning);
  const toggleReasoning = useOperationalStore((s) => s.toggleReasoning);
  const selectedIntervention = useOperationalStore((s) => s.selectedIntervention);
  const executeIntervention = useOperationalStore((s) => s.executeIntervention);
  const dismissIntervention = useOperationalStore((s) => s.dismissIntervention);
  const signals = useOperationalStore((s) => s.signals);

  if (!showReasoning || !selectedIntervention) return null;

  // Build reasoning nodes from synthesisReasoning
  const reasoningNodes: { source: string; icon: string; label: string; detail: string }[] = [];
  const sr = selectedIntervention.synthesisReasoning;
  if (sr) {
    if (sr.calendar) reasoningNodes.push({ source: 'calendar', icon: 'calendar', label: 'Calendar Signal', detail: sr.calendar });
    if (sr.slack) reasoningNodes.push({ source: 'slack', icon: 'chatbubbles', label: 'Slack Signal', detail: sr.slack });
    if (sr.github) reasoningNodes.push({ source: 'github', icon: 'logo-github', label: 'GitHub Signal', detail: sr.github });
    reasoningNodes.push({ source: 'cognition', icon: 'body', label: 'Operational Interpretation', detail: sr.interpretation });
  }
  
  // Fallback to signals if no synthesisReasoning
  if (reasoningNodes.length === 0) {
    for (const s of signals.slice(0, 5)) {
      reasoningNodes.push({
        source: s.source,
        icon: s.source,
        label: `${s.source.charAt(0).toUpperCase() + s.source.slice(1)} Signal`,
        detail: s.content,
      });
    }
  }

  return (
    <Modal
      visible={showReasoning}
      animationType="none"
      transparent
      onRequestClose={toggleReasoning}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(28, 28, 25, 0.4)' }}>
        <Pressable className="flex-1" onPress={toggleReasoning} />

        <Animated.View
          entering={SlideInDown.duration(400)}
          exiting={SlideOutDown.duration(300)}
          className="bg-surface rounded-t-2xl"
          style={{
            maxHeight: SCREEN_HEIGHT * 0.75,
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
            <View className="mb-6">
              <Text
                className="font-hanken-grotesk-semibold text-secondary"
                style={{ fontSize: 11, letterSpacing: 0.8, marginBottom: 6 }}
              >
                CORAL SYNTHESIS
              </Text>
              <Text
                className="font-eb-garamond-medium text-primary"
                style={{ fontSize: 24, lineHeight: 30 }}
              >
                Cross-Source Reasoning
              </Text>
            </View>

            {/* Signal nodes */}
            {reasoningNodes.length > 0 ? (
              <View className="mb-6">
                {reasoningNodes.map((node, i) => (
                  <Animated.View
                    key={`${node.source}-${i}`}
                    entering={FadeIn.duration(300).delay(i * 120)}
                    className="flex-row gap-3 mb-4"
                  >
                    {/* Signal icon */}
                    <View className="items-center" style={{ width: 36 }}>
                      <View
                        className="rounded-full bg-surface-container-high items-center justify-center"
                        style={{ width: 32, height: 32 }}
                      >
                        <Ionicons
                          name={(sourceIcons[node.source] || 'ellipse') as any}
                          size={15}
                          color="#6e5c40"
                        />
                      </View>
                      {i < reasoningNodes.length - 1 && (
                        <View
                          style={{
                            width: 1,
                            flex: 1,
                            backgroundColor: '#c4c7c7',
                            opacity: 0.3,
                            minHeight: 16,
                          }}
                        />
                      )}
                    </View>

                    {/* Signal content */}
                    <View className="flex-1 pb-2">
                      <Text
                        className="font-hanken-grotesk-semibold text-on-surface-variant"
                        style={{ fontSize: 11, letterSpacing: 0.4, marginBottom: 2, textTransform: 'uppercase' }}
                      >
                        {node.label}
                      </Text>
                      <Text
                        className="font-hanken-grotesk text-primary"
                        style={{ fontSize: 14, lineHeight: 20 }}
                      >
                        {node.detail}
                      </Text>
                    </View>
                  </Animated.View>
                ))}
              </View>
            ) : (
              <View className="mb-6 items-center py-4">
                <Text
                  className="font-hanken-grotesk text-on-surface-variant"
                  style={{ fontSize: 14, opacity: 0.5 }}
                >
                  No detailed reasoning available
                </Text>
              </View>
            )}

            {/* Synthesis divider */}
            <View className="items-center mb-4">
              <View style={{ width: 40, height: 1, backgroundColor: '#dbc3a1' }} />
            </View>

            {/* Synthesis conclusion */}
            <Animated.View
              entering={FadeIn.duration(400).delay(500)}
              className="bg-surface-container-low rounded-xl p-5 mb-6"
              style={{ borderWidth: 1, borderColor: 'rgba(110, 92, 64, 0.15)' }}
            >
              <View className="flex-row items-center gap-2 mb-2">
                <Ionicons name="sparkles" size={14} color="#6e5c40" />
                <Text
                  className="font-hanken-grotesk-semibold text-secondary"
                  style={{ fontSize: 11, letterSpacing: 0.6 }}
                >
                  SYNTHESIS
                </Text>
              </View>
              <Text
                className="font-hanken-grotesk text-primary"
                style={{ fontSize: 15, lineHeight: 22 }}
              >
                {selectedIntervention.description}
              </Text>
              <View className="flex-row items-center gap-1 mt-3">
                <View
                  className="rounded-full"
                  style={{ width: 5, height: 5, backgroundColor: '#6e5c40' }}
                />
                <Text
                  className="font-hanken-grotesk text-on-surface-variant"
                  style={{ fontSize: 11 }}
                >
                  {selectedIntervention.confidence.explanation}
                </Text>
              </View>
            </Animated.View>

            {/* Action buttons */}
            <View className="flex-row gap-3 mb-6">
              <Pressable
                onPress={() => executeIntervention(selectedIntervention)}
                className="flex-1 bg-primary rounded-xl py-3.5 items-center active:opacity-80"
              >
                <Text className="font-hanken-grotesk-semibold text-on-primary" style={{ fontSize: 15 }}>
                  {selectedIntervention.action}
                </Text>
              </Pressable>
              <Pressable
                onPress={dismissIntervention}
                className="px-5 rounded-xl py-3.5 items-center justify-center"
                style={{ borderWidth: 1, borderColor: 'rgba(110, 92, 64, 0.3)' }}
              >
                <Text className="font-hanken-grotesk text-on-surface-variant" style={{ fontSize: 14 }}>
                  Keep
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
