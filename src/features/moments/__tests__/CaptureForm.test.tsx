import { render, screen, userEvent } from '@testing-library/react-native';
import { CaptureForm } from '../CaptureForm';

describe('CaptureForm', () => {
  it('submits a milestone moment with the preset title shown', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <CaptureForm
        presetTitle="They just rolled over!"
        defaultOccurredOn="2026-05-01"
        photoCount={0}
        onPickPhoto={jest.fn()}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText('They just rolled over!')).toBeTruthy();
    await user.type(screen.getByPlaceholderText('Add a little note (optional)'), 'flipped over');
    await user.press(screen.getByText('Save moment'));
    expect(onSubmit).toHaveBeenCalledWith({ customTitle: null, occurredOn: '2026-05-01', note: 'flipped over' });
  });

  it('requires a custom title when there is no preset', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <CaptureForm
        presetTitle={null}
        defaultOccurredOn="2026-05-01"
        photoCount={0}
        onPickPhoto={jest.fn()}
        onSubmit={onSubmit}
      />,
    );
    await user.press(screen.getByText('Save moment'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Give this moment a name')).toBeTruthy();
    await user.type(screen.getByPlaceholderText('What happened?'), '  First haircut ');
    await user.press(screen.getByText('Save moment'));
    expect(onSubmit).toHaveBeenCalledWith({
      customTitle: 'First haircut',
      occurredOn: '2026-05-01',
      note: '',
    });
  });

  it('rejects an invalid date', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <CaptureForm
        presetTitle="They just smiled!"
        defaultOccurredOn="2026-05-01"
        photoCount={0}
        onPickPhoto={jest.fn()}
        onSubmit={onSubmit}
      />,
    );
    await user.clear(screen.getByLabelText('When did it happen?'));
    await user.type(screen.getByLabelText('When did it happen?'), '2026-02-30');
    await user.press(screen.getByText('Save moment'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the date as YYYY-MM-DD')).toBeTruthy();
  });

  it('reflects attached photo count on the add control', async () => {
    await render(
      <CaptureForm
        presetTitle="They just smiled!"
        defaultOccurredOn="2026-05-01"
        photoCount={2}
        onPickPhoto={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByText('2 photos added')).toBeTruthy();
  });

  it('uses the singular label for a single photo', async () => {
    await render(
      <CaptureForm
        presetTitle="They just smiled!"
        defaultOccurredOn="2026-05-01"
        photoCount={1}
        onPickPhoto={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByText('1 photo added')).toBeTruthy();
  });
});
