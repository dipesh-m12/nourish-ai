/** Browsers can't set phone alarms. */
export async function setPhoneAlarm(_h: number, _m: number, _label: string): Promise<boolean> {
  return false;
}

export const ALARM_SUPPORTED = false;
