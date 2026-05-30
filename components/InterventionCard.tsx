import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useOperationalStore } from '../store';
import type { Intervention } from '../engine/types';
import { getLastCoralQueryLog } from '../coral/proxy';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ConfidenceBadge({ level }: { level: string }) {
  const color =
    level === 'high' ? '#6e5c40' : level === 'medium' ? '#747878' : '#ba1a1a';
  return (
    <View className="flex-row items-center gap-1">
      <View
        className="rounded-full"
        style={{ width: 5, height: 5, backgroundColor: color }}
      />
      <Text
        className="font-hanken-grotesk"
        style={{ fontSize: 11, color, letterSpacing: 0.3 }}
      >
        {level} confidence
      </Text>
    </View>
  );
}

function InterventionItem({ intervention }: { intervention: Intervention }) {
  const selectIntervention = useOperationalStore((s) => s.selectIntervention);
  const executeIntervention = useOperationalStore((s) => s.executeIntervention);
  const showReasoning = useOperationalStore((s) => s.showReasoning);
  const toggleReasoning = useOperationalStore((s) => s.toggleReasoning);
  const dismissIntervention = useOperationalStore((s) => s.dismissIntervention);

  const iconMap: Record<string, string> = {
    'convert-async': 'swap-horizontal',
    'defer': 'time-outline',
    'protect-focus': 'shield-checkmark',
    'escalate': 'trending-up',
    'notify': 'notifications-outline',
  };

  const leverageLabel =
    intervention.leverage >= 0.7
      ? 'HIGH LEVERAGE'
      : intervention.leverage >= 0.4
      ? 'MODERATE LEVERAGE'
      : 'LOW LEVERAGE';

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(200)}
      className="bg-surface-container-low rounded-xl overflow-hidden"
      style={{
        borderWidth: 1,
        borderColor: 'rgba(196, 199, 199, 0.3)',
      }}
    >
      <View className="p-5">
        {/* Header */}
        <View className="flex-row items-center gap-2 mb-2">
          <View className="bg-secondary-container/50 rounded-full p-1.5">
            <Ionicons
              name={(iconMap[intervention.type] || 'bulb-outline') as any}
              size={14}
              color="#6e5c40"
            />
          </View>
          <Text
            className="font-hanken-grotesk-semibold text-secondary"
            style={{ fontSize: 11, letterSpacing: 0.8 }}
          >
            {leverageLabel}
          </Text>
        </View>

        {/* Title */}
        <Text
          className="font-eb-garamond-medium text-primary mb-1.5"
          style={{ fontSize: 22, lineHeight: 28 }}
        >
          {intervention.title}
        </Text>

        {/* Coral Magic Toggle */}
        <Pressable
          onPress={toggleReasoning}
          className="mb-3 mt-1 flex-row items-center gap-1.5"
        >
          <Text
            className="font-hanken-grotesk-medium text-secondary"
            style={{ fontSize: 13, textDecorationLine: 'underline', textDecorationColor: 'rgba(110, 92, 64, 0.3)' }}
          >
            ✨ Coral magic
          </Text>
          <Ionicons name={showReasoning ? 'chevron-up' : 'chevron-down'} size={12} color="#6e5c40" />
        </Pressable>

        {/* Expanded Synthesis Reasoning */}
        {showReasoning && intervention.synthesisReasoning && (
          <Animated.View entering={FadeIn.duration(300)} className="mb-4 gap-3 bg-[#f5f2ec] p-4 rounded-lg border border-[#e8e4db]">
            {intervention.synthesisReasoning.calendar && (
               <View>
                 <Text className="font-hanken-grotesk-semibold text-secondary text-[10px] tracking-wider uppercase mb-1">📅 Calendar</Text>
                 <Text className="font-hanken-grotesk text-primary text-sm">{intervention.synthesisReasoning.calendar}</Text>
               </View>
            )}
            {intervention.synthesisReasoning.slack && (
               <View>
                 <Text className="font-hanken-grotesk-semibold text-secondary text-[10px] tracking-wider uppercase mb-1">💬 Slack</Text>
                 <Text className="font-hanken-grotesk text-primary text-sm">{intervention.synthesisReasoning.slack}</Text>
               </View>
            )}
            {intervention.synthesisReasoning.github && (
               <View>
                 <Text className="font-hanken-grotesk-semibold text-secondary text-[10px] tracking-wider uppercase mb-1">🔧 GitHub</Text>
                 <Text className="font-hanken-grotesk text-primary text-sm">{intervention.synthesisReasoning.github}</Text>
               </View>
            )}
            <View className="mt-2 pt-3 border-t border-[#e8e4db]">
               <Text className="font-hanken-grotesk-semibold text-[#6e5c40] text-[10px] tracking-wider uppercase mb-1">🧠 Operational Interpretation</Text>
               <Text className="font-eb-garamond-medium text-primary" style={{ fontSize: 17, lineHeight: 22 }}>{intervention.synthesisReasoning.interpretation}</Text>
            </View>

            {/* Real Coral SQL Queries */}
            {(() => {
              const queryLog = getLastCoralQueryLog();
              if (!queryLog.length) return null;
              return (
                <View className="mt-3 pt-3 border-t border-[#e8e4db]">
                  <Text className="font-hanken-grotesk-semibold text-[#6e5c40] text-[10px] tracking-wider uppercase mb-2">🪸 CORAL SQL QUERIES EXECUTED</Text>
                  {queryLog.map((q, idx) => (
                    <View key={idx} className="mb-2 bg-[#1a1a1a] rounded-md p-3">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-[#b2eaa5] text-[10px] tracking-wider uppercase" style={{ fontFamily: 'monospace' }}>{q.name}</Text>
                        <Text className="text-[#737373] text-[10px]" style={{ fontFamily: 'monospace' }}>{q.elapsedMs}ms</Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <Text className="text-[#e8e4db] text-[11px] leading-4" style={{ fontFamily: 'monospace' }}>{q.sql}</Text>
                      </ScrollView>
                      <Text className="text-[10px] mt-1" style={{ fontFamily: 'monospace', color: q.status === 'ok' ? '#b2eaa5' : '#ff8d62' }}>
                        {q.status === 'ok' ? '✓ success' : `✗ ${q.error}`}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </Animated.View>
        )}

        {/* Source Convergence Trace */}
        {intervention.synthesisReasoning && (
          <View className="mt-1 flex-row items-center gap-1.5 opacity-60">
            <Text style={{ fontSize: 11 }}>📅 → 💬 → 🔧</Text>
            <Text className="font-hanken-grotesk text-secondary uppercase tracking-widest" style={{ fontSize: 10 }}>
              Synthesized from {Object.keys(intervention.synthesisReasoning).filter(k => k !== 'interpretation').map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(' • ')}
            </Text>
          </View>
        )}
      </View>

      {/* Action bar */}
      <View
        className="flex-row border-t"
        style={{ borderColor: 'rgba(196, 199, 199, 0.25)' }}
      >
        <AnimatedPressable
          onPress={() => {
            selectIntervention(intervention);
            executeIntervention(intervention);
          }}
          className="flex-1 flex-row items-center justify-center gap-2 py-3.5 bg-primary active:opacity-80"
          style={{ borderBottomLeftRadius: 12 }}
        >
          <Text className="font-hanken-grotesk-semibold text-on-primary" style={{ fontSize: 14 }}>
            {intervention.action}
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#fcf9f4" />
        </AnimatedPressable>
        <Pressable
          onPress={dismissIntervention}
          className="px-5 items-center justify-center"
          style={{ borderLeftWidth: 1, borderColor: 'rgba(196, 199, 199, 0.25)' }}
        >
          <Text className="font-hanken-grotesk text-on-surface-variant" style={{ fontSize: 13 }}>
            Dismiss
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function InterventionCard() {
  const interventions = useOperationalStore((s) => s.interventions);
  const phase = useOperationalStore((s) => s.phase);

  // Don't show when resolved or no interventions
  if (phase === 'resolved') return null;
  if (!interventions.length) return null;

  return (
    <View className="px-6 py-2">
      {/* Only show top intervention — selective, not overwhelming */}
      <InterventionItem intervention={interventions[0]} />
    </View>
  );
}
