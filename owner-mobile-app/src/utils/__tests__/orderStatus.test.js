import {
  canTransitionOrder,
  getOrderActions,
  getOrderStatusConflictMessage,
} from '../orderStatus';

describe('orderStatus helpers', () => {
  it('removes transition actions for cancelled and delivered orders', () => {
    expect(getOrderActions('Cancelled')).toEqual([]);
    expect(getOrderActions('Delivered')).toEqual([]);
  });

  it('allows out-for-delivery only from accepted orders', () => {
    expect(canTransitionOrder({ status: 'Accepted' }, 'Out for Delivery')).toBe(true);
    expect(canTransitionOrder({ status: 'Cancelled' }, 'Out for Delivery')).toBe(false);
  });

  it('returns a clean conflict message for cancelled orders', () => {
    expect(getOrderStatusConflictMessage({ status: 'Cancelled' })).toBe(
      'This order has already been cancelled.',
    );
  });
});
