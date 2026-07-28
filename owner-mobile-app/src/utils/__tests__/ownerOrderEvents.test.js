describe('ownerOrderEvents', () => {
  let normalizeOwnerOrderEvent;
  let resolveCanonicalMongoOrderId;

  beforeEach(() => {
    jest.resetModules();

    jest.isolateModules(() => {
      jest.doMock('@react-native-async-storage/async-storage', () => ({
        __esModule: true,
        default: {
          getItem: jest.fn(),
          setItem: jest.fn(),
          removeItem: jest.fn(),
        },
      }));

      ({
        normalizeOwnerOrderEvent,
        resolveCanonicalMongoOrderId,
      } = require('../ownerOrderEvents'));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves canonical Mongo order id before any display order id fields', () => {
    const payload = {
      eventId: 'evt-1',
      type: 'order_cancelled',
      _id: 'mongo-123',
      orderId: '1042',
      status: 'Cancelled',
      updatedAt: '2026-07-09T10:05:00.000Z',
    };

    expect(resolveCanonicalMongoOrderId(payload)).toBe('mongo-123');

    const normalizedEvent = normalizeOwnerOrderEvent(payload);

    expect(normalizedEvent.canonicalMongoOrderId).toBe('mongo-123');
    expect(normalizedEvent.order._id).toBe('mongo-123');
    expect(normalizedEvent.order.orderId).toBe('1042');
    expect(normalizedEvent.dedupeKey).toBe('evt-1');
  });

  it('falls back to canonicalMongoId + status + updatedAt when eventId is missing', () => {
    const payload = {
      type: 'order_cancelled',
      id: 'mongo-555',
      orderId: '2055',
      status: 'Cancelled',
      updatedAt: '2026-07-09T10:06:00.000Z',
    };

    const normalizedEvent = normalizeOwnerOrderEvent(payload);

    expect(normalizedEvent.canonicalMongoOrderId).toBe('mongo-555');
    expect(normalizedEvent.dedupeKey).toBe(
      'mongo-555:Cancelled:2026-07-09T10:06:00.000Z',
    );
  });
});
