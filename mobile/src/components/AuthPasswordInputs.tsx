import { View, TextInput, TouchableOpacity } from 'react-native';
import { useState } from 'react'
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../assets/styles/login.styles';

interface AuthPasswordInputsProps {
    icon: string;
    placeHolder: string;
    value: string;
    onChangeText: (text: string) => void;
}

export default function AuthPasswordInputs({ icon, placeHolder, value, onChangeText }: AuthPasswordInputsProps) {
    const [showPassword, setShowPassword] = useState(false);
    return (
        <View style={styles.inputContainer}>
            <Ionicons
              name={icon}
              size={20}
              style={styles.inputIcon}>
            </Ionicons>
            <TextInput 
              placeholder={placeHolder}
              placeholderTextColor={'#787878'}
              value={value}
              onChangeText={onChangeText}
              secureTextEntry={!showPassword}
              style={styles.input} />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)} 
              style={styles.eyeIcon}>
                <Ionicons 
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20} />
            </TouchableOpacity>
        </View>
      );
}