import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView,
  ActivityIndicator, Dimensions, RefreshControl, Alert, Modal,
  TextInput, Animated, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/AuthContext';
import { api } from '../../src/api';
import { Colors, Spacing, Radius } from '../../src/theme';
import { playWaterSound } from '../../src/sounds';
import { requestNotificationPermissions, scheduleWateringReminders } from '../../src/notifications';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.l * 2 - Spacing.m) / 2;

const DEFAULT_ROOMS = ['Living Room', 'Bedroom', 'Study Room', 'Balcony'];

export default function MyPlants() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [plants, setPlants] = useState<any[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [wateringLogs, setWateringLogs] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Drawer menu
  const [showDrawer, setShowDrawer] = useState(false);

  // Room editing
  const [showRoomEdit, setShowRoomEdit] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [editingRoomOld, setEditingRoomOld] = useState<string | null>(null);
  const [editingRoomNew, setEditingRoomNew] = useState('');

  // Change password
  const [showChangePw, setShowChangePw] = useState(false);
  const [cpOld, setCpOld] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpLoading, setCpLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'undo' } | null>(null);
  const toastOpacity = useState(new Animated.Value(0))[0];

  const showToast = (message: string, type: 'success' | 'undo' = 'success') => {
    setToast({ message, type });
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  const seedingRef = useRef(false);

  const seedDefaultRooms = async (existingRooms: string[]) => {
    if (seedingRef.current) return;
    const storageKey = `rooms_seeded_${user?.id}`;
    const alreadySeeded = await AsyncStorage.getItem(storageKey);
    if (alreadySeeded) return;

    seedingRef.current = true;
    try {
      for (const room of DEFAULT_ROOMS) {
        if (!existingRooms.includes(room)) {
          await api.post('/rooms', { name: room });
        }
      }
      await AsyncStorage.setItem(storageKey, 'true');
    } catch (e: any) {
      console.log('Seed rooms error:', e.message);
    } finally {
      seedingRef.current = false;
    }
  };

  const fetchData = async () => {
    try {
      const [plantsRes, roomsRes, logsRes] = await Promise.all([
        api.get('/plants'),
        api.get('/rooms'),
        api.get('/watering-logs'),
      ]);
      setPlants(plantsRes);
      const userRooms: string[] = roomsRes.rooms || [];

      // Seed default rooms into backend on first use
      const storageKey = `rooms_seeded_${user?.id}`;
      const alreadySeeded = await AsyncStorage.getItem(storageKey);
      if (!alreadySeeded) {
        await seedDefaultRooms(userRooms);
        // Re-fetch rooms after seeding
        const updatedRooms = await api.get('/rooms');
        setRooms(updatedRooms.rooms || []);
      } else {
        setRooms(userRooms);
      }

      setWateringLogs(logsRes);
      // Schedule notifications
      const hasPermission = await requestNotificationPermissions();
      if (hasPermission) scheduleWateringReminders(plantsRes);
    } catch (e: any) {
      console.log('Fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const isWateredToday = (plantId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return wateringLogs.find(l => l.plant_id === plantId && l.watered_at?.startsWith(today));
  };

  const toggleWater = async (plant: any) => {
    const todayLog = isWateredToday(plant.id);
    try {
      if (todayLog) {
        await api.del(`/watering-logs/${todayLog.id}`);
        showToast(`${plant.nickname} watering undone`, 'undo');
      } else {
        await api.post(`/plants/${plant.id}/water`);
        playWaterSound();
        showToast(`${plant.nickname} watered successfully!`, 'success');
      }
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Room management
  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      await api.post('/rooms', { name: newRoomName.trim() });
      setNewRoomName('');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleRenameRoom = async () => {
    if (!editingRoomOld || !editingRoomNew.trim()) return;
    try {
      await api.put(`/rooms/${encodeURIComponent(editingRoomOld)}`, { name: editingRoomNew.trim() });
      setEditingRoomOld(null);
      setEditingRoomNew('');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteRoom = async (name: string) => {
    Alert.alert('Delete Room', `Remove "${name}"? Plants will be unassigned.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.del(`/rooms/${encodeURIComponent(name)}`);
            if (selectedRoom === name) setSelectedRoom('All');
            fetchData();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  // Change password
  const handleChangePassword = async () => {
    if (!cpOld || !cpNew || !cpConfirm) return Alert.alert('Error', 'Fill all fields');
    if (cpNew !== cpConfirm) return Alert.alert('Error', 'Passwords do not match');
    if (cpNew.length < 8) return Alert.alert('Error', 'Password must be at least 8 characters');
    setCpLoading(true);
    try {
      await api.post('/auth/change-password', { old_password: cpOld, new_password: cpNew });
      Alert.alert('Success', 'Password changed');
      setShowChangePw(false);
      setCpOld(''); setCpNew(''); setCpConfirm('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCpLoading(false);
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
      <TouchableOpacity testID={`plant-card-${item.id}`} style={styles.card} onPress={() => router.push(`/plant/${item.id}`)} activeOpacity={0.8}>
        <View style={styles.cardImageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.cardImage} contentFit="cover" />
          ) : (
            <View style={[styles.cardImage, styles.cardPlaceholder]}><Ionicons name="leaf" size={40} color={Colors.primary} /></View>
          )}
          <TouchableOpacity testID={`water-toggle-${item.id}`} style={[styles.waterBtn, watered && styles.waterBtnDone]} onPress={() => toggleWater(item)} activeOpacity={0.7}>
            {watered ? <Feather name="check-circle" size={20} color={Colors.primary} /> : <Ionicons name="water" size={20} color={Colors.blue} />}
          </TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardNickname} numberOfLines={1}>{item.nickname}</Text>
          <Text style={styles.cardCommon} numberOfLines={1}>{item.common_name || item.scientific_name || 'Unknown'}</Text>
          {item.location && (
            <View style={styles.roomBadge}><Text style={styles.roomBadgeText}>{item.location}</Text></View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Toast */}
      {toast && (
        <Animated.View style={[styles.toastWrap, { opacity: toastOpacity }]}>
          <View style={[styles.toast, toast.type === 'undo' ? styles.toastUndo : styles.toastSuccess]}>
            <Feather name={toast.type === 'undo' ? 'rotate-ccw' : 'check-circle'} size={16} color={Colors.white} />
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Plant Parent'}</Text>
          <Text style={styles.title}>My Plants</Text>
        </View>
        <TouchableOpacity testID="menu-btn" onPress={() => setShowDrawer(true)} style={styles.menuBtn}>
          <Feather name="menu" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Room Filter */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', ...rooms].map(room => (
            <TouchableOpacity key={room} testID={`room-filter-${room}`} style={[styles.filterPill, selectedRoom === room && styles.filterPillActive]} onPress={() => setSelectedRoom(room)}>
              <Text style={[styles.filterText, selectedRoom === room && styles.filterTextActive]}>{room}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity testID="edit-rooms-btn" style={styles.editRoomsBtn} onPress={() => setShowRoomEdit(true)}>
          <Feather name="edit-3" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Plant Grid */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={64} color={Colors.textTertiary} />
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity testID="add-plant-fab" style={styles.fab} onPress={() => router.push('/plant/add')} activeOpacity={0.8}>
        <Feather name="plus" size={28} color={Colors.white} />
      </TouchableOpacity>

      {/* Drawer Menu */}
      <Modal visible={showDrawer} transparent animationType="fade" onRequestClose={() => setShowDrawer(false)}>
        <Pressable style={styles.drawerOverlay} onPress={() => setShowDrawer(false)}>
          <Pressable style={styles.drawerPanel} onPress={() => {}}>
            <SafeAreaView>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerAvatar}>
                  <Feather name="user" size={24} color={Colors.primary} />
                </View>
                <Text style={styles.drawerName}>{user?.name || 'User'}</Text>
                <Text style={styles.drawerEmail}>{user?.email || ''}</Text>
              </View>
              <View style={styles.drawerDivider} />
              <TouchableOpacity testID="drawer-change-pw" style={styles.drawerItem} onPress={() => { setShowDrawer(false); setTimeout(() => setShowChangePw(true), 200); }}>
                <Feather name="lock" size={20} color={Colors.textPrimary} />
                <Text style={styles.drawerItemText}>Change Password</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="drawer-edit-rooms" style={styles.drawerItem} onPress={() => { setShowDrawer(false); setTimeout(() => setShowRoomEdit(true), 200); }}>
                <Feather name="grid" size={20} color={Colors.textPrimary} />
                <Text style={styles.drawerItemText}>Manage Rooms</Text>
              </TouchableOpacity>
              <View style={styles.drawerDivider} />
              <TouchableOpacity testID="drawer-logout" style={styles.drawerItem} onPress={() => { setShowDrawer(false); logout(); router.replace('/auth'); }}>
                <Feather name="log-out" size={20} color={Colors.error} />
                <Text style={[styles.drawerItemText, { color: Colors.error }]}>Sign Out</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Room Edit Modal */}
      <Modal visible={showRoomEdit} transparent animationType="slide" onRequestClose={() => setShowRoomEdit(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowRoomEdit(false)}>
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Manage Rooms</Text>
                <TouchableOpacity testID="close-room-edit" onPress={() => setShowRoomEdit(false)}>
                  <Feather name="x" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              {/* Add room */}
              <View style={styles.addRoomRow}>
                <TextInput testID="new-room-input" style={styles.roomInput} placeholder="New room name" placeholderTextColor={Colors.textTertiary} value={newRoomName} onChangeText={setNewRoomName} />
                <TouchableOpacity testID="add-room-btn" style={styles.addRoomBtn} onPress={handleAddRoom}>
                  <Feather name="plus" size={20} color={Colors.white} />
                </TouchableOpacity>
              </View>
              {/* Room list */}
              <ScrollView style={{ maxHeight: 300 }}>
                {rooms.length === 0 ? (
                  <Text style={styles.noRooms}>No rooms yet. Add one above.</Text>
                ) : (
                  rooms.map(room => (
                    <View key={room} style={styles.roomRow}>
                      {editingRoomOld === room ? (
                        <View style={styles.roomEditRow}>
                          <TextInput style={styles.roomEditInput} value={editingRoomNew} onChangeText={setEditingRoomNew} autoFocus />
                          <TouchableOpacity onPress={handleRenameRoom} style={styles.roomActionBtn}>
                            <Feather name="check" size={18} color={Colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setEditingRoomOld(null)} style={styles.roomActionBtn}>
                            <Feather name="x" size={18} color={Colors.textTertiary} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.roomName}>{room}</Text>
                          <View style={styles.roomActions}>
                            <TouchableOpacity testID={`rename-room-${room}`} onPress={() => { setEditingRoomOld(room); setEditingRoomNew(room); }} style={styles.roomActionBtn}>
                              <Feather name="edit-2" size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity testID={`delete-room-${room}`} onPress={() => handleDeleteRoom(room)} style={styles.roomActionBtn}>
                              <Feather name="trash-2" size={16} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showChangePw} transparent animationType="slide" onRequestClose={() => setShowChangePw(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowChangePw(false)}>
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <TouchableOpacity testID="close-change-pw" onPress={() => setShowChangePw(false)}>
                  <Feather name="x" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>Current Password</Text>
              <TextInput testID="cp-old-input" style={styles.cpInput} value={cpOld} onChangeText={setCpOld} secureTextEntry placeholder="Enter current password" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>New Password</Text>
              <TextInput testID="cp-new-input" style={styles.cpInput} value={cpNew} onChangeText={setCpNew} secureTextEntry placeholder="Enter new password" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>Confirm New Password</Text>
              <TextInput testID="cp-confirm-input" style={styles.cpInput} value={cpConfirm} onChangeText={setCpConfirm} secureTextEntry placeholder="Confirm new password" placeholderTextColor={Colors.textTertiary} />
              <TouchableOpacity testID="change-pw-submit" style={styles.primaryBtn} onPress={handleChangePassword} disabled={cpLoading} activeOpacity={0.7}>
                {cpLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Update Password</Text>}
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  // Toast
  toastWrap: { position: 'absolute', top: 60, left: 0, right: 0, zIndex: 999, alignItems: 'center', pointerEvents: 'none' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.pill },
  toastSuccess: { backgroundColor: Colors.primary },
  toastUndo: { backgroundColor: Colors.surfaceHighlight },
  toastText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.l, paddingTop: 12, paddingBottom: 12 },
  headerLeft: { gap: 2 },
  greeting: { fontSize: 13, color: Colors.textSecondary },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  menuBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  // Filter
  filterBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingRight: Spacing.s },
  filterScroll: { paddingLeft: Spacing.l, paddingRight: 8, gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  filterTextActive: { color: Colors.white },
  editRoomsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  // Grid
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
  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary },
  // FAB
  fab: { position: 'absolute', bottom: 24, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  // Drawer
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', justifyContent: 'flex-end' },
  drawerPanel: { width: 280, backgroundColor: Colors.surface, paddingHorizontal: 20, paddingTop: 20 },
  drawerHeader: { marginBottom: 20, alignItems: 'center' },
  drawerAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  drawerName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  drawerEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  drawerDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  drawerItemText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.l, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.l },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  // Room edit
  addRoomRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  roomInput: { flex: 1, backgroundColor: Colors.background, borderRadius: Radius.m, padding: 12, color: Colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: Colors.border, height: 46 },
  addRoomBtn: { width: 46, height: 46, borderRadius: Radius.m, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  noRooms: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 20 },
  roomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  roomName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  roomActions: { flexDirection: 'row', gap: 8 },
  roomActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  roomEditRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  roomEditInput: { flex: 1, backgroundColor: Colors.background, borderRadius: Radius.s, padding: 8, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.primary, height: 36 },
  // Change password
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', marginBottom: 6 },
  cpInput: { backgroundColor: Colors.background, borderRadius: Radius.m, padding: 14, color: Colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, height: 48 },
  primaryBtn: { backgroundColor: Colors.primary, height: 52, borderRadius: Radius.pill, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
