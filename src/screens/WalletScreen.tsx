import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { subscribeWalletBalance, subscribeWalletTransactions, verifyTopupPurchase } from '../services/wallet';
import type { ProfileStackParamList } from '../navigation/ProfileStackNavigator';
import type { WalletTransaction } from '../types/models';
import { formatCompactNumber } from '../utils/format';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Wallet'>;

const TRANSACTION_ICON: Record<WalletTransaction['type'], keyof typeof Ionicons.glyphMap> = {
  topup: 'add-circle-outline',
  gift: 'gift-outline',
  reward: 'trophy-outline',
  refund: 'return-down-back-outline',
};

// One in-app-purchase product; App Store Connect / Play Console must define
// a matching consumable product with this ID (see functions/README.md).
const TOPUP_PRODUCT_ID = 'com.flixa.coins.1000';

export default function WalletScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubBalance = subscribeWalletBalance(user.uid, setBalance);
    const unsubTx = subscribeWalletTransactions(user.uid, setTransactions);
    return () => {
      unsubBalance();
      unsubTx();
    };
  }, [user]);

  const handleTopUp = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Top Up', 'In-app purchases require the native app (iOS/Android), not the web preview.');
      return;
    }

    setPurchasing(true);
    try {
      // react-native-iap needs native linking, so it's only required here,
      // on-demand, and only on native platforms.
      const RNIap = require('react-native-iap');
      await RNIap.initConnection();
      const purchase = await RNIap.requestPurchase({ sku: TOPUP_PRODUCT_ID });
      const purchaseToken = purchase?.purchaseToken ?? purchase?.transactionReceipt;
      await verifyTopupPurchase({
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        productId: TOPUP_PRODUCT_ID,
        purchaseToken,
      });
      await RNIap.finishTransaction({ purchase, isConsumable: true });
    } catch (err: any) {
      Alert.alert('Top Up failed', err?.message ?? 'Purchase could not be completed.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerAction}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
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
          <Ionicons name="logo-bitcoin" size={22} color={colors.text} />
          <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
        </View>
        <Text style={styles.balanceUsd}>≈ ${(balance / 100).toFixed(2)}</Text>
        <TouchableOpacity style={styles.topUpButton} onPress={handleTopUp} disabled={purchasing} activeOpacity={0.85}>
          <Text style={styles.topUpLabel}>{purchasing ? 'Processing…' : 'Top Up'}</Text>
        </TouchableOpacity>
      </LinearGradient>

      <Text style={styles.sectionLabel}>Transactions</Text>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.txRow}>
            <View style={styles.txIconWrap}>
              <Ionicons name={TRANSACTION_ICON[item.type]} size={18} color={colors.text} />
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txLabel}>{item.label}</Text>
              <Text style={styles.txDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text style={[styles.txAmount, item.amount < 0 ? styles.txAmountNegative : styles.txAmountPositive]}>
              {item.amount > 0 ? '+' : ''}
              {formatCompactNumber(item.amount)}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No transactions yet.</Text>}
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
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerAction: {
    padding: 4,
    width: 32,
  },
  headerSpacer: {
    width: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  balanceCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 20,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
  },
  balanceUsd: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 4,
  },
  topUpButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceLight,
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 24,
  },
  topUpLabel: {
    color: colors.textOnLight,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 20,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  txDate: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txAmountPositive: {
    color: colors.success,
  },
  txAmountNegative: {
    color: colors.danger,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 40,
  },
});
