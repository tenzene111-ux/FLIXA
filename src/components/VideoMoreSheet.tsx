import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import type { ReportReason } from '../services/moderation';

type SheetStage = 'menu' | 'why' | 'report';

type Props = {
  visible: boolean;
  onClose: () => void;
  reasons: string[];
  saved: boolean;
  hasSound: boolean;
  onToggleSave: () => void;
  onNotInterested: () => void;
  onHideCreator: () => void;
  onHideSound: () => void;
  onShare: () => void;
  onReport: (reason: ReportReason) => void;
};

// Replaces the old Alert-based long-press menu — Alert.alert can't
// reasonably present this many options, and the spec wants a real
// contextual action sheet (Not Interested / Save / Why am I seeing this? /
// Hide creator / Hide sound / Report / Share / Cancel). "Playback speed"
// and "Captions" from the original spec are deliberately left out — no
// such playback feature exists in this app's video pipeline, and adding
// fake menu entries for it would be worse than not having them. "Copy
// link" is also left out: it needs a clipboard native module (expo-
// clipboard) this project doesn't have yet, which would need a rebuild —
// Share already covers getting the link out.
export default function VideoMoreSheet({
  visible,
  onClose,
  reasons,
  saved,
  hasSound,
  onToggleSave,
  onNotInterested,
  onHideCreator,
  onHideSound,
  onShare,
  onReport,
}: Props) {
  const [view, setView] = useState<SheetStage>('menu');

  const close = () => {
    setView('menu');
    onClose();
  };

  const runAndClose = (action: () => void) => {
    action();
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {view === 'menu' ? (
            <>
              <View style={styles.grabber} />
              <Row icon="eye-off-outline" label="Not Interested" onPress={() => runAndClose(onNotInterested)} />
              <Row
                icon={saved ? 'bookmark' : 'bookmark-outline'}
                label={saved ? 'Unsave' : 'Save'}
                onPress={() => runAndClose(onToggleSave)}
              />
              <Row icon="information-circle-outline" label="Why am I seeing this?" onPress={() => setView('why')} />
              <Row icon="person-remove-outline" label="Hide videos from this creator" danger onPress={() => runAndClose(onHideCreator)} />
              {hasSound ? (
                <Row icon="musical-notes-outline" label="Hide videos using this sound" danger onPress={() => runAndClose(onHideSound)} />
              ) : null}
              <Row icon="arrow-redo-outline" label="Share" onPress={() => runAndClose(onShare)} />
              <Row icon="flag-outline" label="Report" danger onPress={() => setView('report')} />
              <Row icon="close" label="Cancel" onPress={close} />
            </>
          ) : view === 'why' ? (
            <>
              <View style={styles.grabber} />
              <Text style={styles.sectionTitle}>Why you're seeing this</Text>
              {reasons.map((reason) => (
                <View key={reason} style={styles.reasonRow}>
                  <Ionicons name="checkmark" size={16} color={colors.success} />
                  <Text style={styles.reasonLabel}>{reason}</Text>
                </View>
              ))}
              <Row icon="arrow-back" label="Back" onPress={() => setView('menu')} />
            </>
          ) : (
            <>
              <View style={styles.grabber} />
              <Text style={styles.sectionTitle}>Report video</Text>
              <Row icon="alert-circle-outline" label="Spam" danger onPress={() => runAndClose(() => onReport('spam'))} />
              <Row icon="warning-outline" label="Inappropriate" danger onPress={() => runAndClose(() => onReport('inappropriate'))} />
              <Row icon="ellipsis-horizontal" label="Other" danger onPress={() => runAndClose(() => onReport('other'))} />
              <Row icon="arrow-back" label="Back" onPress={() => setView('menu')} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} hitSlop={4}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowLabelDanger: {
    color: colors.danger,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  reasonLabel: {
    color: colors.textMuted,
    fontSize: 14,
    flex: 1,
  },
});
