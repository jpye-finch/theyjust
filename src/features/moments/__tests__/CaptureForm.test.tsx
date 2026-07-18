import { render, screen, userEvent } from '@testing-library/react-native';
import { CaptureForm } from '../CaptureForm';

// DateField wraps a platform date picker (native) / the browser's date input
// (web), neither of which can be typed into. These tests exercise CaptureForm's
// own logic, so stub it with a plain text input keyed by its label; the real
// picker is verified at runtime.
jest.mock('../../../components/DateField', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return {
    DateField: ({
      label,
      value,
      onChange,
    }: {
      label: string;
      value: string;
      onChange: (iso: string) => void;
    }) =>
      React.createElement(TextInput, { accessibilityLabel: label, value, onChangeText: onChange }),
  };
});

describe('CaptureForm', () => {
  it('submits a milestone moment with the preset title shown', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <CaptureForm
        initialMilestoneId="rolled_over"
        defaultOccurredOn="2026-05-01"
        photoCount={0}
        onPickPhoto={jest.fn()}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText('They just rolled over!')).toBeTruthy();
    await user.type(screen.getByPlaceholderText('Add a little note (optional)'), 'flipped over');
    await user.press(screen.getByText('Save moment'));
    expect(onSubmit).toHaveBeenCalledWith({
      milestoneId: 'rolled_over',
      customTitle: null,
      occurredOn: '2026-05-01',
      note: 'flipped over',
    });
  });

  it('requires a custom title when there is no preset', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <CaptureForm
        initialMilestoneId={null}
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
      milestoneId: null,
      customTitle: 'First haircut',
      occurredOn: '2026-05-01',
      note: '',
    });
  });

  it('browses the catalogue and submits the chosen milestone', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <CaptureForm
        initialMilestoneId={null}
        defaultOccurredOn="2026-05-01"
        photoCount={0}
        onPickPhoto={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.press(screen.getByText('Choose from milestones'));
    await user.press(screen.getByLabelText('Rolled over'));

    // The celebration wording replaces the free-text field once chosen.
    expect(screen.getByText('They just rolled over!')).toBeTruthy();
    expect(screen.queryByPlaceholderText('What happened?')).toBeNull();

    await user.press(screen.getByText('Save moment'));
    expect(onSubmit).toHaveBeenCalledWith({
      milestoneId: 'rolled_over',
      customTitle: null,
      occurredOn: '2026-05-01',
      note: '',
    });
  });

  it('falls back to your own words after a milestone was chosen', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <CaptureForm
        initialMilestoneId="rolled_over"
        defaultOccurredOn="2026-05-01"
        photoCount={0}
        onPickPhoto={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.press(screen.getByText('Write my own'));
    await user.type(screen.getByPlaceholderText('What happened?'), 'First haircut');
    await user.press(screen.getByText('Save moment'));

    expect(onSubmit).toHaveBeenCalledWith({
      milestoneId: null,
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
        initialMilestoneId="rolled_over"
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
        initialMilestoneId="rolled_over"
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
        initialMilestoneId="rolled_over"
        defaultOccurredOn="2026-05-01"
        photoCount={1}
        onPickPhoto={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByText('1 photo added')).toBeTruthy();
  });
});
