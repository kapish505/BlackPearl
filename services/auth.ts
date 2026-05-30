// Google Auth Service — Native Google Sign-In
let GoogleSignin: any;
let isSuccessResponse: any;
try {
  const G = require('@react-native-google-signin/google-signin');
  GoogleSignin = G.GoogleSignin;
  isSuccessResponse = G.isSuccessResponse;
} catch (e) {
  console.warn('Google Sign-In native module not found. It will not work in Expo Go.');
}
import * as SecureStore from 'expo-secure-store';

// User must replace these with their own Client IDs
const GOOGLE_CLIENT_ID_WEB = '568133118032-t182nfoc3vmjva2ieion2h8g9lv047kp.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_IOS = '__GOOGLE_CLIENT_ID_IOS__';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const TOKEN_KEY = 'bp_google_token';
const REFRESH_KEY = 'bp_google_refresh';
const EXPIRY_KEY = 'bp_google_expiry';
const USER_KEY = 'bp_user_profile';

export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
}

// Initialize Native Google Sign In
if (GoogleSignin) {
  GoogleSignin.configure({
    webClientId: GOOGLE_CLIENT_ID_WEB,
    iosClientId: GOOGLE_CLIENT_ID_IOS,
    scopes: SCOPES,
    offlineAccess: true, // required to get tokens for API access
  });
}

export async function signInWithGoogleNative(): Promise<{ accessToken: string; user: GoogleUser }> {
  if (!GoogleSignin) {
    throw new Error('Google Sign-In is not available in Expo Go. Please build the native app or use the simulated Coral login.');
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  if (isSuccessResponse(response)) {
    // Successfully signed in, now fetch the access token for API calls
    const tokens = await GoogleSignin.getTokens();
    const userProfile: GoogleUser = {
      name: response.data.user.name || 'User',
      email: response.data.user.email,
      picture: response.data.user.photo || undefined,
    };

    return {
      accessToken: tokens.accessToken,
      user: userProfile,
    };
  }

  throw new Error('Sign in was cancelled or failed.');
}

// Persist tokens securely
export async function saveTokens(accessToken: string, expiresIn?: number): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  if (expiresIn) {
    const expiry = Date.now() + expiresIn * 1000;
    await SecureStore.setItemAsync(EXPIRY_KEY, expiry.toString());
  }
}

export async function getStoredToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const expiryStr = await SecureStore.getItemAsync(EXPIRY_KEY);

  if (!token) return null;

  // Check if expired
  if (expiryStr) {
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) {
      await clearTokens();
      return null;
    }
  }

  return token;
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(EXPIRY_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);

  try {
    await GoogleSignin.signOut();
  } catch (e) {
    // Ignore sign out errors if already signed out
  }
}

export async function saveUser(user: GoogleUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser(): Promise<GoogleUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
