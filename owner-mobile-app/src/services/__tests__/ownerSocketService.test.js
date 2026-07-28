import {
  getOwnerRoomJoinPayload,
  OWNER_SOCKET_JOIN_EVENT,
  OWNER_SOCKET_ROOM,
  joinOwnerOrderRooms,
  ORDER_SOCKET_EVENT_NAMES,
  registerOwnerSocketListeners,
} from '../ownerSocketService';

describe('ownerSocketService', () => {
  it('registers order listeners once and cleans them up with the same handlers', () => {
    const on = jest.fn();
    const off = jest.fn();
    const socket = { on, off };

    const cleanup = registerOwnerSocketListeners(socket, {
      onConnect: jest.fn(),
      onDisconnect: jest.fn(),
      onConnectError: jest.fn(),
      onOrderEvent: jest.fn(),
      onAppStatusEvent: jest.fn(),
    });

    expect(on).toHaveBeenCalledTimes(ORDER_SOCKET_EVENT_NAMES.length + 4);

    cleanup();

    expect(off).toHaveBeenCalledTimes(ORDER_SOCKET_EVENT_NAMES.length + 4);
  });

  it('listens explicitly for order_status_updated', () => {
    expect(ORDER_SOCKET_EVENT_NAMES).toContain('order_status_updated');
    expect(ORDER_SOCKET_EVENT_NAMES[0]).toBe('order_status_updated');
  });

  it('joins the authenticated owner room with auth:join', () => {
    const emit = jest.fn();
    const socket = { emit };

    expect(getOwnerRoomJoinPayload()).toEqual({
      room: OWNER_SOCKET_ROOM,
    });

    joinOwnerOrderRooms(socket);

    expect(emit).toHaveBeenCalledWith(
      OWNER_SOCKET_JOIN_EVENT,
      {
        room: OWNER_SOCKET_ROOM,
      },
    );
  });
});
