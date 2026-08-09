import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import { NAV_FOOTPRINT } from '../navigation/LiquidTabBar';
import { useAuth } from '../context/AuthContext';
import { subscribeToDiamondBalance, subscribeToWalletBalance, subscribeToWalletTransactions } from '../services/wallet';
import type { WalletTransaction } from '../types/wallet';
import type { ProfileStackParamList } from '../navigation/ProfileStackNavigator';
import { formatNgultrum } from '../utils/currency';

const TRANSACTION_ICONS: Record<WalletTransaction['type'], keyof typeof Ionicons.glyphMap> = {
  topup: 'add-circle-outline',
  gift: 'gift-outline',
  reward: 'trophy-outline',
  refund: 'return-up-back-outline',
};

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [diamonds, setDiamonds] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToWalletBalance(user.uid, setBalance);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToDiamondBalance(user.uid, setDiamonds);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToWalletTransactions(user.uid, setTransactions);
  }, [user]);

  const handleTopUp = () => {
    Alert.alert('Top Up', "Real payments aren't set up yet — this is a placeholder for now.");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={styles.headerSpacer} />
      </View>

      <LinearGradient
        colors={colors.gradientButton}
        style={styles.balanceCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.balanceLabel}>Balance</Text>
        <View style={styles.balanceRow}>
          <Ionicons name="logo-bitcoin" size={26} color={colors.text} />
          <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
        </View>
        <Text style={styles.balanceNgultrum}>≈ {formatNgultrum(balance)}</Text>
        <TouchableOpacity style={styles.topUpButton} onPress={handleTopUp} activeOpacity={0.85}>
          <Text style={styles.topUpLabel}>Top Up</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.diamondRow}>
        <Ionicons name="diamond" size={18} color={colors.cyan} />
        <Text style={styles.diamondLabel}>Diamonds earned from gifts</Text>
        <Text style={styles.diamondValue}>{diamonds.toLocaleString()}</Text>
      </View>

      <Text style={styles.sectionTitle}>Transactions</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + NAV_FOOTPRINT + 16 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.transactionRow}>
            <Ionicons name={TRANSACTION_ICONS[item.type]} size={22} color={colors.text} style={styles.transactionIcon} />
            <Text style={styles.transactionLabel}>{item.label}</Text>
            <Text style={[styles.transactionAmount, item.amount < 0 ? styles.amountNegative : styles.amountPositive]}>
              {item.amount > 0 ? '+' : ''}
              {item.amount.toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 24,
  },
  balanceCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  balanceNgultrum: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
  },
  topUpButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  topUpLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  diamondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    gap: 8,
  },
  diamondLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
  },
  diamondValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  transactionIcon: {
    width: 22,
  },
  transactionLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  amountPositive: {
    color: colors.primary,
  },
  amountNegative: {
    color: colors.danger,
  },
});
