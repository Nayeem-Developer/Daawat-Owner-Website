describe('OrderCancellationAlertModal', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('renders the premium cancellation copy and invokes actions only on user tap', () => {
    let React;
    let renderer;
    let OrderCancellationAlertModal;

    jest.isolateModules(() => {
      jest.doMock('@react-native-async-storage/async-storage', () => ({
        __esModule: true,
        default: {},
      }));

      jest.doMock('react-native', () => {
        const React = require('react');

        return {
          BackHandler: {
            addEventListener: jest.fn(() => ({
              remove: jest.fn(),
            })),
          },
          Modal: ({ children, visible }) =>
            visible ? React.createElement('Modal', null, children) : null,
          ScrollView: ({ children }) => React.createElement('ScrollView', null, children),
          StyleSheet: {
            create: value => value,
          },
          Text: ({ children }) => React.createElement('Text', null, children),
          View: ({ children }) => React.createElement('View', null, children),
        };
      });

      jest.doMock('react-native-safe-area-context', () => ({
        SafeAreaView: ({ children }) => children,
      }));

      jest.doMock('../AppButton', () => props =>
        require('react').createElement('AppButton', props),
      );

      jest.doMock('../AppIcon', () => props =>
        require('react').createElement('AppIcon', props),
      );

      React = require('react');
      renderer = require('react-test-renderer');
      OrderCancellationAlertModal = require('../OrderCancellationAlertModal').default;
    });

    const onAcknowledge = jest.fn();
    const onViewOrder = jest.fn();
    let tree;

    renderer.act(() => {
      tree = renderer.create(
        React.createElement(OrderCancellationAlertModal, {
          visible: true,
          order: {
            _id: 'mongo-1',
            orderId: '1042',
            status: 'Cancelled',
            cancellationReason: 'Customer changed plans.',
            updatedAt: '2026-07-09T10:05:00.000Z',
          },
          onAcknowledge,
          onViewOrder,
        }),
      );
    });

    const renderedText = JSON.stringify(tree.toJSON());
    expect(renderedText).toContain('Order Cancelled');
    expect(renderedText).toContain('STOP PREPARING THIS ORDER');
    expect(renderedText).toContain('Order #1042');
    expect(renderedText).toContain('Customer changed plans.');

    const buttons = tree.root.findAllByType('AppButton');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].props.label).toBe('View Order');
    expect(buttons[1].props.label).toBe('Acknowledge');

    expect(onAcknowledge).not.toHaveBeenCalled();
    expect(onViewOrder).not.toHaveBeenCalled();

    renderer.act(() => {
      buttons[1].props.onPress();
      buttons[0].props.onPress();
    });

    expect(onAcknowledge).toHaveBeenCalledTimes(1);
    expect(onViewOrder).toHaveBeenCalledTimes(1);
  });
});
