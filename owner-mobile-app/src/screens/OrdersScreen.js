import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import OrderCard from '../components/OrderCard';
import { useOwnerOrders } from '../context/OwnerOrdersContext';
import useResponsiveScreen from '../hooks/useResponsiveScreen';
import {
  getActiveTrackingOrderId,
  getLiveTrackingState,
  stopLiveTracking,
} from '../services/liveTrackingService';
import { stopOrderAlert } from '../services/notificationService';
import { colors, spacing, typography } from '../theme/theme';
import {
  matchesOrderFilter,
  normalizeOrderStatus,
  ORDER_FILTERS,
} from '../utils/orderStatus';

const shouldAutoStopTracking = status =>
  normalizeOrderStatus(status) !== 'out for delivery';

export default function OrdersScreen() {
  const navigation = useNavigation();
  const { bottomPadding, horizontalPadding, maxContentWidth, topPadding } =
    useResponsiveScreen();
  const {
    orders,
    isLoading,
    isRefreshing,
    error,
    pendingActions,
    refreshOrders,
    refreshOrdersIfStale,
    updateOrderStatus,
  } = useOwnerOrders();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const loadOrders = useCallback(async () => {
    try {
      await refreshOrders({
        silent: false,
        force: true,
        reason: 'orders_manual_refresh',
      });
    } catch (loadError) {
      Alert.alert('Orders', loadError?.message || 'Failed to load orders');
    } finally {
      setRefreshing(false);
    }
  }, [refreshOrders]);

  useFocusEffect(
    useCallback(() => {
      void refreshOrdersIfStale({ reason: 'orders_focus' });
      return undefined;
    }, [refreshOrdersIfStale]),
  );

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter(order => {
      const searchable = [
        order?.customerName,
        order?.phone,
        order?.orderId,
        order?.addressText,
        order?.status,
        ...(Array.isArray(order?.items)
          ? order.items.map(item => item?.name || item?.itemName)
          : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesOrderFilter(order, activeFilter) && searchable.includes(term);
    });
  }, [activeFilter, orders, search]);

  const filterCounts = useMemo(
    () =>
      ORDER_FILTERS.reduce((counts, filter) => {
        counts[filter] = orders.filter(order => matchesOrderFilter(order, filter)).length;
        return counts;
      }, {}),
    [orders],
  );

  const handleStatusUpdate = useCallback(
    async (orderId, nextStatus) => {
      try {
        await updateOrderStatus(orderId, nextStatus);
        await stopOrderAlert(orderId);
        const trackingState = getLiveTrackingState();

        if (
          shouldAutoStopTracking(nextStatus) &&
          trackingState.orderId === orderId
        ) {
          void stopLiveTracking({
            reason:
              normalizeOrderStatus(nextStatus) === 'delivered' ||
              normalizeOrderStatus(nextStatus) === 'completed'
                ? 'completed'
                : 'manual',
            orderStatus: nextStatus,
          });
        }

        Alert.alert('Success', `Order moved to ${nextStatus}.`);
      } catch (updateError) {
        Alert.alert(
          'Update failed',
          updateError?.message || 'Unable to update order status.',
        );
      }
    },
    [updateOrderStatus],
  );

  useEffect(() => {
    const trackingState = getLiveTrackingState();

    if (!trackingState.active || !getActiveTrackingOrderId()) {
      return;
    }

    const trackedOrder = orders.find(item => item._id === trackingState.orderId);

    if (
      trackedOrder &&
      shouldAutoStopTracking(trackedOrder.status || trackedOrder.orderStatus)
    ) {
      void stopLiveTracking({
        reason:
          normalizeOrderStatus(trackedOrder.status || trackedOrder.orderStatus) ===
            'delivered' ||
          normalizeOrderStatus(trackedOrder.status || trackedOrder.orderStatus) ===
            'completed'
            ? 'completed'
            : 'manual',
        orderStatus: trackedOrder.status || trackedOrder.orderStatus,
      });
    }
  }, [orders]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredOrders}
        keyExtractor={item => item._id || item.orderId}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            pendingStatus={pendingActions[item._id] || ''}
            onStatusPress={nextStatus =>
              handleStatusUpdate(item._id, nextStatus)
            }
            onViewDetails={() =>
              navigation.navigate('Order Details', {
                orderId: item._id,
                order: item,
              })
            }
          />
        )}
        ListHeaderComponent={
          <View
            style={[
              styles.header,
              {
                paddingTop: topPadding,
                maxWidth: maxContentWidth,
                alignSelf: 'center',
                width: '100%',
              },
            ]}
          >
            <Text style={styles.title}>Orders</Text>
            <Text style={styles.subtitle}>
              Track every order and update statuses quickly.
            </Text>
            <AppInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search customer, phone, order ID, address, item..."
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {ORDER_FILTERS.map(filter => (
                <AppButton
                  key={filter}
                  label={`${filter} (${filterCounts[filter] || 0})`}
                  variant={activeFilter === filter ? 'primary' : 'chip'}
                  size="sm"
                  onPress={() => setActiveFilter(filter)}
                  fullWidth={false}
                />
              ))}
            </ScrollView>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.resultText}>
              {filteredOrders.length} orders
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No orders found.</Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isRefreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadOrders();
            }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: bottomPadding,
            maxWidth: maxContentWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
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
  filterRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '600',
  },
  resultText: {
    color: colors.textSoft,
    fontSize: typography.small,
    fontWeight: '600',
  },
  listContent: {
    gap: spacing.md,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
    textAlign: 'center',
    marginTop: spacing.xxxl,
  },
});
