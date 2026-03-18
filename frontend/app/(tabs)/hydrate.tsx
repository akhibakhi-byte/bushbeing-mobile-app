import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Alert, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api';
import { Colors, Spacing, Radius } from '../../src/theme';

export default function HydrateScreen() {
  const [plants, setPlants] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

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

  const getDateStr = (d: Date) => d.toISOString().split('T')[0];
  const todayStr = getDateStr(new Date());
  const selectedStr = getDateStr(selectedDate);
  const isToday = selectedStr === todayStr;

  // Generate dates: 7 before, today, 7 after
  const dates = Array.from({ length: 15 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i - 7);
    return d;
  });

  const getLogsForDate = (dateStr: string) => logs.filter(l => l.watered_at?.startsWith(dateStr));
  const isPlantWateredOnDate = (plantId: string, dateStr: string) =>
    logs.find(l => l.plant_id === plantId && l.watered_at?.startsWith(dateStr));

  const todayLogs = getLogsForDate(todayStr);
  const wateredTodayIds = new Set(todayLogs.map(l => l.plant_id));
  const wateredToday = wateredTodayIds.size;
  const totalPlants = plants.length;
  const progress = totalPlants > 0 ? wateredToday / totalPlants : 0;

  const toggleWater = async (plant: any) => {
    const dateStr = selectedStr;
    const log = isPlantWateredOnDate(plant.id, dateStr);
    try {
      if (log) {
        await api.del(`/watering-logs/${log.id}`);
      } else if (isToday) {
        await api.post(`/plants/${plant.id}/water`);
      } else {
        const waterDate = new Date(selectedDate);
        waterDate.setHours(12, 0, 0, 0);
        await api.post(`/plants/${plant.id}/water-history`, { watered_at: waterDate.toISOString() });
      }
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const getPlantImage = (plant: any) => {
    if (plant.images?.length > 0) {
      const img = plant.images[0];
      return img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
    }
    return plant.placeholder_image || null;
  };

  // Upcoming waterings
  const upcoming = plants
    .filter(p => p.next_watering)
    .map(p => ({ ...p, nextDate: new Date(p.next_watering) }))
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
    .slice(0, 5);

  const formatDay = (d: Date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const formatDate = (d: Date) => d.getDate().toString();

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Hydrate</Text>
          <Ionicons name="water" size={28} color={Colors.primary} />
        </View>

        {/* Progress */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Today's Progress</Text>
          <Text style={styles.progressCount}>{wateredToday} of {totalPlants} plants hydrated</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Date Timeline */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeline} contentContainerStyle={styles.timelineContent}>
          {dates.map((d, i) => {
            const ds = getDateStr(d);
            const isSelected = ds === selectedStr;
            const isT = ds === todayStr;
            return (
              <TouchableOpacity
                key={i}
                testID={`date-${ds}`}
                style={[styles.dateItem, isSelected && styles.dateItemActive]}
                onPress={() => setSelectedDate(new Date(d))}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateDay, isSelected && styles.dateDayActive]}>{formatDay(d)}</Text>
                <Text style={[styles.dateNum, isSelected && styles.dateNumActive]}>{formatDate(d)}</Text>
                {isT && <View style={[styles.todayDot, isSelected && styles.todayDotActive]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Plants for selected date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isToday ? "Today's Watering" : `Watering on ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          </Text>
          {plants.length === 0 ? (
            <Text style={styles.emptyText}>No plants added yet</Text>
          ) : (
            plants.map(plant => {
              const watered = isPlantWateredOnDate(plant.id, selectedStr);
              const imgUri = getPlantImage(plant);
              return (
                <View key={plant.id} style={styles.plantRow}>
                  <View style={styles.plantThumb}>
                    {imgUri ? (
                      <Image source={{ uri: imgUri }} style={styles.thumbImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.thumbImg, styles.thumbPlaceholder]}>
                        <Ionicons name="leaf" size={20} color={Colors.primary} />
                      </View>
                    )}
                  </View>
                  <View style={styles.plantInfo}>
                    <Text style={styles.plantName}>{plant.nickname}</Text>
                    <Text style={styles.plantSub}>{plant.common_name || 'Unknown species'}</Text>
                  </View>
                  <TouchableOpacity
                    testID={`hydrate-water-${plant.id}`}
                    style={[styles.waterIcon, watered && styles.waterIconDone]}
                    onPress={() => toggleWater(plant)}
                    activeOpacity={0.7}
                  >
                    {watered ? (
                      <Feather name="check-circle" size={24} color={Colors.primary} />
                    ) : (
                      <Ionicons name="water-outline" size={24} color={Colors.blue} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Waterings</Text>
            {upcoming.map(plant => (
              <View key={plant.id} style={styles.upcomingRow}>
                <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.upcomingName}>{plant.nickname}</Text>
                <Text style={styles.upcomingDate}>
                  {plant.nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            ))}
          </View>
        )}

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
  progressCard: { marginHorizontal: Spacing.l, backgroundColor: Colors.surface, borderRadius: Radius.l, padding: Spacing.l, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.m },
  progressTitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },
  progressCount: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  progressBar: { height: 8, backgroundColor: Colors.surfaceHighlight, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },
  timeline: { marginBottom: Spacing.m },
  timelineContent: { paddingHorizontal: Spacing.l, gap: 8 },
  dateItem: { width: 52, height: 72, borderRadius: Radius.m, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  dateItemActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateDay: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' },
  dateDayActive: { color: 'rgba(255,255,255,0.8)' },
  dateNum: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  dateNumActive: { color: Colors.white },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 3 },
  todayDotActive: { backgroundColor: Colors.white },
  section: { paddingHorizontal: Spacing.l, marginBottom: Spacing.l },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  plantRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.m, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  plantThumb: { marginRight: 12 },
  thumbImg: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceHighlight },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  plantInfo: { flex: 1 },
  plantName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  plantSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  waterIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  waterIconDone: { backgroundColor: 'rgba(16,185,129,0.1)' },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  upcomingName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  upcomingDate: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
