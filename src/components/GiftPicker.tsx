import React, { useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { GIFT_CATALOG, GIFT_TIERS, type GiftDefinition, type GiftTier } from '../types/gift';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectGift: (gift: GiftDefinition) => void;
  sending: boolean;
  recipientLabel: string;
};

export default function GiftPicker({ visible, onClose, onSelectGift, sending, recipientLabel }: Props) {
  const [activeTier, setActiveTier] = useState<GiftTier>(1);
  const giftsForTier = GIFT_CATALOG.filter((gift) => gift.tier === activeTier);

  const handlePress = (gift: GiftDefinition) => {
    Alert.alert(`Send ${gift.emoji} ${gift.name}?`, `${gift.cost.toLocaleString()} coins to ${recipientLabel}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: () => onSelectGift(gift) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Send a gift</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={styles.done}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tierRow} contentContainerStyle={styles.tierRowContent}>
            {GIFT_TIERS.map((item) => (
              <TouchableOpacity
                key={item.tier}
                style={[styles.tierChip, activeTier === item.tier && styles.tierChipActive]}
                onPress={() => setActiveTier(item.tier)}
              >
                <Text style={[styles.tierChipLabel, activeTier === item.tier && styles.tierChipLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={giftsForTier}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.giftCell} onPress={() => handlePress(item)} disabled={sending} activeOpacity={0.8}>
                <Text style={styles.giftEmoji}>{item.emoji}</Text>
                <Text style={styles.giftName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.giftCostRow}>
                  <Ionicons name="logo-bitcoin" size={12} color={colors.textMuted} />
                  <Text style={styles.giftCost}>{item.cost.toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
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
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  done: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  tierRow: {
    flexGrow: 0,
    marginTop: 12,
  },
  tierRowContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tierChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  tierChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tierChipLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  tierChipLabelActive: {
    color: colors.text,
  },
  grid: {
    padding: 16,
  },
  gridRow: {
    gap: 10,
  },
  giftCell: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    gap: 4,
  },
  giftEmoji: {
    fontSize: 30,
  },
  giftName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  giftCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  giftCost: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
});
