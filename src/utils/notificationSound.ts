// Lightweight Web Audio API synthesized notification chimes
// Works in all browsers without external audio asset downloads

class NotificationSoundService {
  private audioCtx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  // Smooth pleasant dual-tone chime for chat messages
  playMessageChime() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      
      // First tone (E5 ~ 659Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.26);

      // Second higher tone (A5 ~ 880Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.1);
      gain2.gain.setValueAtTime(0.001, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.46);
    } catch {
      // Audio playback was prevented or not supported
    }
  }

  // Regal fanfare chime for announcements
  playAnnouncementChime() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + idx * 0.09;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0.001, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.16, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteStart);
        osc.stop(noteStart + 0.36);
      });
    } catch {
      // Audio playback prevented
    }
  }
}

export const soundService = new NotificationSoundService();

// Browser notification helper
export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.warn('Failed to register notification service worker:', err);
    return null;
  }
}

const rawPushApiUrl = (import.meta as any).env?.VITE_API_URL || "";
const PUSH_API_URL = rawPushApiUrl.endsWith("/") ? rawPushApiUrl.slice(0, -1) : rawPushApiUrl;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function sendPushTestNotification(identityIds: string[] = []): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${PUSH_API_URL}/api/push/test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        uids: Array.from(new Set(identityIds.filter(Boolean))),
      }),
    });

    return response.ok;
  } catch (error) {
    console.warn('Failed to send push test notification:', error);
    return false;
  }
}

export async function enablePushNotifications(identityIds: string[] = []): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const token = localStorage.getItem('auth_token');

  try {
    const registration = await registerNotificationServiceWorker();
    if (!registration) return false;

    // Wait until the worker is active before touching PushManager.
    const activeRegistration = await navigator.serviceWorker.ready;
    if (!activeRegistration) return false;

    const keyResponse = await fetch(`${PUSH_API_URL}/api/push/public-key`, {
      cache: 'no-store',
    });
    if (!keyResponse.ok) throw new Error(`Failed to load push public key: HTTP ${keyResponse.status}`);

    const keyData = await keyResponse.json();
    if (!keyData?.publicKey) throw new Error('Push public key is missing');

    let subscription = await activeRegistration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await activeRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const saveResponse = await fetch(`${PUSH_API_URL}/api/push/subscribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        uids: Array.from(new Set(identityIds.filter(Boolean))),
      }),
    });

    if (!saveResponse.ok) {
      const errorText = await saveResponse.text().catch(() => '');
      throw new Error(errorText || `HTTP ${saveResponse.status}`);
    }

    return true;
  } catch (error) {
    console.warn('Failed to enable Web Push notifications:', error);
    return false;
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return 'denied';
  }
}

export async function sendBrowserNotification(title: string, options?: NotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const defaultOptions: NotificationOptions = {
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    silent: false,
    ...options,
  };

  try {
    // Attempt ServiceWorker showNotification first with a fast 400ms timeout
    if ('serviceWorker' in navigator) {
      try {
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          registerNotificationServiceWorker(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 400))
        ]);

        if (registration && 'showNotification' in registration) {
          await registration.showNotification(title, defaultOptions);
          return;
        }
      } catch (swErr) {
        // Fall through to standard Notification
      }
    }

    // Standard Notification constructor fallback
    new Notification(title, defaultOptions);
  } catch (err) {
    console.warn('Failed to send browser notification:', err);
  }
}
