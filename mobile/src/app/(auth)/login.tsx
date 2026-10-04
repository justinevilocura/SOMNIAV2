import { View, Text, TouchableOpacity, Image, TextInput, Pressable, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react'
import { useRouter, Link } from 'expo-router'
import axios from 'axios';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from '../../assets/styles/login.styles';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // Forgot Password modal state
    const [forgotVisible, setForgotVisible] = useState(false);
    const [fpStep, setFpStep] = useState<'email' | 'otp' | 'done'>('email');
    const [fpEmail, setFpEmail] = useState('');
    const [fpOtp, setFpOtp] = useState('');
    const [fpNewPassword, setFpNewPassword] = useState('');
    const [fpShowPassword, setFpShowPassword] = useState(false);
    const [fpLoading, setFpLoading] = useState(false);

    const router = useRouter();
    const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://somniav2-production.up.railway.app';

    // ─── Google Sign-In (requires new APK build with expo-web-browser) ───
    const handleGoogleLogin = () => {
        Toast.show({
            type: 'info',
            text1: 'Rebuild Required',
            text2: 'Google Sign-In will be available in the next app build.',
        });
    };

    // Load saved credentials on mount
    useEffect(() => {
        const loadSavedCredentials = async () => {
            try {
                const saved = await AsyncStorage.getItem('rememberedCredentials');
                if (saved) {
                    const { email: savedEmail, password: savedPassword } = JSON.parse(saved);
                    setEmail(savedEmail || '');
                    setPassword(savedPassword || '');
                    setRememberMe(true);
                }
            } catch (e) {
                console.warn('Could not load saved credentials:', e);
            }
        };
        loadSavedCredentials();
    }, []);

    const handleLogin = async () => {
        setIsLoading(true);
        const userData = { email, password };

        try {
            console.log('Attempting login to:', `${backendUrl}/api/auth/login`);
            const response = await axios.post(`${backendUrl}/api/auth/login`, userData, {
                headers: { 'Content-Type': 'application/json' },
                withCredentials: true,
                timeout: 15000,
            });

            if (response.data.success) {
                console.log('Login successful, response:', response.data);
                const token = response.data.token;

                if (token) {
                    await AsyncStorage.setItem('token', token);
                    const authData = {
                        token,
                        timestamp: new Date().getTime(),
                        isAuthenticated: true,
                        email: email,
                        name: email.split('@')[0],
                        user_id: response.data.user_id
                    };
                    await AsyncStorage.setItem('authData', JSON.stringify(authData));

                    // Save or clear remembered credentials based on checkbox
                    if (rememberMe) {
                        await AsyncStorage.setItem('rememberedCredentials', JSON.stringify({ email, password }));
                    } else {
                        await AsyncStorage.removeItem('rememberedCredentials');
                    }
                }

                Toast.show({ type: 'success', text1: 'Login successful!' });
                router.replace('/home');
            } else {
                Toast.show({ type: 'error', text1: 'Login failed', text2: 'Please try again.' });
            }
        } catch (error) {
            console.error('Login error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                url: error.config?.url
            });
            Toast.show({
                type: 'error',
                text1: 'Login Error',
                text2: error.response?.data?.message || 'An error occurred. Please try again later.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // --- Forgot Password Handlers ---
    const openForgotPassword = () => {
        setFpEmail('');
        setFpOtp('');
        setFpNewPassword('');
        setFpStep('email');
        setForgotVisible(true);
    };

    const handleSendOtp = async () => {
        if (!fpEmail.trim()) {
            Toast.show({ type: 'error', text1: 'Please enter your email' });
            return;
        }
        setFpLoading(true);
        try {
            const response = await axios.post(
                `${backendUrl}/api/auth/send-reset-otp`,
                { email: fpEmail.trim() },
                { timeout: 15000 }
            );
            if (response.data.success) {
                Toast.show({ type: 'success', text1: 'OTP Sent!', text2: 'Check your email for the reset code.' });
                setFpStep('otp');
            } else {
                Toast.show({ type: 'error', text1: 'Failed', text2: response.data.message || 'Could not send OTP.' });
            }
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Could not send OTP.' });
        } finally {
            setFpLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!fpOtp.trim() || !fpNewPassword.trim()) {
            Toast.show({ type: 'error', text1: 'Please fill in all fields' });
            return;
        }
        if (fpNewPassword.length < 6) {
            Toast.show({ type: 'error', text1: 'Password too short', text2: 'Must be at least 6 characters.' });
            return;
        }
        setFpLoading(true);
        try {
            const response = await axios.post(
                `${backendUrl}/api/auth/reset-password`,
                { email: fpEmail.trim(), otp: fpOtp.trim(), newPassword: fpNewPassword },
                { timeout: 15000 }
            );
            if (response.data.success) {
                setFpStep('done');
            } else {
                Toast.show({ type: 'error', text1: 'Failed', text2: response.data.message || 'Could not reset password.' });
            }
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Could not reset password.' });
        } finally {
            setFpLoading(false);
        }
    };

    return (
        <LinearGradient colors={['#101522', '#18213a', '#2d325a']} style={{ flex: 1 }}>
            <View style={styles.headerContainer}>
                <Image source={require('../../assets/images/somnia.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <View style={styles.cardNew}>
                {/* Tab Switcher */}
                <View style={styles.tabSwitcher}>
                    <View style={[styles.tab, styles.tabActive]}><Text style={styles.tabTextActive}>Log In</Text></View>
                    <Pressable style={styles.tab} onPress={() => router.push('/(auth)/register')}>
                        <Text style={styles.tabText}>Sign Up</Text>
                    </Pressable>
                </View>
                {/* Email */}
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.inputNew}
                        placeholder="Enter your email"
                        placeholderTextColor="#aaa"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>
                {/* Password */}
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.inputNew}
                        placeholder="Enter your password"
                        placeholderTextColor="#aaa"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Icon name={showPassword ? 'eye-off' : 'eye'} size={22} color="#888" style={styles.eyeIcon} />
                    </TouchableOpacity>
                </View>
                {/* Remember me and Forgot Password */}
                <View style={styles.rowBetween}>
                    <TouchableOpacity style={styles.rememberMe} onPress={() => setRememberMe(!rememberMe)}>
                        <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]} />
                        <Text style={styles.rememberMeText}>Remember me</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={openForgotPassword}>
                        <Text style={styles.forgotText}>Forgot Password ?</Text>
                    </TouchableOpacity>
                </View>
                {/* Log In Button */}
                <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={isLoading}>
                    <Text style={styles.loginButtonText}>{isLoading ? 'Loading...' : 'Log In'}</Text>
                </TouchableOpacity>
                {/* Divider */}
                <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.orText}>Or</Text>
                    <View style={styles.dividerLine} />
                </View>
                {/* Social Buttons */}
                <View style={styles.socialRow}>
                    <TouchableOpacity
                        style={[styles.socialBtnFull, { marginRight: 6 }]}
                        onPress={handleGoogleLogin}
                    >
                        <Image source={require('../../assets/images/google.png')} style={styles.socialIconFull} />
                        <Text style={styles.socialBtnText}>Google</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.socialBtnFull, { marginLeft: 6 }]}
                        onPress={() => Toast.show({ type: 'info', text1: 'Coming Soon', text2: 'Facebook login is not yet available.' })}
                    >
                        <Image source={require('../../assets/images/facebook.png')} style={styles.socialIconFull} />
                        <Text style={styles.socialBtnText}>Facebook</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ====== Forgot Password Modal ====== */}
            <Modal visible={forgotVisible} transparent animationType="fade" onRequestClose={() => setForgotVisible(false)}>
                <View style={fpStyles.overlay}>
                    <View style={fpStyles.card}>
                        {/* Close button */}
                        <TouchableOpacity style={fpStyles.closeBtn} onPress={() => setForgotVisible(false)}>
                            <Icon name="close" size={22} color="#aaa" />
                        </TouchableOpacity>

                        {/* Step 1: Enter Email */}
                        {fpStep === 'email' && (
                            <>
                                <Icon name="lock-closed-outline" size={40} color="#a259ff" style={{ alignSelf: 'center', marginBottom: 12 }} />
                                <Text style={fpStyles.title}>Forgot Password</Text>
                                <Text style={fpStyles.subtitle}>Enter your email address and we'll send you a reset code.</Text>
                                <Text style={fpStyles.label}>Email Address</Text>
                                <TextInput
                                    style={fpStyles.input}
                                    placeholder="Enter your email"
                                    placeholderTextColor="#666"
                                    value={fpEmail}
                                    onChangeText={setFpEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoFocus
                                />
                                <TouchableOpacity style={fpStyles.btn} onPress={handleSendOtp} disabled={fpLoading}>
                                    {fpLoading
                                        ? <ActivityIndicator color="#fff" />
                                        : <Text style={fpStyles.btnText}>Send Reset Code</Text>
                                    }
                                </TouchableOpacity>
                            </>
                        )}

                        {/* Step 2: Enter OTP + New Password */}
                        {fpStep === 'otp' && (
                            <>
                                <Icon name="mail-outline" size={40} color="#a259ff" style={{ alignSelf: 'center', marginBottom: 12 }} />
                                <Text style={fpStyles.title}>Check Your Email</Text>
                                <Text style={fpStyles.subtitle}>
                                    We sent a 6-digit code to{' '}
                                    <Text style={{ color: '#a259ff' }}>{fpEmail}</Text>.
                                    {'\n'}Enter it below along with your new password.
                                </Text>
                                <Text style={fpStyles.label}>Reset Code (OTP)</Text>
                                <TextInput
                                    style={fpStyles.input}
                                    placeholder="Enter 6-digit OTP"
                                    placeholderTextColor="#666"
                                    value={fpOtp}
                                    onChangeText={setFpOtp}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />
                                <Text style={fpStyles.label}>New Password</Text>
                                <View style={fpStyles.inputRow}>
                                    <TextInput
                                        style={[fpStyles.input, { flex: 1, marginBottom: 0 }]}
                                        placeholder="Enter new password"
                                        placeholderTextColor="#666"
                                        value={fpNewPassword}
                                        onChangeText={setFpNewPassword}
                                        secureTextEntry={!fpShowPassword}
                                    />
                                    <TouchableOpacity onPress={() => setFpShowPassword(!fpShowPassword)} style={fpStyles.eyeBtn}>
                                        <Icon name={fpShowPassword ? 'eye-off' : 'eye'} size={20} color="#888" />
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity style={[fpStyles.btn, { marginTop: 16 }]} onPress={handleResetPassword} disabled={fpLoading}>
                                    {fpLoading
                                        ? <ActivityIndicator color="#fff" />
                                        : <Text style={fpStyles.btnText}>Reset Password</Text>
                                    }
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setFpStep('email')} style={{ marginTop: 12, alignSelf: 'center' }}>
                                    <Text style={{ color: '#a259ff', fontSize: 13 }}>← Resend code</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {/* Step 3: Success */}
                        {fpStep === 'done' && (
                            <>
                                <Icon name="checkmark-circle-outline" size={56} color="#43e97b" style={{ alignSelf: 'center', marginBottom: 12 }} />
                                <Text style={fpStyles.title}>Password Reset!</Text>
                                <Text style={fpStyles.subtitle}>
                                    Your password has been reset successfully.{'\n'}You can now log in with your new password.
                                </Text>
                                <TouchableOpacity style={fpStyles.btn} onPress={() => setForgotVisible(false)}>
                                    <Text style={fpStyles.btnText}>Back to Login</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </LinearGradient>
    );
}

const fpStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        backgroundColor: '#18213a',
        borderRadius: 20,
        padding: 28,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(162,89,255,0.25)',
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 10,
        padding: 4,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        color: '#aaa',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    label: {
        color: '#ccc',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#0d1527',
        borderWidth: 1,
        borderColor: 'rgba(162,89,255,0.3)',
        borderRadius: 10,
        color: '#fff',
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        marginBottom: 14,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0d1527',
        borderWidth: 1,
        borderColor: 'rgba(162,89,255,0.3)',
        borderRadius: 10,
        marginBottom: 4,
    },
    eyeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    btn: {
        backgroundColor: '#a259ff',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    btnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
});