import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '../../src/theme';

const BG_IMAGE = 'https://customer-assets.emergentagent.com/job_dd7cb811-ca16-4720-a762-7f0b1fb7bdb4/artifacts/w5mp5157_1772521930338.png';
const SURVEY_URL = 'https://bit.ly/4stUPJf?r=qr';

export default function DevicesScreen() {
  return (
    <View style={styles.container}>
      <Image source={{ uri: BG_IMAGE }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>COMING SOON</Text>
          </View>
          <Text style={styles.headline}>
            Meet <Text style={styles.dewText}>Dew</Text>
          </Text>
          <Text style={styles.description}>
            We're building a smart device to keep your indoor plants thriving while you're away. Your opinion matters — help us shape it.
          </Text>
          <TouchableOpacity
            testID="take-survey-btn"
            style={styles.surveyBtn}
            onPress={() => Linking.openURL(SURVEY_URL)}
            activeOpacity={0.7}
          >
            <Feather name="external-link" size={18} color={Colors.white} />
            <Text style={styles.surveyBtnText}>Take Survey</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: 'flex-end', padding: Spacing.l, paddingBottom: 120 },
  badge: { alignSelf: 'flex-start', backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 6, borderRadius: Radius.pill, marginBottom: 16 },
  badgeText: { color: Colors.white, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  headline: { fontSize: 40, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  dewText: { color: Colors.primary },
  description: { fontSize: 16, color: Colors.textSecondary, lineHeight: 24, marginBottom: 24 },
  surveyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, height: 52, borderRadius: Radius.pill, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  surveyBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
