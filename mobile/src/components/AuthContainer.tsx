import { View, Image, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import styles from '../assets/styles/authcontainer.styles'
import { useFonts } from 'expo-font';
import { ReactNode } from 'react';

interface AuthContainerProps {
    children: ReactNode;
    authTitleImg: any;
    authType: string;
    authOnPress: () => void;
    authBtnLoading: boolean;
    goToLink: ReactNode;
}

export default function AuthContainer({ children, authTitleImg, authType, authOnPress, authBtnLoading, goToLink}: AuthContainerProps) {
    const [fontsLoaded] = useFonts({
        'RussoOne': require('../assets/fonts/RussoOne-Regular.ttf'),
    });

    if (!fontsLoaded) {
        return null;
    }

    return (
        <LinearGradient colors={['#1a1a2e', '#23234b']} style={styles.background}>
            <KeyboardAvoidingView
                style={{flex: 1}}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={styles.container}>
                    <Image
                        source={require('../assets/images/logo-glow-transparent.png')}
                        style={styles.backgroundLogo} />

                    <LinearGradient 
                        colors={['rgba(108, 63, 197, 0.85)', 'rgba(44, 62, 80, 0.85)']}
                        style={styles.absoluteFill} />
                    
                    <View style={styles.authContents}>
                        {/* Auth Contents */}
                        <View style={styles.appNameContainer}>
                            <Image 
                                source={require('../assets/images/somnia.png')}
                                resizeMode='contain'
                                style={styles.appName} />
                        </View>

                        <View>
                            <Image 
                                source={authTitleImg}
                                resizeMode='contain' 
                                style={styles.authTypeImg} />
                        </View>

                        {/* Inject content from other screens */}
                        {children}

                        <TouchableOpacity
                            onPress={authOnPress}
                            disabled={authBtnLoading}
                            style={styles.button} >
                            {authBtnLoading ? (<ActivityIndicator color='#ffffff' />) : (<Text style={styles.buttonText}>{authType}</Text>)}
                        </TouchableOpacity>

                        <View style={styles.bottomLine} />

                        {/* Footer */}
                        {goToLink}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
      );
}