jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    patch: jest.fn(),
  },
}));

import apiClient from '../apiClient';
import { updateOrderStatus } from '../ownerApi';

describe('ownerApi.updateOrderStatus', () => {
  it('normalizes 409 conflicts to a friendly message with the latest order', async () => {
    apiClient.patch.mockRejectedValueOnce({
      status: 409,
      data: {
        order: {
          _id: 'order-1',
          orderStatus: 'Cancelled',
          customerName: 'Customer',
        },
      },
      response: {
        status: 409,
      },
    });

    await expect(
      updateOrderStatus('order-1', 'Out for Delivery'),
    ).rejects.toMatchObject({
      status: 409,
      code: 'ORDER_STATUS_CONFLICT',
      message: 'This order has already been cancelled.',
      order: expect.objectContaining({
        _id: 'order-1',
        status: 'Cancelled',
      }),
    });
  });
});
