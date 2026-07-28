describe('NotificationBootstrap', () => {
  const flushMicrotasks = async act => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('registers notification listeners once and does not navigate on order sync completion', async () => {
    const authState = {
      isAuthenticated: true,
      token: 'owner-token',
    };
    const requestOrderAlertRefreshFirst = jest.fn().mockResolvedValue([]);
    const requestOrderAlertRefreshSecond = jest.fn().mockResolvedValue([]);
    const handleForegroundOrderEvent = jest.fn().mockResolvedValue(undefined);
    const orderAlertState = {
      handleForegroundOrderEvent,
      requestOrderAlertRefresh: requestOrderAlertRefreshFirst,
    };
    const consumePendingOrderDetailsNavigation = jest.fn().mockResolvedValue(undefined);
    const consumePendingOrdersNavigation = jest.fn().mockResolvedValue(undefined);
    const registerOwnerFcmToken = jest.fn().mockResolvedValue(undefined);
    const requestNotificationPermission = jest.fn().mockResolvedValue({ granted: true });
    const stopOrderAlert = jest.fn().mockResolvedValue(undefined);
    const setupForegroundMessageHandler = jest.fn(({ onOrderSyncRequested }) => {
      syncOrders = onOrderSyncRequested;
      return unsubscribeForeground;
    });
    const unsubscribeForeground = jest.fn();
    const unsubscribeTokenRefresh = jest.fn();
    const onTokenRefresh = jest.fn(() => unsubscribeTokenRefresh);
    const messaging = jest.fn(() => ({
      onTokenRefresh,
    }));
    let syncOrders = null;
    let React;
    let renderer;
    let act;
    let NotificationBootstrap;
    let tree;

    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({
        Alert: {
          alert: jest.fn(),
        },
      }));

      jest.doMock('@react-native-firebase/messaging', () => messaging);

      jest.doMock('../../context/AuthContext', () => ({
        useAuth: () => authState,
      }));

      jest.doMock('../../context/OrderAlertContext', () => ({
        useOrderAlert: () => orderAlertState,
      }));

      jest.doMock('../../services/notificationService', () => ({
        consumePendingOrderDetailsNavigation,
        consumePendingOrdersNavigation,
        registerOwnerFcmToken,
        requestNotificationPermission,
        setupForegroundMessageHandler,
        stopOrderAlert,
      }));

      React = require('react');
      renderer = require('react-test-renderer');
      act = renderer.act;
      NotificationBootstrap = require('../NotificationBootstrap').default;
    });

    await act(async () => {
      tree = renderer.create(React.createElement(NotificationBootstrap));
    });
    await flushMicrotasks(act);

    expect(requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(registerOwnerFcmToken).toHaveBeenCalledWith('owner-token');
    expect(consumePendingOrderDetailsNavigation).toHaveBeenCalledTimes(1);
    expect(consumePendingOrdersNavigation).toHaveBeenCalledTimes(1);
    expect(setupForegroundMessageHandler).toHaveBeenCalledTimes(1);

    orderAlertState.requestOrderAlertRefresh = requestOrderAlertRefreshSecond;

    await act(async () => {
      tree.update(React.createElement(NotificationBootstrap));
    });
    await flushMicrotasks(act);

    expect(setupForegroundMessageHandler).toHaveBeenCalledTimes(1);

    await act(async () => {
      await syncOrders();
    });

    expect(requestOrderAlertRefreshFirst).not.toHaveBeenCalled();
    expect(requestOrderAlertRefreshSecond).toHaveBeenCalledWith({
      broadcast: true,
      sync: true,
    });
    expect(consumePendingOrdersNavigation).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree.unmount();
    });

    expect(unsubscribeForeground).toHaveBeenCalledTimes(1);
    expect(unsubscribeTokenRefresh).toHaveBeenCalledTimes(1);
  });
});
