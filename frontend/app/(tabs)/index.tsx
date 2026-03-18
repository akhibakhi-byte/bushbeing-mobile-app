import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView,
  ActivityIndicator, Dimensions, RefreshControl, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/AuthContext';
import { api } from '../../src/api';
import { Colors, Spacing, Radius } from '../../src/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.l * 2 - Spacing.m) / 2;

export default function MyPlants() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [plants, setPlants] = useState<any[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [wateringLogs, setWateringLogs] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const fetchData = async () => {
    try {
      const [plantsRes, roomsRes, logsRes] = await Promise.all([
        api.get('/plants'),
        api.get('/rooms'),
        api.get('/watering-logs'),
      ]);
      setPlants(plantsRes);
      setRooms(roomsRes.rooms || []);
      setWateringLogs(logsRes);
    } catch (e: any) {
      console.log('Fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const isWateredToday = (plantId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return wateringLogs.find(l => l.plant_id === plantId && l.watered_at?.startsWith(today));
  };

  const toggleWater = async (plant: any) => {
    const todayLog = isWateredToday(plant.id);
    try {
      if (todayLog) {
        await api.del(`/watering-logs/${todayLog.id}`);
      } else {
        await api.post(`/plants/${plant.id}/water`);
      }
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const filtered = selectedRoom === 'All' ? plants : plants.filter(p => p.location === selectedRoom);

  const getPlantImage = (plant: any) => {
    if (plant.images?.length > 0) {
      const img = plant.images[0];
      return img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
    }
    return plant.placeholder_image || null;
  };

  const renderPlantCard = ({ item }: { item: any }) => {
    const watered = isWateredToday(item.id);
    const imageUri = getPlantImage(item);

    return (
      <TouchableOpacity
        testID={`plant-card-${item.id}`}
        style={styles.card}
        onPress={() => router.push(`/plant/${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.cardImageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.cardImage} contentFit="cover" />
          ) : (
            <View style={[styles.cardImage, styles.cardPlaceholder]}>
              <Ionicons name="leaf" size={40} color={Colors.primary} />
            </View>
          )}
          <TouchableOpacity
            testID={`water-toggle-${item.id}`}
            style={[styles.waterBtn, watered && styles.waterBtnDone]}
            onPress={(e) => { e.stopPropagation(); toggleWater(item); }}
            activeOpacity={0.7}
          >
            {watered ? (
              <Feather name="check-circle" size={20} color={Colors.primary} />
            ) : (
              <Ionicons name="water" size={20} color={Colors.blue} />
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardNickname} numberOfLines={1}>{item.nickname}</Text>
          <Text style={styles.cardCommon} numberOfLines={1}>{item.common_name || item.scientific_name || 'Unknown'}</Text>
          {item.location && (
            <View style={styles.roomBadge}>
              <Text style={styles.roomBadgeText}>{item.location}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Plant Parent'}</Text>
          <Text style={styles.title}>My Plants</Text>
        </View>
        <TouchableOpacity testID="menu-btn" onPress={() => setShowMenu(!showMenu)} style={styles.menuBtn}>
          <Feather name="menu" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Menu Dropdown */}
      {showMenu && (
        <View style={styles.menuDropdown}>
          <TouchableOpacity testID="logout-btn" style={styles.menuItem} onPress={() => { setShowMenu(false); logout(); router.replace('/auth'); }}>
            <Feather name="log-out" size={18} color={Colors.error} />
            <Text style={[styles.menuItemText, { color: Colors.error }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Room Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {['All', ...rooms].map(room => (
          <TouchableOpacity
            key={room}
            testID={`room-filter-${room}`}
            style={[styles.filterPill, selectedRoom === room && styles.filterPillActive]}
            onPress={() => setSelectedRoom(room)}
          >
            <Text style={[styles.filterText, selectedRoom === room && styles.filterTextActive]}>{room}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Plant Grid */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="flower" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No plants yet</Text>
          <Text style={styles.emptySubtitle}>Tap + to add your first plant</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderPlantCard}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        testID="add-plant-fab"
        style={styles.fab}
        onPress={() => router.push('/plant/add')}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={28} color={Colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.l, paddingTop: Spacing.m, paddingBottom: Spacing.s },
  greeting: { fontSize: 14, color: Colors.textSecondary, marginBottom: 2 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  menuBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  menuDropdown: { position: 'absolute', top: 100, right: Spacing.l, backgroundColor: Colors.surface, borderRadius: Radius.m, borderWidth: 1, borderColor: Colors.border, zIndex: 100, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  menuItemText: { fontSize: 14, fontWeight: '600' },
  filterRow: { maxHeight: 48, marginBottom: Spacing.s },
  filterContent: { paddingHorizontal: Spacing.l, gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },
  grid: { paddingHorizontal: Spacing.l, paddingBottom: 100 },
  row: { gap: Spacing.m, marginBottom: Spacing.m },
  card: { width: CARD_WIDTH, backgroundColor: Colors.surface, borderRadius: Radius.l, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cardImageWrap: { position: 'relative' },
  cardImage: { width: '100%', height: CARD_WIDTH * 0.85, backgroundColor: Colors.surfaceHighlight },
  cardPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  waterBtn: { position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  waterBtnDone: { backgroundColor: 'rgba(16,185,129,0.2)' },
  cardBody: { padding: 10 },
  cardNickname: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  cardCommon: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  roomBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: 'rgba(16,185,129,0.15)' },
  roomBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 },
});
