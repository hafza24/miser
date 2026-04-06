/**
 * Native bridge utilities — safe to import on web (gracefully degrades).
 * All Capacitor calls are wrapped in try/catch so the web app never breaks.
 */
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

// ─── Splash Screen ───────────────────────────────────
export const hideSplash = async () => {
  if (!isNative) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch { /* web fallback — nothing to do */ }
};

// ─── Status Bar ──────────────────────────────────────
export const configureStatusBar = async () => {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#d46b8c' });
  } catch { /* web fallback */ }
};

// ─── Keyboard ────────────────────────────────────────
export const setupKeyboard = async () => {
  if (!isNative) return;
  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    Keyboard.addListener('keyboardWillShow', () => {
      document.body.classList.add('keyboard-open');
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open');
    });
  } catch { /* web fallback */ }
};

// ─── Push Notifications ─────────────────────────────
export const initPushNotifications = async () => {
  if (!isNative) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      console.log('[Push] Token:', token.value);
      // TODO: send token to your backend for targeting
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', err);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Action:', action);
      // Navigate to the relevant page based on action.notification.data
    });
  } catch { /* web fallback */ }
};

// ─── Haptics ─────────────────────────────────────────
export const hapticFeedback = async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: map[style] });
  } catch { /* web fallback */ }
};

// ─── App (back button, URL open) ─────────────────────
export const setupAppListeners = async (navigateFn?: (path: string) => void) => {
  if (!isNative) return;
  try {
    const { App } = await import('@capacitor/app');

    // Handle Android hardware back button
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Handle deep links / app URL opens
    App.addListener('appUrlOpen', (data) => {
      const slug = data.url.split('.app').pop();
      if (slug && navigateFn) {
        navigateFn(slug);
      }
    });
  } catch { /* web fallback */ }
};

// ─── Master init — call once on app mount ────────────
export const initNativePlugins = async () => {
  if (!isNative) return;
  await configureStatusBar();
  await setupKeyboard();
  await initPushNotifications();
  await setupAppListeners();
  // Splash hides automatically via config, but force-hide after 3s as safety net
  setTimeout(() => hideSplash(), 3000);
};
