import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api';
import { Colors, Spacing, Radius } from '../../src/theme';

const careTips = [
  { icon: 'water-outline' as const, family: 'Ionicons', title: 'Watering', tip: 'Check soil moisture before watering. Most plants prefer slightly dry soil.' },
  { icon: 'sunny-outline' as const, family: 'Ionicons', title: 'Light', tip: 'Rotate plants quarterly for even growth. Most need bright indirect light.' },
  { icon: 'thermometer-outline' as const, family: 'Ionicons', title: 'Temperature', tip: 'Keep plants between 60-75°F. Avoid cold drafts and heating vents.' },
  { icon: 'water' as const, family: 'Ionicons', title: 'Humidity', tip: 'Group plants together to increase humidity. Mist tropical varieties.' },
];

export default function NurtureScreen() {
  const router = useRouter();
  const [plants, setPlants] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [plantsRes, logsRes] = await Promise.all([
        api.get('/plants'),
        api.get('/watering-logs'),
      ]);
      setPlants(plantsRes);
      setLogs(logsRes);
    } catch (e: any) {
      console.log('Error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const getHealthScore = (plant: any) => {
    let score = 70; // base
    const today = new Date();
    if (plant.next_watering) {
      const next = new Date(plant.next_watering);
      if (next >= today) score += 20;
      else {
        const overdueDays = Math.floor((today.getTime() - next.getTime()) / 86400000);
        score -= Math.min(overdueDays * 10, 40);
      }
    }
    const todayStr = today.toISOString().split('T')[0];
    if (logs.find(l => l.plant_id === plant.id && l.watered_at?.startsWith(todayStr))) {
      score += 10;
    }
    return Math.max(0, Math.min(100, score));
  };

  const getStatus = (score: number) => {
    if (score >= 80) return { label: 'Thriving', color: Colors.primary };
    if (score >= 50) return { label: 'Good', color: Colors.warning };
    return { label: 'Needs Care', color: Colors.error };
  };

  const thriving = plants.filter(p => getHealthScore(p) >= 80).length;
  const needsCare = plants.filter(p => getHealthScore(p) < 50).length;

  const getPlantImage = (plant: any) => {
    if (plant.images?.length > 0) {
      const img = plant.images[0];
      return img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
    }
    return plant.placeholder_image || null;
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Nurture</Text>
          <Feather name="heart" size={24} color={Colors.primary} />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{plants.length}</Text>
            <Text style={styles.statLabel}>Total Plants</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: Colors.primary }]}>{thriving}</Text>
            <Text style={styles.statLabel}>Thriving</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: needsCare > 0 ? Colors.error : Colors.textPrimary }]}>{needsCare}</Text>
            <Text style={styles.statLabel}>Needs Care</Text>
          </View>
        </View>

        {/* Health Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plant Health</Text>
          {plants.length === 0 ? (
            <Text style={styles.emptyText}>Add plants to see health data</Text>
          ) : (
            plants.map(plant => {
              const score = getHealthScore(plant);
              const status = getStatus(score);
              const imgUri = getPlantImage(plant);
              const care = plant.care_info || {};
              return (
                <TouchableOpacity
                  key={plant.id}
                  testID={`health-card-${plant.id}`}
                  style={styles.healthCard}
                  onPress={() => router.push(`/plant/${plant.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.healthTop}>
                    <View style={styles.healthImgWrap}>
                      {imgUri ? (
                        <Image source={{ uri: imgUri }} style={styles.healthImg} contentFit="cover" />
                      ) : (
                        <View style={[styles.healthImg, { justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="leaf" size={24} color={Colors.primary} />
                        </View>
                      )}
                    </View>
                    <View style={styles.healthInfo}>
                      <Text style={styles.healthName}>{plant.nickname}</Text>
                      <View style={styles.healthScoreRow}>
                        <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                        <Text style={[styles.scoreText, { color: status.color }]}>{score}%</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.healthBar}>
                    <View style={[styles.healthBarFill, { width: `${score}%`, backgroundColor: status.color }]} />
                  </View>
                  <View style={styles.careRow}>
                    {care.watering && (
                      <View style={styles.careChip}>
                        <Ionicons name="water-outline" size={14} color={Colors.blue} />
                        <Text style={styles.careChipText} numberOfLines={1}>{care.watering}</Text>
                      </View>
                    )}
                    {care.sunlight && (
                      <View style={styles.careChip}>
                        <Ionicons name="sunny-outline" size={14} color={Colors.warning} />
                        <Text style={styles.careChipText} numberOfLines={1}>{care.sunlight}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Care Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Care Tips</Text>
          <View style={styles.tipsGrid}>
            {careTips.map((tip, i) => (
              <View key={i} style={styles.tipCard}>
                <View style={styles.tipIconWrap}>
                  <Ionicons name={tip.icon} size={24} color={Colors.primary} />
                </View>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipText}>{tip.tip}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.l, paddingTop: Spacing.m, paddingBottom: Spacing.s },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.l, gap: 10, marginBottom: Spacing.l },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.m, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNum: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  section: { paddingHorizontal: Spacing.l, marginBottom: Spacing.l },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  healthCard: { backgroundColor: Colors.surface, borderRadius: Radius.l, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  healthTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  healthImgWrap: { marginRight: 12 },
  healthImg: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.surfaceHighlight },
  healthInfo: { flex: 1 },
  healthName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  healthScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  statusText: { fontSize: 12, fontWeight: '600' },
  scoreText: { fontSize: 14, fontWeight: '700' },
  healthBar: { height: 4, backgroundColor: Colors.surfaceHighlight, borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  healthBarFill: { height: 4, borderRadius: 2 },
  careRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  careChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceHighlight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.s, maxWidth: '48%' },
  careChipText: { fontSize: 11, color: Colors.textSecondary, flex: 1 },
  tipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tipCard: { width: '48%', backgroundColor: Colors.surface, borderRadius: Radius.m, padding: 14, borderWidth: 1, borderColor: Colors.border },
  tipIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  tipTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  tipText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
});
