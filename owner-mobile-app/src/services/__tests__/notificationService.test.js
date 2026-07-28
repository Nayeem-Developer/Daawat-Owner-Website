describe('notificationService cancellation handling', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('shows one high-importance background cancellation notification with sound and dedupes duplicates', async () => {
    const displayNotification = jest.fn().mockResolvedValue(undefined);
    const createChannel = jest.fn().mockResolvedValue('owner_order_alerts');
    const notifeeModule = {
      __esModule: true,
      default: {
        createChannel,
        displayNotification,
      },
      AndroidCategory: {
        STATUS: 'status',
      },
      AndroidColor: {
        RED: 'red',
      },
      AndroidImportance: {
        HIGH: 'high',
      },
      AndroidVisibility: {
        PUBLIC: 'public',
      },
      AuthorizationStatus: {
        DENIED: 0,
        AUTHORIZED: 1,
        PROVISIONAL: 2,
      },
      EventType: {},
    };
    const asyncStorage = {
      getItem: jest.fn().mockImplementation(async key => {
        if (key === 'ownerToken') {
          return 'owner-session-token';
        }

        if (key === 'ownerProcessedOrderEvents') {
          return null;
        }

        return null;
      }),
      setItem: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn().mockResolvedValue(undefined),
    };

    let setupBackgroundMessageHandler;
    let resetProcessedOwnerEventsForTests;

    jest.isolateModules(() => {
      jest.doMock('@react-native-async-storage/async-storage', () => asyncStorage);
      jest.doMock('@notifee/react-native', () => notifeeModule);
      jest.doMock('@react-native-firebase/messaging', () => jest.fn(() => ({})));
      jest.doMock('axios', () => ({
        __esModule: true,
        default: {
          post: jest.fn(),
          delete: jest.fn(),
          patch: jest.fn(),
        },
      }));
      jest.doMock('react-native', () => ({
        Platform: {
          OS: 'android',
          Version: 34,
        },
      }));
      jest.doMock('../../navigation/navigationService', () => ({
        navigateToOrderDetails: jest.fn(),
        navigateToOrders: jest.fn(),
      }));
      jest.doMock('../orderAlertSound', () => ({
        stopOrderAlertSound: jest.fn(),
      }));

      ({ setupBackgroundMessageHandler } = require('../notificationService'));
      ({ resetProcessedOwnerEventsForTests } = require('../../utils/ownerOrderEvents'));
    });

    resetProcessedOwnerEventsForTests();

    const remoteMessage = {
      messageId: 'msg-1',
      data: {
        type: 'order_cancelled',
        eventId: 'evt-cancel-42',
        orderId: 'order-42',
        displayOrderId: '1042',
        status: 'Cancelled',
        updatedAt: '2026-07-09T10:05:00.000Z',
        customerName: 'Alex',
      },
    };

    await setupBackgroundMessageHandler(remoteMessage);
    await setupBackgroundMessageHandler(remoteMessage);

    expect(createChannel).toHaveBeenCalledTimes(1);
    expect(createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'owner_order_alerts',
        importance: 'high',
        sound: 'default',
        vibration: true,
        badge: true,
      }),
    );
    expect(displayNotification).toHaveBeenCalledTimes(1);
    expect(displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Order Cancelled',
        data: expect.objectContaining({
          type: 'order_cancelled',
          eventId: 'evt-cancel-42',
        }),
        android: expect.objectContaining({
          channelId: 'owner_order_alerts',
          importance: 'high',
          sound: 'default',
        }),
      }),
    );
  });
});
