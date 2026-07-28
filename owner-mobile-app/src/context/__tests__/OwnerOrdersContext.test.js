describe('OwnerOrdersProvider', () => {
  const flushMicrotasks = async (act, steps = 10) => {
    for (let index = 0; index < steps; index += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };

  const createHarness = async ({
    appStateCurrentState,
    initialSocketState = {},
    isAuthenticated = true,
    ordersResponse = [{ _id: 'order-1', orderId: '1001', status: 'Accepted' }],
  } = {}) => {
    jest.resetModules();

    const authState = { isAuthenticated };
    const socketState = {
      connectionSerial: 0,
      isConnected: true,
      lastOrderEvent: null,
      ...initialSocketState,
    };
    const fetchOrders = jest.fn().mockResolvedValue({ orders: ordersResponse });
    const updateOrderStatus = jest.fn();
    const appState = {
      currentState: appStateCurrentState,
      addEventListener: jest.fn(),
    };
    let appStateChangeHandler = null;
    let React;
    let renderer;
    let act;
    let OwnerOrdersProvider;
    let useOwnerOrders;
    let tree;
    let latestContext = null;
    let now = 1000;

    jest.spyOn(Date, 'now').mockImplementation(() => now);

    appState.addEventListener.mockImplementation((eventName, handler) => {
      if (eventName === 'change') {
        appStateChangeHandler = handler;
      }

      return {
        remove: jest.fn(),
      };
    });

    jest.isolateModules(() => {
      jest.doMock('@react-native-async-storage/async-storage', () => ({
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined),
      }));

      jest.doMock('react-native', () => ({
        AppState: appState,
      }));

      jest.doMock('../AuthContext', () => ({
        useAuth: () => authState,
      }));

      jest.doMock('../SocketContext', () => ({
        useSocket: () => socketState,
      }));

      jest.doMock('../../api/ownerApi', () => ({
        fetchOrders,
        updateOrderStatus,
      }));

      React = require('react');
      renderer = require('react-test-renderer');
      act = renderer.act;
      ({ OwnerOrdersProvider, useOwnerOrders } = require('../OwnerOrdersContext'));
    });

    const Consumer = () => {
      latestContext = useOwnerOrders();
      return null;
    };

    await act(async () => {
      tree = renderer.create(
        React.createElement(
          OwnerOrdersProvider,
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
            OwnerOrdersProvider,
            null,
            React.createElement(Consumer),
          ),
        );
      });

      await flushMicrotasks(act);
    };

    const emitAppState = async nextState => {
      if (!appStateChangeHandler) {
        return;
      }

      await act(async () => {
        appStateChangeHandler(nextState);
      });

      await flushMicrotasks(act);
    };

    return {
      appState,
      authState,
      emitAppState,
      fetchOrders,
      getContext: () => latestContext,
      rerender,
      setNow: value => {
        now = value;
      },
      socketState,
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

  it('renders without crashing when AppState.currentState is unavailable', async () => {
    const harness = await createHarness({
      appStateCurrentState: undefined,
      isAuthenticated: false,
    });

    expect(harness.appState.addEventListener).not.toHaveBeenCalled();
    await harness.teardown();
  });

  it('keeps refreshOrdersIfStale stable when socket updates arrive', async () => {
    const harness = await createHarness();
    const initialRefreshOrdersIfStale = harness.getContext().refreshOrdersIfStale;

    expect(harness.fetchOrders).toHaveBeenCalledTimes(1);

    harness.socketState.lastOrderEvent = {
      eventName: 'order_status_updated',
      payload: {
        order: {
          _id: 'order-1',
          orderId: '1001',
          status: 'Cancelled',
        },
      },
      receivedAt: 4000,
    };

    await harness.rerender();

    expect(harness.fetchOrders).toHaveBeenCalledTimes(1);
    expect(harness.getContext().refreshOrdersIfStale).toBe(initialRefreshOrdersIfStale);

    await harness.teardown();
  });

  it('does not refresh on active-to-active transitions and refreshes once on background resume', async () => {
    const harness = await createHarness();

    expect(harness.fetchOrders).toHaveBeenCalledTimes(1);

    await harness.emitAppState('active');
    expect(harness.fetchOrders).toHaveBeenCalledTimes(1);

    await harness.emitAppState('background');
    harness.setNow(7000);
    await harness.emitAppState('active');

    expect(harness.fetchOrders).toHaveBeenCalledTimes(2);

    await harness.teardown();
  });

  it('refreshes once per reconnect serial', async () => {
    const harness = await createHarness();

    expect(harness.fetchOrders).toHaveBeenCalledTimes(1);

    harness.setNow(9000);
    harness.socketState.connectionSerial = 1;
    await harness.rerender();

    expect(harness.fetchOrders).toHaveBeenCalledTimes(2);

    harness.setNow(9500);
    await harness.rerender();

    expect(harness.fetchOrders).toHaveBeenCalledTimes(2);

    await harness.teardown();
  });
});
