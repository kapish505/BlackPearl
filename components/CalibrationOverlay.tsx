import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Dimensions } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useOperationalStore } from '../store';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const paceOptions = ['Harmonious', 'Manageable', 'Rushed', 'Overwhelming'] as const;
const drainOptions = ['Context Switching', 'Prolonged Meetings', 'Urgent Requests', 'Digital Noise', 'Internal Fatigue'] as const;

// Map pace labels to numeric ratings (1 = best, 4 = worst)
const paceRatingMap: Record<string, number> = {
  Harmonious: 1,
  Manageable: 2,
  Rushed: 3,
  Overwhelming: 4,
};

export function CalibrationOverlay() {
  const showCalibration = useOperationalStore((s) => s.showCalibration);
  const dismissCalibration = useOperationalStore((s) => s.dismissCalibration);
  const submitCalibration = useOperationalStore((s) => s.submitCalibration);

  const [selectedPace, setSelectedPace] = useState<string | null>(null);
  const [selectedDrains, setSelectedDrains] = useState<Set<string>>(new Set());

  if (!showCalibration) return null;

  const toggleDrain = (drain: string) => {
    setSelectedDrains((prev) => {
      const next = new Set(prev);
      if (next.has(drain)) next.delete(drain);
      else next.add(drain);
      return next;
    });
  };

  const handleSubmit = () => {
    const paceRating = selectedPace ? paceRatingMap[selectedPace] : 2;
    // Derive accuracy from how many drains were selected (more drains = less accurate predictions)
    const accuracyRating = Math.max(1, 5 - selectedDrains.size);

    submitCalibration({ paceRating, accuracyRating });

    // Reset local state for next use
    setSelectedPace(null);
    setSelectedDrains(new Set());
  };

  return (
    <Modal
      visible={showCalibration}
      animationType="none"
      transparent
      onRequestClose={dismissCalibration}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(28, 28, 25, 0.35)' }}>
        <Pressable className="flex-1" onPress={dismissCalibration} />

        <Animated.View
          entering={SlideInDown.duration(400)}
          exiting={SlideOutDown.duration(300)}
          className="bg-surface rounded-t-2xl"
          style={{
            maxHeight: SCREEN_HEIGHT * 0.8,
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
            <View className="items-center mb-8 mt-2">
              <Text
                className="font-hanken-grotesk-semibold text-secondary"
                style={{ fontSize: 11, letterSpacing: 0.8, marginBottom: 8 }}
              >
                REFLECTION
              </Text>
              <Text
                className="font-eb-garamond-medium text-primary text-center"
                style={{ fontSize: 28, lineHeight: 34 }}
              >
                Calibration
              </Text>
              <Text
                className="font-hanken-grotesk text-on-surface-variant text-center mt-2"
                style={{ fontSize: 15, lineHeight: 22, maxWidth: 280 }}
              >
                A quiet moment to anchor your thoughts.
              </Text>
            </View>

            {/* Divider */}
            <View className="items-center mb-8">
              <View style={{ width: 40, height: 1, backgroundColor: '#c4c7c7', opacity: 0.4 }} />
            </View>

            {/* Pace question */}
            <View className="mb-8">
              <Text
                className="font-eb-garamond-medium text-primary text-center mb-4"
                style={{ fontSize: 20 }}
              >
                Was today's pace realistic?
              </Text>
              <View className="flex-row flex-wrap justify-center gap-2">
                {paceOptions.map((pace) => (
                  <Pressable
                    key={pace}
                    onPress={() => setSelectedPace(pace)}
                    className="rounded-full px-4 py-2"
                    style={{
                      backgroundColor: selectedPace === pace ? '#f8dfbb' : '#fcf9f4',
                      borderWidth: 1,
                      borderColor: selectedPace === pace ? '#6e5c40' : 'rgba(196, 199, 199, 0.5)',
                    }}
                  >
                    <Text
                      className="font-hanken-grotesk-medium"
                      style={{
                        fontSize: 13,
                        color: selectedPace === pace ? '#55442a' : '#444748',
                      }}
                    >
                      {pace}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Drain question */}
            <View className="mb-8">
              <Text
                className="font-eb-garamond-medium text-primary text-center mb-2"
                style={{ fontSize: 20 }}
              >
                What clouded your focus?
              </Text>
              <Text
                className="font-hanken-grotesk text-on-surface-variant text-center mb-4"
                style={{ fontSize: 13, opacity: 0.7 }}
              >
                Select all that apply
              </Text>
              <View className="flex-row flex-wrap justify-center gap-2">
                {drainOptions.map((drain) => (
                  <Pressable
                    key={drain}
                    onPress={() => toggleDrain(drain)}
                    className="rounded-full px-4 py-2"
                    style={{
                      backgroundColor: selectedDrains.has(drain) ? '#f8dfbb' : '#fcf9f4',
                      borderWidth: 1,
                      borderColor: selectedDrains.has(drain) ? '#6e5c40' : 'rgba(196, 199, 199, 0.5)',
                    }}
                  >
                    <Text
                      className="font-hanken-grotesk-medium"
                      style={{
                        fontSize: 13,
                        color: selectedDrains.has(drain) ? '#55442a' : '#444748',
                      }}
                    >
                      {drain}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Save */}
            <Pressable
              onPress={handleSubmit}
              className="bg-primary rounded-full py-3.5 items-center mb-4 active:opacity-80"
            >
              <Text className="font-hanken-grotesk-semibold text-on-primary" style={{ fontSize: 15 }}>
                Seal Today's Record
              </Text>
            </Pressable>

            <Pressable onPress={dismissCalibration} className="items-center mb-4">
              <Text
                className="font-hanken-grotesk text-on-surface-variant"
                style={{ fontSize: 13, opacity: 0.6 }}
              >
                Skip this evening
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
