describe('OrderAlertContext', () => {
  const flushMicrotasks = async act => {
    for (let index = 0; index < 6; index += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };

  const createHarness = async ({
    initialOrders = [],
    initialSocketEvent = null,
  } = {}) => {
    jest.resetModules();

    const authState = {
      isAuthenticated: true,
    };
    const ownerOrdersState = {
      applyIncomingOrderUpdate: jest.fn(),
      orders: initialOrders,
      pendingActions: {},
      refreshOrders: jest.fn().mockResolvedValue(initialOrders),
      updateOrderStatus: jest.fn().mockResolvedValue(undefined),
    };
    const socketState = {
      lastOrderEvent: initialSocketEvent,
    };
    const startOrderAlertSound = jest.fn().mockResolvedValue(undefined);
    const stopOrderAlertSound = jest.fn();
    const displayNewOrderNotification = jest.fn().mockResolvedValue(undefined);
    const stopOrderAlert = jest.fn().mockResolvedValue(undefined);
    const navigateToOrderDetails = jest.fn();
    const newOrderModalProps = [];
    const cancellationModalProps = [];
    const asyncStorage = {
      getItem: jest.fn().mockImplementation(async key => {
        if (key === 'ownerProcessedOrderEvents') {
          return null;
        }

        return null;
      }),
      setItem: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn().mockResolvedValue(undefined),
    };
    let React;
    let renderer;
    let act;
    let OrderAlertProvider;
    let useOrderAlert;
    let resetProcessedOwnerEventsForTests;
    let tree;
    let latestContext = null;

    jest.isolateModules(() => {
      jest.doMock('@react-native-async-storage/async-storage', () => asyncStorage);

      jest.doMock('../AuthContext', () => ({
        useAuth: () => authState,
      }));

      jest.doMock('../SocketContext', () => ({
        useSocket: () => socketState,
      }));

      jest.doMock('../OwnerOrdersContext', () => ({
        useOwnerOrders: () => ownerOrdersState,
      }));

      jest.doMock('../../services/orderAlertSound', () => ({
        startOrderAlertSound,
        stopOrderAlertSound,
      }));

      jest.doMock('../../services/notificationService', () => ({
        displayNewOrderNotification,
        stopOrderAlert,
      }));

      jest.doMock('../../navigation/navigationService', () => ({
        navigateToOrderDetails,
      }));

      jest.doMock('../../components/NewOrderAlertModal', () => props => {
        newOrderModalProps.push(props);
        return null;
      });

      jest.doMock('../../components/OrderCancellationAlertModal', () => props => {
        cancellationModalProps.push(props);
        return null;
      });

      React = require('react');
      renderer = require('react-test-renderer');
      act = renderer.act;
      ({ OrderAlertProvider, useOrderAlert } = require('../OrderAlertContext'));
      ({ resetProcessedOwnerEventsForTests } = require('../../utils/ownerOrderEvents'));
    });

    resetProcessedOwnerEventsForTests();

    const Consumer = () => {
      latestContext = useOrderAlert();
      return null;
    };

    await act(async () => {
      tree = renderer.create(
        React.createElement(
          OrderAlertProvider,
          null,
          React.createElement(Consumer),
        ),
      );
    });
    await flushMicrotasks(act);

    const rerender = async () => {
      await act(async () => {
        tree.update(
          React.createElement(
            OrderAlertProvider,
            null,
            React.createElement(Consumer),
          ),
        );
      });
      await flushMicrotasks(act);
    };

    return {
      act,
      cancellationModalProps,
      displayNewOrderNotification,
      getContext: () => latestContext,
      navigateToOrderDetails,
      newOrderModalProps,
      ownerOrdersState,
      rerender,
      socketState,
      startOrderAlertSound,
      stopOrderAlertSound,
      stopOrderAlert,
      teardown: async () => {
        await act(async () => {
          tree.unmount();
        });
      },
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a cancellation popup and sound once for a foreground socket cancellation', async () => {
    const harness = await createHarness({
      initialOrders: [{ _id: 'order-1', orderId: '1001', status: 'Accepted' }],
    });

    harness.socketState.lastOrderEvent = {
      eventName: 'order_status_updated',
      payload: {
        type: 'order_cancelled',
        eventId: 'evt-cancel-1',
        order: {
          _id: 'order-1',
          orderId: '1001',
          status: 'Cancelled',
          updatedAt: '2026-07-09T10:05:00.000Z',
        },
      },
      receivedAt: 1,
    };

    await harness.rerender();

    const latestCancellationModal = harness.cancellationModalProps.at(-1);
    expect(latestCancellationModal.visible).toBe(true);
    expect(latestCancellationModal.order.status).toBe('Cancelled');
    expect(harness.startOrderAlertSound).toHaveBeenCalledTimes(1);
    expect(harness.ownerOrdersState.applyIncomingOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'order-1', status: 'Cancelled' }),
      expect.objectContaining({ reason: 'foreground_cancellation_alert' }),
    );
    expect(harness.navigateToOrderDetails).not.toHaveBeenCalled();

    await harness.act(async () => {
      await harness.getContext().handleForegroundOrderEvent({
        type: 'order_cancelled',
        eventId: 'evt-cancel-1',
        order: {
          _id: 'order-1',
          orderId: '1001',
          status: 'Cancelled',
          updatedAt: '2026-07-09T10:05:00.000Z',
        },
      });
    });
    expect(harness.startOrderAlertSound).toHaveBeenCalledTimes(1);

    await harness.teardown();
  });

  it('acknowledges or views a cancelled order only after user action and stops sound safely', async () => {
    const harness = await createHarness({
      initialOrders: [{ _id: 'mongo-1', orderId: '1001', status: 'Accepted' }],
    });

    harness.socketState.lastOrderEvent = {
      eventName: 'order_status_updated',
      payload: {
        type: 'order_cancelled',
        eventId: 'evt-cancel-2',
        order: {
          _id: 'mongo-1',
          orderId: '1001',
          status: 'Cancelled',
          updatedAt: '2026-07-09T10:06:00.000Z',
        },
      },
      receivedAt: 2,
    };

    await harness.rerender();

    const firstModalProps = harness.cancellationModalProps.at(-1);
    expect(firstModalProps.visible).toBe(true);

    await harness.act(async () => {
      firstModalProps.onAcknowledge();
    });
    await harness.rerender();

    expect(harness.stopOrderAlertSound).toHaveBeenCalled();
    expect(harness.cancellationModalProps.at(-1).visible).toBe(false);
    expect(harness.navigateToOrderDetails).not.toHaveBeenCalled();

    await harness.act(async () => {
      await harness.getContext().handleForegroundOrderEvent({
        type: 'order_cancelled',
        eventId: 'evt-cancel-3',
        order: {
          _id: 'mongo-2',
          orderId: '1002',
          status: 'Cancelled',
          updatedAt: '2026-07-09T10:07:00.000Z',
        },
      });
    });
    await harness.rerender();

    const secondModalProps = harness.cancellationModalProps.at(-1);
    await harness.act(async () => {
      secondModalProps.onViewOrder();
    });
    await harness.rerender();

    expect(harness.stopOrderAlertSound).toHaveBeenCalled();
    expect(harness.navigateToOrderDetails).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'mongo-2' }),
    );

    await harness.teardown();
  });

  it('keeps new-order alerts working unchanged', async () => {
    const pendingOrder = {
      _id: 'order-2',
      orderId: '1002',
      status: 'Placed',
      createdAt: '2026-07-09T10:00:00.000Z',
    };
    const harness = await createHarness({
      initialOrders: [pendingOrder],
    });

    const latestNewOrderModal = harness.newOrderModalProps.at(-1);
    expect(latestNewOrderModal.visible).toBe(true);
    expect(latestNewOrderModal.order._id).toBe('order-2');
    expect(harness.displayNewOrderNotification).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'order-2' }),
    );
    expect(harness.startOrderAlertSound).toHaveBeenCalledTimes(1);

    await harness.teardown();
  });
});
