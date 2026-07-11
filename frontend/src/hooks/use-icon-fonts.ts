// App-wide font loader: icon glyphs (MaterialCommunityIcons, the only icon
// set used in this app) + the brand fonts referenced everywhere in
// src/theme.ts (Outfit / Manrope).
//
// Previous version of this hook fetched icon fonts from a CDN, and only
// under Expo Go — it assumed native/standalone builds already had the fonts
// linked via autolinking. That assumption didn't hold for this build (icons
// rendered blank), and the Outfit/Manrope brand fonts were never loaded at
// all (theme.ts referenced them, but nothing called useFonts for them), so
// every screen silently fell back to the system font — the "flat" look.
//
// Fix: load everything from local package assets via Metro (bundled into
// the app at build time, works identically in Expo Go, dev client, and
// standalone/prod builds — no network dependency, no environment branching).
import { useFonts } from 'expo-font';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Outfit_400Regular, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';

export const useIconFonts = (): readonly [boolean, Error | null] =>
  useFonts({
    'material-community': MaterialCommunityIcons.font,
    Outfit: Outfit_400Regular,
    'Outfit-Bold': Outfit_700Bold,
    Manrope: Manrope_400Regular,
    'Manrope-Medium': Manrope_500Medium,
    'Manrope-Bold': Manrope_700Bold,
  });
