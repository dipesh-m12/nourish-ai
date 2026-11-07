import { app } from './app';
import { env } from './config/env';

// '0.0.0.0' so a phone on the same Wi-Fi can reach the API through Expo Go.
app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`API running on http://localhost:${env.PORT}`);
});
