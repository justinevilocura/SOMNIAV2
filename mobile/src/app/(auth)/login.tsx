import { View, Text, TouchableOpacity, Image, TextInput, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react'
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

    const router = useRouter();

    // Use localhost for web development
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.0.0.3:4000';

    const handleLogin = async () => {
        setIsLoading(true);


        // Create user data object
        const userData = {
            email,
            password
        };

        try {
            // Send POST request to the backend to login
            console.log('Attempting login to:', `${backendUrl}/api/auth/login`);
            const response = await axios.post(`${backendUrl}/api/auth/login`, userData, {
                headers: {
                    'Content-Type': 'application/json',
                },
                withCredentials: true,
            });

            // Handle successful login
            if (response.data.success) {
                console.log('Login successful, response:', response.data);
                // Extract token from response body
                const token = response.data.token;

                if (token) {
                    // Store the raw token for API requests
                    await AsyncStorage.setItem('token', token);

                    // Store auth data
                    const authData = {
                        token,
                        timestamp: new Date().getTime(),
                        isAuthenticated: true,
                        email: email,
                        name: email.split('@')[0],
                        user_id: response.data.user_id
                    };
                    await AsyncStorage.setItem('authData', JSON.stringify(authData));
                }

                Toast.show({
                    type: 'success',
                    text1: 'Login successful!',
                });
                router.replace('/home');
            } else {
                console.log('Login failed, response:', response.data);
                Toast.show({
                    type: 'error',
                    text1: 'Login failed',
                    text2: 'Please try again.',
                });
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

    return (
        <LinearGradient
            colors={['#101522', '#18213a', '#2d325a']}
            style={{ flex: 1 }}
        >
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
                    <TouchableOpacity>
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
                    <TouchableOpacity style={[styles.socialBtnFull, { marginRight: 6 }]}>
                        <Image source={require('../../assets/images/google.png')} style={styles.socialIconFull} />
                        <Text style={styles.socialBtnText}>Google</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.socialBtnFull, { marginLeft: 6 }]}>
                        <Image source={require('../../assets/images/facebook.png')} style={styles.socialIconFull} />
                        <Text style={styles.socialBtnText}>Facebook</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </LinearGradient>
    );
}