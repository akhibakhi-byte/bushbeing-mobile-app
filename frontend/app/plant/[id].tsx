import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal, Platform,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/api';
import { Colors, Spacing, Radius } from '../../src/theme';
import { playWaterSound } from '../../src/sounds';

export default function PlantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plant, setPlant] = useState<any>(null);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [journalNotes, setJournalNotes] = useState('');
  const [journalPhoto, setJournalPhoto] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editFrequency, setEditFrequency] = useState('');

  // Room management within edit
  const [showRoomEdit, setShowRoomEdit] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const fetchData = async () => {
    try {
      const [plantsRes, logsRes, roomsRes] = await Promise.all([
        api.get('/plants'),
        api.get(`/health-logs/${id}`),
        api.get('/rooms'),
      ]);
      const found = plantsRes.find((p: any) => p.id === id);
      setPlant(found);
      setHealthLogs(logsRes);
      setRooms(roomsRes.rooms || []);
      if (found) {
        setEditNickname(found.nickname || '');
        setEditLocation(found.location || '');
        setEditFrequency(found.watering_frequency_days?.toString() || '7');
      }
    } catch (e: any) {
      console.log('Error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const getPlantImage = (p: any) => {
    if (p?.images?.length > 0) {
      const img = p.images[0];
      return img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
    }
    return p?.placeholder_image || null;
  };

  const handleWater = async () => {
    try {
      await api.post(`/plants/${id}/water`);
      playWaterSound();
      Alert.alert('Watered!', `${plant.nickname} has been watered`);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Plant', `Remove ${plant?.nickname}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await api.del(`/plants/${id}`); router.back(); } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleEdit = async () => {
    try {
      await api.put(`/plants/${id}`, {
        nickname: editNickname,
        location: editLocation || undefined,
        watering_frequency_days: parseInt(editFrequency) || 7,
      });
      setShowEditModal(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const res = await api.post('/rooms', { name: newRoomName.trim() });
      setRooms(res.rooms || [...rooms, newRoomName.trim()]);
      setEditLocation(newRoomName.trim());
      setNewRoomName('');
      setShowRoomEdit(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const pickJournalPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, allowsEditing: true });
    if (!result.canceled && result.assets[0].base64) setJournalPhoto(result.assets[0].base64);
  };

  const submitJournal = async () => {
    if (!journalNotes.trim()) return Alert.alert('Error', 'Please add notes');
    try {
      await api.post('/health-logs', { plant_id: id, notes: journalNotes.trim(), photo: journalPhoto || undefined });
      setShowJournalModal(false);
      setJournalNotes('');
      setJournalPhoto(null);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const deleteLog = async (logId: string) => {
    try { await api.del(`/health-logs/${logId}`); fetchData(); } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  if (!plant) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.center}><Text style={{ color: Colors.textTertiary, fontSize: 16 }}>Plant not found</Text></View>
      </SafeAreaView>
    );
  }

  const imgUri = getPlantImage(plant);
  const care = plant.care_info || {};
  const careItems = [
    { icon: 'water-outline', label: 'Watering', value: care.watering || `Every ${plant.watering_frequency_days || 7} days` },
    { icon: 'sunny-outline', label: 'Sunlight', value: care.sunlight || 'Bright indirect' },
    { icon: 'water', label: 'Humidity', value: care.humidity || 'Moderate' },
    { icon: 'thermometer-outline', label: 'Temperature', value: care.temperature || '60-75°F' },
    { icon: 'leaf-outline', label: 'Soil', value: care.soil || 'Well-draining' },
    { icon: 'flask-outline', label: 'Fertilizer', value: care.fertilizer || 'Monthly' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          {imgUri ? (
            <Image source={{ uri: imgUri }} style={styles.heroImg} contentFit="cover" />
          ) : (
            <View style={[styles.heroImg, styles.heroPlaceholder]}><Ionicons name="leaf" size={80} color={Colors.primary} /></View>
          )}
          <SafeAreaView style={styles.heroNav}>
            <TouchableOpacity testID="detail-back-btn" style={styles.navBtn} onPress={() => router.back()}>
              <Feather name="chevron-left" size={24} color={Colors.white} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.nickname}>{plant.nickname}</Text>
          {plant.common_name && <Text style={styles.commonName}>{plant.common_name}</Text>}
          {plant.scientific_name && <Text style={styles.sciName}>{plant.scientific_name}</Text>}
          {plant.location && (
            <View style={styles.locBadge}>
              <Feather name="map-pin" size={12} color={Colors.primary} />
              <Text style={styles.locText}>{plant.location}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity testID="water-now-btn" style={styles.actionBtnPrimary} onPress={handleWater} activeOpacity={0.7}>
            <Ionicons name="water" size={20} color={Colors.white} />
            <Text style={styles.actionBtnPrimaryText}>Water Now</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="edit-plant-btn" style={styles.actionBtn} onPress={() => setShowEditModal(true)} activeOpacity={0.7}>
            <Feather name="edit-2" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity testID="delete-plant-btn" style={styles.actionBtn} onPress={handleDelete} activeOpacity={0.7}>
            <Feather name="trash-2" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Care Guide</Text>
          <View style={styles.careGrid}>
            {careItems.map((item, i) => (
              <View key={i} style={styles.careItem}>
                <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.careLabel}>{item.label}</Text>
                  <Text style={styles.careValue} numberOfLines={2}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Health Journal</Text>
            <TouchableOpacity testID="add-journal-btn" style={styles.addJournalBtn} onPress={() => setShowJournalModal(true)}>
              <Feather name="plus" size={16} color={Colors.primary} />
              <Text style={styles.addJournalText}>Add Entry</Text>
            </TouchableOpacity>
          </View>
          {healthLogs.length === 0 ? (
            <Text style={{ color: Colors.textTertiary, fontSize: 14 }}>No journal entries yet</Text>
          ) : (
            healthLogs.map(log => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logDate}>{new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  <TouchableOpacity testID={`delete-log-${log.id}`} onPress={() => deleteLog(log.id)}><Feather name="x" size={16} color={Colors.textTertiary} /></TouchableOpacity>
                </View>
                <Text style={styles.logNotes}>{log.notes}</Text>
                {log.photo && <Image source={{ uri: `data:image/jpeg;base64,${log.photo}` }} style={styles.logPhoto} contentFit="cover" />}
              </View>
            ))
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Journal Modal */}
      <Modal visible={showJournalModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowJournalModal(false)}>
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Journal Entry</Text>
                <TouchableOpacity testID="close-journal-modal" onPress={() => setShowJournalModal(false)}><Feather name="x" size={24} color={Colors.textPrimary} /></TouchableOpacity>
              </View>
              <TextInput testID="journal-notes-input" style={styles.journalInput} placeholder="How is your plant doing?" placeholderTextColor={Colors.textTertiary} value={journalNotes} onChangeText={setJournalNotes} multiline textAlignVertical="top" />
              <TouchableOpacity testID="journal-photo-btn" style={styles.photoPickBtn} onPress={pickJournalPhoto}>
                <Feather name="camera" size={18} color={Colors.primary} />
                <Text style={styles.photoPickText}>{journalPhoto ? 'Photo selected' : 'Add photo (optional)'}</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="submit-journal-btn" style={styles.primaryBtn} onPress={submitJournal} activeOpacity={0.7}>
                <Text style={styles.primaryBtnText}>Save Entry</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowEditModal(false)}>
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Plant</Text>
                <TouchableOpacity testID="close-edit-modal" onPress={() => setShowEditModal(false)}><Feather name="x" size={24} color={Colors.textPrimary} /></TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>Nickname</Text>
              <TextInput testID="edit-nickname-input" style={styles.editInput} value={editNickname} onChangeText={setEditNickname} placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.fieldLabel}>Room</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomScroll}>
                <TouchableOpacity style={[styles.roomPill, !editLocation && styles.roomPillActive]} onPress={() => setEditLocation('')}>
                  <Text style={[styles.roomPillText, !editLocation && styles.roomPillTextActive]}>None</Text>
                </TouchableOpacity>
                {rooms.map(room => (
                  <TouchableOpacity key={room} testID={`edit-room-${room}`} style={[styles.roomPill, editLocation === room && styles.roomPillActive]} onPress={() => setEditLocation(room)}>
                    <Text style={[styles.roomPillText, editLocation === room && styles.roomPillTextActive]}>{room}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity testID="edit-manage-rooms-btn" style={styles.manageRoomsLink} onPress={() => setShowRoomEdit(true)}>
                <Feather name="edit-3" size={14} color={Colors.primary} />
                <Text style={styles.manageRoomsText}>Manage Rooms</Text>
              </TouchableOpacity>

              {/* Inline room add */}
              {showRoomEdit && (
                <View style={styles.inlineRoomAdd}>
                  <TextInput testID="inline-new-room" style={styles.inlineRoomInput} placeholder="New room name" placeholderTextColor={Colors.textTertiary} value={newRoomName} onChangeText={setNewRoomName} />
                  <TouchableOpacity testID="inline-add-room-btn" style={styles.inlineRoomBtn} onPress={handleAddRoom}>
                    <Feather name="plus" size={16} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.fieldLabel}>Watering Frequency (days)</Text>
              <TextInput testID="edit-frequency-input" style={styles.editInput} value={editFrequency} onChangeText={setEditFrequency} keyboardType="number-pad" placeholderTextColor={Colors.textTertiary} />
              <TouchableOpacity testID="save-edit-btn" style={styles.primaryBtn} onPress={handleEdit} activeOpacity={0.7}>
                <Text style={styles.primaryBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroWrap: { position: 'relative', height: 300 },
  heroImg: { width: '100%', height: 300, backgroundColor: Colors.surfaceHighlight },
  heroPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  heroNav: { position: 'absolute', top: 0, left: 0, right: 0 },
  navBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.m, marginTop: Spacing.s },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.m },
  infoSection: { padding: Spacing.l },
  nickname: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  commonName: { fontSize: 16, color: Colors.textSecondary, marginBottom: 2 },
  sciName: { fontSize: 14, color: Colors.textTertiary, fontStyle: 'italic', marginBottom: 8 },
  locBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  locText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  actionsRow: { flexDirection: 'row', paddingHorizontal: Spacing.l, gap: 10, marginBottom: Spacing.l },
  actionBtnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, height: 48, borderRadius: Radius.pill },
  actionBtnPrimaryText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  actionBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  section: { paddingHorizontal: Spacing.l, marginBottom: Spacing.l },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  careGrid: { gap: 10 },
  careItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: Radius.m, padding: 12, borderWidth: 1, borderColor: Colors.border },
  careLabel: { fontSize: 12, color: Colors.textSecondary },
  careValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  addJournalBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addJournalText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  logCard: { backgroundColor: Colors.surface, borderRadius: Radius.m, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  logDate: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  logNotes: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  logPhoto: { width: '100%', height: 150, borderRadius: Radius.s, marginTop: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.l, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.l },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  journalInput: { backgroundColor: Colors.background, borderRadius: Radius.m, padding: 14, height: 120, color: Colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  photoPickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.m, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', marginBottom: 16 },
  photoPickText: { fontSize: 14, color: Colors.textSecondary },
  primaryBtn: { backgroundColor: Colors.primary, height: 52, borderRadius: Radius.pill, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', marginBottom: 6 },
  editInput: { backgroundColor: Colors.background, borderRadius: Radius.m, padding: 14, color: Colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, height: 48 },
  roomScroll: { marginBottom: 8, maxHeight: 44 },
  roomPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  roomPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roomPillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  roomPillTextActive: { color: Colors.white },
  manageRoomsLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  manageRoomsText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  inlineRoomAdd: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  inlineRoomInput: { flex: 1, backgroundColor: Colors.background, borderRadius: Radius.m, padding: 10, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border, height: 40 },
  inlineRoomBtn: { width: 40, height: 40, borderRadius: Radius.m, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
});
