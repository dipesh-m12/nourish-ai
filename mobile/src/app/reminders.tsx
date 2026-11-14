import { Redirect } from 'expo-router';

/** Old link (pushes, Profile): reminders now live in a sheet on the dashboard. */
export default function RemindersRedirect() {
  return <Redirect href="/dashboard?open=reminders" />;
}
