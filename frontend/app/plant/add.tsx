import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Dimensions,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/api';
import { Colors, Spacing, Radius } from '../../src/theme';

const { width } = Dimensions.get('window');

type Step = 'photos' | 'scanning' | 'results' | 'details';

export default function AddPlant() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('photos');
  const [images, setImages] = useState<{ uri: string; base64: string }[]>([]);
  const [identification, setIdentification] = useState<any>(null);
  const [multiResults, setMultiResults] = useState<any>(null);
  const [nickname, setNickname] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [rooms, setRooms] = useState<string[]>([]);
  const [newRoom, setNewRoom] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/rooms').then(r => setRooms(r.rooms || [])).catch(() => {});
  }, []);

  const pickImage = async (source: 'camera' | 'gallery') => {
    if (images.length >= 3) return Alert.alert('Limit', 'Maximum 3 photos allowed');
    const options: ImagePicker.ImagePickerOptions = { base64: true, quality: 0.7, allowsEditing: true };
    let result;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission needed', 'Camera access is required');
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission needed', 'Gallery access is required');
      result = await ImagePicker.launchImageLibraryAsync(options);
    }
    if (!result.canceled && result.assets[0].base64) {
      setImages([...images, { uri: result.assets[0].uri, base64: result.assets[0].base64 }]);
    }
  };

  const removeImage = (index: number) => setImages(images.filter((_, i) => i !== index));

  const identifyPlant = async () => {
    if (images.length === 0) return Alert.alert('Error', 'Please add at least one photo');
    setStep('scanning');
    setLoading(true);
    try {
      const formData = new FormData();
      images.forEach((img, i) => {
        formData.append('images', { uri: img.uri, type: 'image/jpeg', name: `plant_${i}.jpg` } as any);
      });
      let result;
      if (images.length > 1) {
        result = await api.postMultipart('/plants/identify-multi', formData);
        if (result.is_same_plant === false) { setMultiResults(result); setStep('results'); return; }
        const first = result.plants?.[0] || result;
        setIdentification({ scientific_name: first.scientific_name, common_name: first.common_names?.[0] || '', confidence: first.confidence, family: first.family, genus: first.genus, care_info: first.care_info });
      } else {
        result = await api.postMultipart('/plants/identify', formData);
        setIdentification({ scientific_name: result.scientific_name, common_name: result.common_names?.[0] || '', confidence: result.confidence, family: result.family, genus: result.genus, care_info: result.care_info });
      }
      setNickname(result.common_names?.[0] || result.plants?.[0]?.common_names?.[0] || '');
      setStep('results');
    } catch (e: any) {
      Alert.alert('Identification Failed', e.message);
      setStep('photos');
    } finally {
      setLoading(false);
    }
  };

  const handleMultiChoice = (choice: 'separate' | 'same' | 'back') => {
    if (choice === 'back') { setStep('photos'); setMultiResults(null); return; }
    if (choice === 'separate') { saveSeparatePlants(); return; }
    const first = multiResults.plants[0];
    setIdentification({ scientific_name: first.scientific_name, common_name: first.common_names?.[0] || '', confidence: first.confidence, family: first.family, genus: first.genus, care_info: first.care_info });
    setNickname(first.common_names?.[0] || '');
    setMultiResults(null);
  };

  const saveSeparatePlants = async () => {
    setLoading(true);
    try {
      for (const p of multiResults.plants) {
        await api.post('/plants', { nickname: p.common_names?.[0] || 'My Plant', location: selectedRoom || undefined, scientific_name: p.scientific_name, common_name: p.common_names?.[0], family: p.family, confidence: p.confidence, images: [images[p.image_index]?.base64].filter(Boolean), care_info: p.care_info });
      }
      Alert.alert('Success', `${multiResults.plants.length} plants added!`);
      router.back();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setLoading(false); }
  };

  const savePlant = async () => {
    if (!nickname.trim()) return Alert.alert('Error', 'Please enter a nickname');
    setLoading(true);
    try {
      const room = newRoom.trim() || selectedRoom;
      if (newRoom.trim() && !rooms.includes(newRoom.trim())) {
        await api.post('/rooms', { name: newRoom.trim() });
      }
      await api.post('/plants', { nickname: nickname.trim(), location: room || undefined, scientific_name: identification?.scientific_name, common_name: identification?.common_name, family: identification?.family, confidence: identification?.confidence, images: images.map(i => i.base64), care_info: identification?.care_info });
      Alert.alert('Success', `${nickname} added to your garden!`);
      router.back();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setLoading(false); }
  };

  const renderPhotosStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Add Photos</Text>
      <Text style={styles.stepSubtitle}>Take or select up to 3 photos of your plant</Text>

      {/* Image previews */}
      {images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewRow}>
          {images.map((img, i) => (
            <View key={i} style={styles.imageCard}>
              <Image source={{ uri: img.uri }} style={styles.imageThumb} contentFit="cover" />
              <TouchableOpacity testID={`remove-image-${i}`} style={styles.removeImgBtn} onPress={() => removeImage(i)}>
                <Feather name="x" size={14} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Camera & Gallery Buttons */}
      {images.length < 3 && (
        <View style={styles.pickRow}>
          <TouchableOpacity testID="pick-camera-btn" style={styles.pickCard} onPress={() => pickImage('camera')} activeOpacity={0.7}>
            <View style={styles.pickIconWrap}>
              <Feather name="camera" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.pickCardTitle}>Open Camera</Text>
            <Text style={styles.pickCardSub}>Take a photo</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="pick-gallery-btn" style={styles.pickCard} onPress={() => pickImage('gallery')} activeOpacity={0.7}>
            <View style={styles.pickIconWrap}>
              <Feather name="image" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.pickCardTitle}>Upload Photo</Text>
            <Text style={styles.pickCardSub}>From gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity testID="identify-btn" style={[styles.primaryBtn, images.length === 0 && styles.primaryBtnDisabled]} onPress={identifyPlant} disabled={images.length === 0} activeOpacity={0.7}>
        <Feather name="search" size={18} color={Colors.white} />
        <Text style={styles.primaryBtnText}>Identify Plant</Text>
      </TouchableOpacity>
    </View>
  );

  const renderScanning = () => (
    <View style={[styles.stepContent, styles.centerContent]}>
      <View style={styles.scanAnim}><ActivityIndicator size="large" color={Colors.primary} /></View>
      <Text style={styles.scanTitle}>Identifying Your Plant...</Text>
      <Text style={styles.scanSubtitle}>Analyzing photos with PlantNet AI</Text>
    </View>
  );

  const renderResults = () => {
    if (multiResults && !identification) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Multiple Plants Detected</Text>
          <Text style={styles.stepSubtitle}>{multiResults.message}</Text>
          {multiResults.plants?.map((p: any, i: number) => (
            <View key={i} style={styles.resultCard}>
              <Text style={styles.resultName}>{p.common_names?.[0] || p.scientific_name}</Text>
              <Text style={styles.resultSci}>{p.scientific_name}</Text>
              <Text style={styles.resultConf}>{Math.round((p.confidence || 0) * 100)}% match</Text>
            </View>
          ))}
          <TouchableOpacity testID="add-separate-btn" style={styles.primaryBtn} onPress={() => handleMultiChoice('separate')} activeOpacity={0.7}>
            <Text style={styles.primaryBtnText}>Add as {multiResults.plants?.length} Separate Plants</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="treat-same-btn" style={styles.secondaryBtn} onPress={() => handleMultiChoice('same')} activeOpacity={0.7}>
            <Text style={styles.secondaryBtnText}>Treat as Same Plant</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="retake-btn" onPress={() => handleMultiChoice('back')}><Text style={styles.linkText}>Go Back & Retake Photos</Text></TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.stepContent}>
        <View style={styles.idResultCard}>
          <Ionicons name="leaf" size={40} color={Colors.primary} style={{ alignSelf: 'center', marginBottom: 12 }} />
          <Text style={styles.idName}>{identification?.common_name || 'Unknown'}</Text>
          <Text style={styles.idSci}>{identification?.scientific_name}</Text>
          {identification?.confidence && (
            <View style={styles.confBadge}><Text style={styles.confText}>{Math.round(identification.confidence * 100)}% confidence</Text></View>
          )}
          {identification?.family && <Text style={styles.idFamily}>Family: {identification.family}</Text>}
        </View>
        <TouchableOpacity testID="next-details-btn" style={styles.primaryBtn} onPress={() => setStep('details')} activeOpacity={0.7}>
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="retake-photos-btn" onPress={() => { setStep('photos'); setIdentification(null); }}>
          <Text style={styles.linkText}>Retake Photos</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDetails = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.stepContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepTitle}>Plant Details</Text>
        <Text style={styles.stepSubtitle}>Give your plant a name and home</Text>
        <Text style={styles.fieldLabel}>Nickname *</Text>
        <TextInput testID="plant-nickname-input" style={styles.input} value={nickname} onChangeText={setNickname} placeholder="e.g., My Monstera" placeholderTextColor={Colors.textTertiary} />
        <Text style={styles.fieldLabel}>Room</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomScroll}>
          {rooms.map(room => (
            <TouchableOpacity key={room} testID={`select-room-${room}`} style={[styles.roomPill, selectedRoom === room && styles.roomPillActive]} onPress={() => { setSelectedRoom(room); setNewRoom(''); }}>
              <Text style={[styles.roomPillText, selectedRoom === room && styles.roomPillTextActive]}>{room}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput testID="new-room-input" style={[styles.input, { marginTop: 8 }]} value={newRoom} onChangeText={t => { setNewRoom(t); setSelectedRoom(''); }} placeholder="Or type a new room name" placeholderTextColor={Colors.textTertiary} />
        <TouchableOpacity testID="save-plant-btn" style={styles.primaryBtn} onPress={savePlant} disabled={loading} activeOpacity={0.7}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Add to Garden</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const steps: Step[] = ['photos', 'scanning', 'results', 'details'];
  const currentIdx = steps.indexOf(step);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="add-back-btn" style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Plant</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.progressRow}>
        {steps.map((s, i) => (
          <View key={s} style={[styles.progressDot, i <= currentIdx && styles.progressDotActive]} />
        ))}
      </View>
      {step === 'photos' && renderPhotosStep()}
      {step === 'scanning' && renderScanning()}
      {step === 'results' && renderResults()}
      {step === 'details' && renderDetails()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.m, paddingVertical: Spacing.s },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: Spacing.l },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.surfaceHighlight },
  progressDotActive: { backgroundColor: Colors.primary, width: 24 },
  stepContent: { flex: 1, paddingHorizontal: Spacing.l },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  stepTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  stepSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  // Image preview
  imagePreviewRow: { marginBottom: 20, maxHeight: 100 },
  imageCard: { width: 90, height: 90, borderRadius: Radius.m, overflow: 'hidden', marginRight: 10, position: 'relative' },
  imageThumb: { width: '100%', height: '100%' },
  removeImgBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  // Pick buttons - redesigned
  pickRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  pickCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.l, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  pickIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(16,185,129,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  pickCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  pickCardSub: { fontSize: 12, color: Colors.textSecondary },
  // Buttons
  primaryBtn: { flexDirection: 'row', backgroundColor: Colors.primary, height: 52, borderRadius: Radius.pill, justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  secondaryBtn: { backgroundColor: Colors.surfaceHighlight, height: 48, borderRadius: Radius.pill, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  linkText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 16 },
  // Scan
  scanAnim: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  scanTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  scanSubtitle: { fontSize: 14, color: Colors.textSecondary },
  // Results
  resultCard: { backgroundColor: Colors.surface, borderRadius: Radius.m, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  resultName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  resultSci: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },
  resultConf: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 4 },
  idResultCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  idName: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  idSci: { fontSize: 15, color: Colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginBottom: 12 },
  confBadge: { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.pill, marginBottom: 8 },
  confText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  idFamily: { fontSize: 13, color: Colors.textTertiary },
  // Details
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.m, padding: 14, color: Colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: Colors.border, marginBottom: 16, height: 50 },
  roomScroll: { marginBottom: 4, maxHeight: 44 },
  roomPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  roomPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roomPillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  roomPillTextActive: { color: Colors.white },
});
