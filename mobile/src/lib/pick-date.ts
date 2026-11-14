import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { localDate } from '@/utils/date';

/** Opens the system date picker (Android dialog). Resolves the picked local day, or null. */
export function pickDate(min: string, initial: string): Promise<string | null> {
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      value: new Date(`${initial}T12:00:00`),
      minimumDate: new Date(`${min}T00:00:00`),
      mode: 'date',
      onChange: (event, date) => resolve(event.type === 'set' && date ? localDate(date) : null),
    });
  });
}

export const PICK_DATE_SUPPORTED = true;

/** Opens the system time picker. Resolves { hour, minute } or null when cancelled. */
export function pickTime(
  hour: number,
  minute: number,
): Promise<{ hour: number; minute: number } | null> {
  return new Promise((resolve) => {
    const value = new Date();
    value.setHours(hour, minute, 0, 0);
    DateTimePickerAndroid.open({
      value,
      mode: 'time',
      is24Hour: false,
      onChange: (event, date) =>
        resolve(
          event.type === 'set' && date
            ? { hour: date.getHours(), minute: date.getMinutes() }
            : null,
        ),
    });
  });
}
