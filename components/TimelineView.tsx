import React from 'react';
import { View, Text } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  SlideOutRight,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useOperationalStore } from '../store';
import type { TimeBlock } from '../engine/types';


function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function BlockItem({ block, index, isUnstable }: { block: TimeBlock; index: number; isUnstable: boolean }) {
  const meta = block.metadata as Record<string, unknown> | undefined;
  const isResolved = meta?.resolved === true || meta?.wasConverted === true;
  const isDerived = meta?.derived === true;

  const dotColor = isResolved
    ? '#4a7c59'
    : isDerived
    ? '#b0b3b3'
    : block.type === 'meeting'
    ? isUnstable ? '#ba1a1a' : '#6e5c40'
    : block.type === 'focus'
    ? '#181919'
    : block.type === 'break'
    ? '#c4c7c7'
    : '#747878';

  const bgColor = isResolved
    ? 'rgba(74, 124, 89, 0.08)'
    : isDerived
    ? 'rgba(196, 199, 199, 0.1)'
    : block.type === 'meeting' && isUnstable
    ? 'rgba(255, 218, 214, 0.3)'
    : block.type === 'focus'
    ? 'rgba(246, 243, 238, 1)'
    : 'transparent';

  const iconName = isResolved
    ? 'checkmark-circle'
    : isDerived
    ? 'time-outline'
    : block.type === 'focus'
    ? 'radio-button-on'
    : block.type === 'meeting'
    ? isUnstable ? 'alert-circle' : 'people'
    : block.type === 'break'
    ? 'cafe-outline'
    : 'ellipse-outline';

  return (
    <Animated.View
      entering={FadeIn.duration(300).delay(index * 80)}
      exiting={SlideOutRight.duration(300)}
      layout={Layout.duration(400)}
      className="flex-row items-start gap-3 mb-1"
    >
      {/* Timeline dot + line */}
      <View className="items-center" style={{ width: 24 }}>
        <View
          className="rounded-full items-center justify-center"
          style={{
            width: 10,
            height: 10,
            backgroundColor: dotColor,
            marginTop: 6,
          }}
        />
        {/* Connector line */}
        <View
          style={{
            width: 1,
            flex: 1,
            backgroundColor: '#c4c7c7',
            opacity: 0.4,
            minHeight: 30,
          }}
        />
      </View>

      {/* Block card */}
      <View
        className="flex-1 rounded-lg mb-2"
        style={{
          backgroundColor: bgColor,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderWidth: isDerived ? 1 : isUnstable ? 1 : 0,
          borderColor: isDerived
            ? 'rgba(196, 199, 199, 0.4)'
            : isUnstable
            ? 'rgba(186, 26, 26, 0.25)'
            : 'transparent',
          borderStyle: isDerived ? 'dashed' : 'solid',
          opacity: isDerived ? 0.7 : 1,
        }}
      >
        {/* Time label */}
        <Text
          className="font-hanken-grotesk text-on-surface-variant"
          style={{ fontSize: 11, letterSpacing: 0.4, opacity: 0.7, marginBottom: 3 }}
        >
          {formatTime(block.start)} — {formatTime(block.end)}
        </Text>

        {/* Title row */}
        <View className="flex-row items-center gap-2">
          <Ionicons name={iconName as any} size={14} color={dotColor} />
          <Text
            className="font-hanken-grotesk-medium text-primary"
            style={{
              fontSize: 15,
              lineHeight: 20,
              opacity: isDerived ? 0.6 : 1,
            }}
          >
            {isDerived ? 'Free time' : block.title}
          </Text>
        </View>

        {/* Instability warning */}
        {isUnstable && !isResolved && (
          <Text
            className="font-hanken-grotesk text-error mt-1"
            style={{ fontSize: 12, opacity: 0.8 }}
          >
            Fragmentation risk — interrupts deep work
          </Text>
        )}

        {/* Resolved badge */}
        {isResolved && (
          <View className="flex-row items-center gap-1 mt-1.5">
            <Ionicons name="checkmark-circle" size={12} color="#4a7c59" />
            <Text
              className="font-hanken-grotesk"
              style={{ fontSize: 11, letterSpacing: 0.3, color: '#4a7c59' }}
            >
              {meta?.wasConverted ? 'Converted to async' : 'Resolved'}
            </Text>
          </View>
        )}

        {/* Derived / free gap indicator */}
        {isDerived && (
          <Text
            className="font-hanken-grotesk text-on-surface-variant mt-1"
            style={{ fontSize: 11, opacity: 0.5, fontStyle: 'italic' }}
          >
            Available gap between events
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

export function TimelineView() {
  const timeline = useOperationalStore((s) => s.timeline);
  const operationalState = useOperationalStore((s) => s.operationalState);
  const interventions = useOperationalStore((s) => s.interventions);

  // Graceful empty state
  if (!timeline.length) {
    return (
      <Animated.View entering={FadeIn.duration(400)} className="px-6 py-8 items-center">
        <Ionicons name="calendar-outline" size={28} color="#c4c7c7" />
        <Text
          className="font-hanken-grotesk text-on-surface-variant text-center mt-3"
          style={{ fontSize: 14, opacity: 0.5 }}
        >
          No events on your calendar today
        </Text>
      </Animated.View>
    );
  }

  // Collect block sources that interventions reference via synthesis traces
  const unstableBlockSources = interventions
    .flatMap((i) => Object.keys(i.synthesisReasoning || {}).filter(k => k !== 'interpretation').map(t => t.toLowerCase()));

  // Determine time period label
  const now = new Date();
  const currentHour = now.getHours();
  const periodLabel = currentHour < 12 ? 'MORNING' : currentHour < 17 ? 'AFTERNOON' : 'EVENING';

  return (
    <Animated.View
      entering={FadeIn.duration(400).delay(400)}
      className="px-6 py-4"
    >
      {/* Section header */}
      <View className="flex-row items-center justify-between mb-4">
        <Text
          className="font-eb-garamond-medium text-primary"
          style={{ fontSize: 20 }}
        >
          Timeline
        </Text>
        <Text
          className="font-hanken-grotesk text-on-surface-variant"
          style={{ fontSize: 11, letterSpacing: 0.5, opacity: 0.6 }}
        >
          {periodLabel} · {timeline.length} BLOCK{timeline.length !== 1 ? 'S' : ''}
        </Text>
      </View>

      {/* Interpretive Survivability & Pressure Gradient */}
      {operationalState && (
        <Animated.View 
          layout={Layout.duration(600)}
          className="mb-5 rounded-xl p-4"
          style={{
            backgroundColor: operationalState.survivability < 0.5 
              ? 'rgba(186, 26, 26, 0.03)' 
              : 'rgba(110, 92, 64, 0.02)',
            borderWidth: 1,
            borderColor: operationalState.survivability < 0.5 
              ? 'rgba(186, 26, 26, 0.1)' 
              : 'rgba(110, 92, 64, 0.05)',
          }}
        >
          <View
            className="rounded-full overflow-hidden mb-2"
            style={{ height: 2, backgroundColor: 'rgba(196, 199, 199, 0.2)' }}
          >
            <Animated.View
              layout={Layout.duration(600)}
              className="rounded-full"
              style={{
                height: 2,
                width: `${operationalState.survivability * 100}%`,
                backgroundColor:
                  operationalState.survivability > 0.7
                    ? '#6e5c40'
                    : operationalState.survivability > 0.4
                    ? '#747878'
                    : '#ba1a1a',
              }}
            />
          </View>
          <Text
            className="font-hanken-grotesk text-on-surface-variant"
            style={{ fontSize: 12, opacity: 0.8, letterSpacing: 0.3 }}
          >
            {operationalState.survivability > 0.7
              ? 'Operational weather is calm. Deep focus is protected.'
              : operationalState.survivability > 0.4
              ? 'Interruptions are subtly destabilizing your afternoon.'
              : 'Focus window highly vulnerable to cross-source escalation.'}
          </Text>
        </Animated.View>
      )}

      {/* Timeline blocks */}
      {timeline.map((block, i) => (
        <BlockItem
          key={block.id}
          block={block}
          index={i}
          isUnstable={
            block.type === 'meeting' &&
            ((block.metadata as Record<string, unknown>)?.canBeAsync === true ||
              unstableBlockSources.includes(block.source.toLowerCase()))
          }
        />
      ))}
    </Animated.View>
  );
}
