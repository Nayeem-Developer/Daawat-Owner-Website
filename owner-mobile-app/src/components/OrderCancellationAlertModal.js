import { useEffect } from 'react';
import {
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppButton from './AppButton';
import AppIcon from './AppIcon';
import {
  colors,
  radius,
  shadowStrong,
  spacing,
  typography,
} from '../theme/theme';
import { formatDateTime } from '../utils/formatters';
import { getShortOrderNumber } from '../utils/ownerOrderEvents';

export default function OrderCancellationAlertModal({
  visible,
  order,
  onAcknowledge,
  onViewOrder,
}) {
  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onAcknowledge?.();
      return true;
    });

    return () => subscription.remove();
  }, [onAcknowledge, visible]);

  if (!visible || !order) {
    return null;
  }

  const displayOrderId = getShortOrderNumber(order);
  const cancellationReason = String(order?.cancellationReason || '').trim();
  const cancellationTime = order?.updatedAt || order?.createdAt;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent
      onRequestClose={onAcknowledge}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.overlay}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <View style={styles.topAccent} />

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.iconWrap}>
                <View style={styles.iconCircle}>
                  <AppIcon
                    name="close-circle-outline"
                    size={28}
                    color={colors.danger}
                  />
                </View>
              </View>

              <View style={styles.headerBlock}>
                <Text style={styles.title}>Order Cancelled</Text>
                <Text
                  style={styles.stopWarning}
                  accessibilityLabel="Stop preparing this order"
                >
                  STOP PREPARING THIS ORDER
                </Text>
                <View style={styles.orderMetaRow}>
                  <Text style={styles.orderNumber}>{`Order #${displayOrderId}`}</Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>Cancelled</Text>
                  </View>
                </View>
              </View>

              <View style={styles.messageCard}>
                <Text style={styles.messageLead}>
                  Customer cancelled this order.
                </Text>
                <Text style={styles.messageBody}>
                  The customer has cancelled this order. Please stop preparing or
                  dispatching it.
                </Text>

                {cancellationReason ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Reason</Text>
                    <Text style={styles.infoValue}>{cancellationReason}</Text>
                  </View>
                ) : null}

                {cancellationTime ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Cancelled At</Text>
                    <Text style={styles.infoValue}>
                      {formatDateTime(cancellationTime)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <View style={styles.actions}>
              {onViewOrder ? (
                <AppButton
                  label="View Order"
                  variant="ghost"
                  size="md"
                  leftIcon="clipboard-text-outline"
                  onPress={onViewOrder}
                  fullWidth={false}
                  style={styles.secondaryButton}
                  accessibilityLabel="View cancelled order details"
                />
              ) : null}
              <AppButton
                label="Acknowledge"
                variant="danger"
                size="md"
                onPress={onAcknowledge}
                fullWidth={false}
                style={styles.primaryButton}
                accessibilityLabel="Acknowledge cancelled order alert"
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(20, 12, 14, 0.72)',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: 'rgba(20, 12, 14, 0.72)',
  },
  modalCard: {
    maxHeight: '92%',
    borderRadius: 22,
    backgroundColor: '#fbf9f8',
    overflow: 'hidden',
    ...shadowStrong,
  },
  topAccent: {
    height: 6,
    backgroundColor: '#8d2330',
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  iconWrap: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdeceb',
  },
  headerBlock: {
    gap: spacing.sm,
  },
  title: {
    color: '#7f1d28',
    fontSize: typography.title,
    fontWeight: '800',
    textAlign: 'center',
  },
  stopWarning: {
    color: '#8d2330',
    fontSize: typography.cardTitle,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  orderMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  orderNumber: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '800',
  },
  statusPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#e7b2b6',
    backgroundColor: '#fdecee',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusPillText: {
    color: '#8d2330',
    fontSize: typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  messageCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#edd8da',
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    gap: spacing.md,
  },
  messageLead: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  messageBody: {
    color: colors.textSoft,
    fontSize: typography.body,
    lineHeight: 23,
    fontWeight: '600',
  },
  infoRow: {
    gap: spacing.xs,
  },
  infoLabel: {
    color: '#8d2330',
    fontSize: typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: 21,
    fontWeight: '600',
  },
  actions: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    backgroundColor: '#fbf9f8',
  },
  primaryButton: {
    minHeight: 48,
  },
  secondaryButton: {
    minHeight: 48,
  },
});
