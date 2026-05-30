import React from 'react';
import { View, Text } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
} from 'react-native-reanimated';
import { useOperationalStore } from '../store';

export function NarrativeStatement() {
  const operationalState = useOperationalStore((s) => s.operationalState);
  const phase = useOperationalStore((s) => s.phase);

  // Graceful loading state
  if (!operationalState) {
    return (
      <Animated.View entering={FadeIn.duration(600)} className="px-6 pt-10 pb-6">
        <Text
          className="font-eb-garamond-medium text-on-surface-variant text-center"
          style={{ fontSize: 28, lineHeight: 34, opacity: 0.5 }}
        >
          Analyzing your day…
        </Text>
        <Text
          className="font-hanken-grotesk text-on-surface-variant text-center mt-3"
          style={{ fontSize: 15, lineHeight: 22, opacity: 0.4 }}
        >
          Reading your calendar and signals
        </Text>
      </Animated.View>
    );
  }

  const confidence = operationalState.confidence;
  const confidenceColor =
    confidence.level === 'high'
      ? '#6e5c40'
      : confidence.level === 'medium'
      ? '#747878'
      : '#ba1a1a';

  return (
    <Animated.View
      entering={FadeIn.duration(600).delay(200)}
      className="px-6 pt-10 pb-6"
    >
      <Animated.Text
        key={operationalState.headline}
        entering={SlideInUp.duration(600)}
        exiting={FadeOut.duration(300)}
        className="font-eb-garamond-medium text-primary text-center"
        style={{ fontSize: 32, lineHeight: 38, letterSpacing: -0.5 }}
      >
        {operationalState.headline}
      </Animated.Text>

      <Animated.Text
        key={operationalState.subheadline}
        entering={FadeIn.duration(400).delay(300)}
        className="font-hanken-grotesk text-on-surface-variant text-center mt-3"
        style={{ fontSize: 16, lineHeight: 24 }}
      >
        {operationalState.subheadline}
      </Animated.Text>

      {/* Confidence indicator — quiet, peripheral */}
      <View className="flex-row items-center justify-center mt-4 gap-2">
        <View
          className="rounded-full"
          style={{
            width: 6,
            height: 6,
            backgroundColor: confidenceColor,
            opacity: 0.7,
          }}
        />
        <Text
          className="font-hanken-grotesk text-on-surface-variant"
          style={{
            fontSize: 12,
            letterSpacing: 0.5,
            opacity: 0.6,
          }}
        >
          {confidence.level.toUpperCase()} CONFIDENCE
        </Text>
      </View>

      {phase === 'resolved' && (
        <Animated.View
          entering={FadeIn.duration(600).delay(400)}
          className="mt-4 items-center"
        >
          <View className="bg-secondary-container/40 rounded-full px-4 py-1.5">
            <Text
              className="font-hanken-grotesk-semibold text-on-secondary-container"
              style={{ fontSize: 12, letterSpacing: 0.3 }}
            >
              Focus window protected
            </Text>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
