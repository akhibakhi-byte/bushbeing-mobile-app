import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../src/AuthContext';
import { Colors, Spacing, Radius } from '../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const BG_IMAGE = 'https://customer-assets.emergentagent.com/job_greenthumb-36/artifacts/ja89o0pk_indoor-plants-studio.jpg';

type Mode = 'login' | 'register' | 'otp' | 'forgot';

export default function AuthScreen() {
  const { login, requestOtp, verifyOtp, resendOtp, forgotPassword } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // OTP
  const [otp, setOtp] = useState(['', '', '', '']);
  const otpRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(120);

  // Forgot
  const [forgotEmail, setForgotEmail] = useState('');

  const startResendTimer = () => {
    setCanResend(false);
    setResendTimer(120);
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) return Alert.alert('Error', 'Please fill all fields');
    setLoading(true);
    try {
      await login(loginEmail.trim(), loginPassword);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regName || !regEmail || !regPassword) return Alert.alert('Error', 'Please fill all fields');
    const strength = getPasswordStrength(regPassword);
    if (strength.score < 5) return Alert.alert('Weak Password', 'Password needs min 8 chars, uppercase, lowercase, number, and special char');
    setLoading(true);
    try {
      await requestOtp(regEmail.trim(), regName.trim(), regPassword);
      setMode('otp');
      startResendTimer();
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async () => {
    const code = otp.join('');
    if (code.length < 4) return Alert.alert('Error', 'Enter 4-digit OTP');
    setLoading(true);
    try {
      await verifyOtp(regEmail.trim(), code, regName.trim(), regPassword);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Verification Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    try {
      await resendOtp(regEmail.trim());
      startResendTimer();
      Alert.alert('Success', 'OTP resent to your email');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleForgot = async () => {
    if (!forgotEmail) return Alert.alert('Error', 'Enter your email');
    setLoading(true);
    try {
      await forgotPassword(forgotEmail.trim());
      Alert.alert('Success', 'Reset link sent to your email');
      setMode('login');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 3) otpRefs[index + 1].current?.focus();
    if (!text && index > 0) otpRefs[index - 1].current?.focus();
  };

  const getPasswordStrength = (pw: string) => {
    const checks = {
      length: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      number: /[0-9]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
    };
    return { ...checks, score: Object.values(checks).filter(Boolean).length };
  };

  const pwStrength = getPasswordStrength(regPassword);

  const renderLogin = () => (
    <View>
      <View style={styles.inputWrap}>
        <Feather name="mail" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
        <TextInput
          testID="login-email-input"
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textTertiary}
          value={loginEmail}
          onChangeText={setLoginEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      <View style={styles.inputWrap}>
        <Feather name="lock" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
        <TextInput
          testID="login-password-input"
          style={[styles.input, { flex: 1 }]}
          placeholder="Password"
          placeholderTextColor={Colors.textTertiary}
          value={loginPassword}
          onChangeText={setLoginPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity testID="toggle-password-btn" onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
          <Feather name={showPassword ? 'eye' : 'eye-off'} size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity testID="forgot-password-link" onPress={() => setMode('forgot')}>
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="login-submit-btn" style={styles.primaryBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.7}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
      </TouchableOpacity>
    </View>
  );

  const renderRegister = () => (
    <View>
      <View style={styles.inputWrap}>
        <Feather name="user" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
        <TextInput
          testID="register-name-input"
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor={Colors.textTertiary}
          value={regName}
          onChangeText={setRegName}
        />
      </View>
      <View style={styles.inputWrap}>
        <Feather name="mail" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
        <TextInput
          testID="register-email-input"
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textTertiary}
          value={regEmail}
          onChangeText={setRegEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      <View style={styles.inputWrap}>
        <Feather name="lock" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
        <TextInput
          testID="register-password-input"
          style={[styles.input, { flex: 1 }]}
          placeholder="Password"
          placeholderTextColor={Colors.textTertiary}
          value={regPassword}
          onChangeText={setRegPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
          <Feather name={showPassword ? 'eye' : 'eye-off'} size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>
      {regPassword.length > 0 && (
        <View style={styles.strengthWrap}>
          <View style={styles.strengthBar}>
            <View style={[styles.strengthFill, { width: `${(pwStrength.score / 5) * 100}%`, backgroundColor: pwStrength.score >= 4 ? Colors.primary : pwStrength.score >= 2 ? Colors.warning : Colors.error }]} />
          </View>
          <View style={styles.strengthChecks}>
            {[
              { key: 'length', label: '8+ chars' },
              { key: 'upper', label: 'Uppercase' },
              { key: 'lower', label: 'Lowercase' },
              { key: 'number', label: 'Number' },
              { key: 'special', label: 'Special' },
            ].map(c => (
              <View key={c.key} style={styles.strengthCheck}>
                <Feather name={pwStrength[c.key as keyof typeof pwStrength] ? 'check-circle' : 'circle'} size={12} color={pwStrength[c.key as keyof typeof pwStrength] ? Colors.primary : Colors.textTertiary} />
                <Text style={[styles.strengthLabel, pwStrength[c.key as keyof typeof pwStrength] && { color: Colors.primary }]}>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <TouchableOpacity testID="register-submit-btn" style={styles.primaryBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.7}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
      </TouchableOpacity>
    </View>
  );

  const renderOtp = () => (
    <View style={styles.otpContainer}>
      <Feather name="mail" size={48} color={Colors.primary} style={{ alignSelf: 'center', marginBottom: 16 }} />
      <Text style={styles.otpTitle}>Verify Your Email</Text>
      <Text style={styles.otpSubtitle}>Enter the 4-digit code sent to {regEmail}</Text>
      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={otpRefs[i]}
            testID={`otp-input-${i}`}
            style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
            value={digit}
            onChangeText={text => handleOtpChange(text, i)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
          />
        ))}
      </View>
      <TouchableOpacity testID="verify-otp-btn" style={styles.primaryBtn} onPress={handleOtp} disabled={loading} activeOpacity={0.7}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify</Text>}
      </TouchableOpacity>
      <TouchableOpacity testID="resend-otp-btn" onPress={handleResend} disabled={!canResend}>
        <Text style={[styles.resendText, !canResend && { color: Colors.textTertiary }]}>
          {canResend ? 'Resend Code' : `Resend in ${Math.floor(resendTimer / 60)}:${(resendTimer % 60).toString().padStart(2, '0')}`}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity testID="otp-back-btn" onPress={() => setMode('register')}>
        <Text style={styles.backText}>Back to Register</Text>
      </TouchableOpacity>
    </View>
  );

  const renderForgot = () => (
    <View>
      <Feather name="key" size={48} color={Colors.primary} style={{ alignSelf: 'center', marginBottom: 16 }} />
      <Text style={styles.otpTitle}>Reset Password</Text>
      <Text style={styles.otpSubtitle}>Enter your email and we'll send a reset link</Text>
      <View style={styles.inputWrap}>
        <Feather name="mail" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
        <TextInput
          testID="forgot-email-input"
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textTertiary}
          value={forgotEmail}
          onChangeText={setForgotEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      <TouchableOpacity testID="forgot-submit-btn" style={styles.primaryBtn} onPress={handleForgot} disabled={loading} activeOpacity={0.7}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send Reset Link</Text>}
      </TouchableOpacity>
      <TouchableOpacity testID="forgot-back-btn" onPress={() => setMode('login')}>
        <Text style={styles.backText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Image source={{ uri: BG_IMAGE }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.overlay }]} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Logo Area */}
            <View style={styles.logoArea}>
              <View style={styles.logoIcon}>
                <Feather name="feather" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.appName}>bushbeing</Text>
              <Text style={styles.tagline}>Nurture your indoor garden</Text>
            </View>

            {/* Auth Card */}
            <View style={styles.card}>
              {mode === 'otp' ? renderOtp()
                : mode === 'forgot' ? renderForgot()
                : (
                  <>
                    {/* Tabs */}
                    <View style={styles.tabRow}>
                      <TouchableOpacity testID="login-tab" style={[styles.tab, mode === 'login' && styles.tabActive]} onPress={() => setMode('login')}>
                        <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Sign In</Text>
                      </TouchableOpacity>
                      <TouchableOpacity testID="register-tab" style={[styles.tab, mode === 'register' && styles.tabActive]} onPress={() => setMode('register')}>
                        <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Register</Text>
                      </TouchableOpacity>
                    </View>
                    {mode === 'login' ? renderLogin() : renderRegister()}
                  </>
                )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'space-between', padding: Spacing.l },
  logoArea: { alignItems: 'center', marginTop: 40, marginBottom: 24 },
  logoIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  appName: { fontSize: 36, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1 },
  tagline: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  card: { backgroundColor: 'rgba(26,26,26,0.92)', borderRadius: Radius.xl, padding: Spacing.l, borderWidth: 1, borderColor: Colors.border },
  tabRow: { flexDirection: 'row', marginBottom: Spacing.l, backgroundColor: Colors.surfaceHighlight, borderRadius: Radius.pill, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: Radius.pill, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.m, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, height: 50 },
  inputIcon: { marginLeft: 14 },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, paddingHorizontal: 12, height: 50 },
  eyeBtn: { padding: 14 },
  forgotText: { color: Colors.primary, fontSize: 13, textAlign: 'right', marginBottom: 16, fontWeight: '500' },
  primaryBtn: { backgroundColor: Colors.primary, height: 52, borderRadius: Radius.pill, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  strengthWrap: { marginBottom: 12 },
  strengthBar: { height: 4, backgroundColor: Colors.surfaceHighlight, borderRadius: 2, marginBottom: 8, overflow: 'hidden' },
  strengthFill: { height: 4, borderRadius: 2 },
  strengthChecks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  strengthCheck: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strengthLabel: { fontSize: 11, color: Colors.textTertiary },
  otpContainer: { alignItems: 'center' },
  otpTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  otpSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  otpRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  otpBox: { width: 56, height: 56, borderRadius: Radius.m, backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border, fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  otpBoxFilled: { borderColor: Colors.primary },
  resendText: { color: Colors.primary, fontSize: 14, fontWeight: '500', marginTop: 16, textAlign: 'center' },
  backText: { color: Colors.textSecondary, fontSize: 14, marginTop: 12, textAlign: 'center' },
});
