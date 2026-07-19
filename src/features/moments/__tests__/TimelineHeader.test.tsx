import { render, screen, userEvent } from '@testing-library/react-native';
import { TimelineHeader } from '../TimelineHeader';

describe('TimelineHeader', () => {
  it('names the child whose story it is', async () => {
    await render(
      <TimelineHeader
        childName="Mabel"
        view="list"
        onSelectView={jest.fn()}
        onCapture={jest.fn()}
      />,
    );
    expect(screen.getByText('TheyJust')).toBeTruthy();
    expect(screen.getByText("Mabel's story")).toBeTruthy();
  });

  it('switches to the spine', async () => {
    const onSelectView = jest.fn();
    const user = userEvent.setup();
    await render(
      <TimelineHeader
        childName="Mabel"
        view="list"
        onSelectView={onSelectView}
        onCapture={jest.fn()}
      />,
    );
    await user.press(screen.getByLabelText('Timeline view'));
    expect(onSelectView).toHaveBeenCalledWith('spine');
  });

  it('switches back to the list', async () => {
    const onSelectView = jest.fn();
    const user = userEvent.setup();
    await render(
      <TimelineHeader
        childName="Mabel"
        view="spine"
        onSelectView={onSelectView}
        onCapture={jest.fn()}
      />,
    );
    await user.press(screen.getByLabelText('List view'));
    expect(onSelectView).toHaveBeenCalledWith('list');
  });

  it('still opens capture', async () => {
    const onCapture = jest.fn();
    const user = userEvent.setup();
    await render(
      <TimelineHeader
        childName="Mabel"
        view="list"
        onSelectView={jest.fn()}
        onCapture={onCapture}
      />,
    );
    await user.press(screen.getByLabelText('Capture a moment'));
    expect(onCapture).toHaveBeenCalled();
  });
});
