import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppButton from '../components/AppButton';
import AppIcon from '../components/AppIcon';
import OrderCard from '../components/OrderCard';
import { fetchOrders, updateOrderStatus } from '../api/ownerApi';
import { useOrderAlert } from '../context/OrderAlertContext';
import { useSocket } from '../context/SocketContext';
import useResponsiveScreen from '../hooks/useResponsiveScreen';
import {
  getActiveTrackingOrderId,
  getLiveTrackingState,
  promptToOpenLocationSettings,
  startLiveTracking,
  stopLiveTracking,
  subscribeToLiveTracking,
} from '../services/liveTrackingService';
import { stopOrderAlert } from '../services/notificationService';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';
import { formatDateTime, getOrderIdentifier } from '../utils/formatters';

const TRACKABLE_STATUS = 'out for delivery';
const TERMINAL_STATUSES = new Set([
  'delivered',
  'rejected',
  'cancelled',
  'completed',
]);

const normalizeStatus = status =>
  String(status || '')
    .trim()
    .toLowerCase();

const isTrackableStatus = status =>
  normalizeStatus(status) === TRACKABLE_STATUS;

const isTerminalStatus = status =>
  TERMINAL_STATUSES.has(normalizeStatus(status));

export default function OrderDetailsScreen({ route }) {
  const initialOrder = route?.params?.order || null;
  const orderId = getOrderIdentifier(initialOrder);
  const { bottomPadding, horizontalPadding, maxContentWidth, topPadding } =
    useResponsiveScreen();
  const { lastOrderEvent } = useSocket();
  const { requestOrderAlertRefresh } = useOrderAlert();
  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');
  const [startingTracking, setStartingTracking] = useState(false);
  const [trackingState, setTrackingState] = useState(getLiveTrackingState());
  const lastHandledEvent = useRef(0);

  const refreshOrder = useCallback(
    async ({ showLoader = false, silent = false } = {}) => {
      if (!orderId) {
        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      try {
        const response = await fetchOrders({ limit: 100 });
        const matchedOrder = (response.orders || []).find(
          item => item._id === orderId,
        );

        if (matchedOrder) {
          setOrder(matchedOrder);
        }
      } catch (error) {
        if (!silent) {
          Alert.alert(
            'Order details',
            error?.message || 'Unable to load this order right now.',
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId],
  );

  useFocusEffect(
    useCallback(() => {
      void refreshOrder({ showLoader: !order, silent: true });
    }, [order, refreshOrder]),
  );

  useEffect(() => {
    const unsubscribe = subscribeToLiveTracking(setTrackingState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (
      !lastOrderEvent?.receivedAt ||
      lastOrderEvent.receivedAt === lastHandledEvent.current
    ) {
      return;
    }

    lastHandledEvent.current = lastOrderEvent.receivedAt;
    void refreshOrder({ silent: true });
  }, [lastOrderEvent, refreshOrder]);

  useEffect(() => {
    if (
      !order?._id ||
      trackingState.orderId !== order._id ||
      !trackingState.active
    ) {
      return;
    }

    if (!isTrackableStatus(order.status) || isTerminalStatus(order.status)) {
      void stopLiveTracking({
        reason:
          normalizeStatus(order.status) === 'delivered' ||
          normalizeStatus(order.status) === 'completed'
            ? 'completed'
            : 'manual',
        orderStatus: order.status,
      });
    }
  }, [order, trackingState.active, trackingState.orderId]);

  const handleStatusUpdate = useCallback(
    async nextStatus => {
      if (!order?._id) {
        return;
      }

      try {
        setPendingStatus(nextStatus);
        const updatedOrder = await updateOrderStatus(order._id, nextStatus);
        await stopOrderAlert(order._id);
        setOrder(current => ({ ...current, ...updatedOrder }));

        if (
          !isTrackableStatus(nextStatus) &&
          trackingState.orderId === order._id &&
          trackingState.active
        ) {
          await stopLiveTracking({
            reason:
              normalizeStatus(nextStatus) === 'delivered' ||
              normalizeStatus(nextStatus) === 'completed'
                ? 'completed'
                : 'manual',
            orderStatus: nextStatus,
          });
        }

        void requestOrderAlertRefresh({ broadcast: true });
        Alert.alert('Success', `Order moved to ${nextStatus}.`);
      } catch (error) {
        Alert.alert(
          'Update failed',
          error?.message || 'Unable to update order status',
        );
      } finally {
        setPendingStatus('');
      }
    },
    [
      order,
      requestOrderAlertRefresh,
      trackingState.active,
      trackingState.orderId,
    ],
  );

  const isTrackingThisOrder =
    trackingState.active && trackingState.orderId === order?._id;
  const hasTrackedThisOrder =
    trackingState.lastTrackedOrderId === order?._id ||
    trackingState.orderId === order?._id;
  const normalizedStatus = normalizeStatus(order?.status || order?.orderStatus);

  const trackingMeta = useMemo(() => {
    if (!hasTrackedThisOrder) {
      return {
        lastUpdatedLabel: '',
        warning: '',
      };
    }

    return {
      lastUpdatedLabel: trackingState.lastUpdatedAt
        ? formatDateTime(trackingState.lastUpdatedAt)
        : '',
      warning: trackingState.warning || '',
    };
  }, [hasTrackedThisOrder, trackingState.lastUpdatedAt, trackingState.warning]);

  const handleStartTracking = useCallback(async () => {
    if (!order?._id) {
      return;
    }

    const startTracking = async () => {
      try {
        setStartingTracking(true);
        await startLiveTracking(order._id);
      } catch (error) {
        if (error?.shouldOpenSettings) {
          Alert.alert(
            'Location permission',
            'Location permission is required to share live delivery location.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Open Settings',
                onPress: () => {
                  void promptToOpenLocationSettings();
                },
              },
            ],
          );
        } else {
          Alert.alert(
            'Location permission',
            error?.message ||
              'Location permission is required to share live delivery location.',
          );
        }
      } finally {
        setStartingTracking(false);
      }
    };

    if (
      trackingState.active &&
      getActiveTrackingOrderId() &&
      trackingState.orderId !== order._id
    ) {
      Alert.alert(
        'Switch live tracking?',
        'Live tracking is already active for another order. Starting this order will stop the current tracking session.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Start here',
            onPress: () => {
              void startTracking();
            },
          },
        ],
      );
      return;
    }

    await startTracking();
  }, [order, trackingState.active, trackingState.orderId]);

  const handleStopTracking = useCallback(() => {
    void stopLiveTracking({
      reason: 'manual',
      orderStatus: order?.status || order?.orderStatus,
    });
  }, [order]);

  if (loading && !order) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Order not found</Text>
        <Text style={styles.emptySubtitle}>
          This order could not be loaded right now.
        </Text>
      </View>
    );
  }

  const showDeliveredMessage =
    normalizedStatus === 'delivered' || normalizedStatus === 'completed';
  const showInactiveMessage =
    normalizedStatus === 'cancelled' || normalizedStatus === 'rejected';
  const showUnavailableMessage =
    !isTrackableStatus(normalizedStatus) && !showDeliveredMessage;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: topPadding,
        paddingHorizontal: horizontalPadding,
        paddingBottom: bottomPadding,
        maxWidth: maxContentWidth,
        alignSelf: 'center',
        width: '100%',
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void refreshOrder({ silent: true });
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Order Details</Text>
        <Text style={styles.subtitle}>
          Review the order and manage live delivery sharing.
        </Text>
      </View>

      <OrderCard
        order={order}
        pendingStatus={pendingStatus}
        onStatusPress={handleStatusUpdate}
      />

      <View style={styles.trackingCard}>
        <View style={styles.trackingHeader}>
          <View style={styles.trackingTitleWrap}>
            <Text style={styles.trackingTitle}>Live Delivery Tracking</Text>
            <Text style={styles.trackingSubtitle}>
              Share your live location with the customer for this order.
            </Text>
          </View>

          {isTrackingThisOrder ? (
            <View style={styles.activeBadge}>
              <AppIcon
                name="map-marker-outline"
                size={14}
                color={colors.info}
              />
              <Text style={styles.activeBadgeText}>Tracking Active</Text>
            </View>
          ) : null}
        </View>

        {showDeliveredMessage ? (
          <Text style={styles.infoText}>
            Delivery completed. Live tracking stopped.
          </Text>
        ) : null}

        {showUnavailableMessage ? (
          <Text style={styles.infoText}>
            {showInactiveMessage
              ? 'Live tracking stopped because this order is no longer active.'
              : 'Live tracking will be available after this order is out for delivery.'}
          </Text>
        ) : null}

        {isTrackableStatus(normalizedStatus) ? (
          <View style={styles.trackingBody}>
            {trackingMeta.lastUpdatedLabel ? (
              <Text style={styles.metaText}>
                Last updated: {trackingMeta.lastUpdatedLabel}
              </Text>
            ) : (
              <Text style={styles.metaText}>
                {isTrackingThisOrder
                  ? 'Waiting for GPS update...'
                  : 'Tracking has not started yet.'}
              </Text>
            )}

            {trackingMeta.warning ? (
              <Text style={styles.warningText}>{trackingMeta.warning}</Text>
            ) : null}

            {isTrackingThisOrder ? (
              <AppButton
                label="Stop Live Tracking"
                variant="danger"
                leftIcon="close-circle-outline"
                onPress={handleStopTracking}
              />
            ) : (
              <AppButton
                label={startingTracking ? 'Starting...' : 'Start Live Tracking'}
                variant="primary"
                leftIcon="map-marker-outline"
                onPress={handleStartTracking}
                loading={startingTracking}
                disabled={startingTracking}
              />
            )}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: typography.body,
    textAlign: 'center',
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
  },
  trackingCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
    ...shadow,
  },
  trackingHeader: {
    gap: spacing.md,
  },
  trackingTitleWrap: {
    gap: spacing.xs,
  },
  trackingTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '800',
  },
  trackingSubtitle: {
    color: colors.textSoft,
    fontSize: typography.small,
    lineHeight: 19,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#c5ddec',
    backgroundColor: colors.infoSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  activeBadgeText: {
    color: colors.info,
    fontSize: typography.tiny,
    fontWeight: '700',
  },
  trackingBody: {
    gap: spacing.md,
  },
  metaText: {
    color: colors.textSoft,
    fontSize: typography.small,
  },
  infoText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 20,
  },
  warningText: {
    color: colors.warning,
    fontSize: typography.small,
    fontWeight: '600',
  },
});
