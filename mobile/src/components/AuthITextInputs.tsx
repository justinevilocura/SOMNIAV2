import { View, TextInput, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../assets/styles/login.styles';

interface AuthTextInputsProps {
    icon: string;
    placeHolder: string;
    value: string;
    onChangeText: (text: string) => void;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad';
}

export default function AuthTextInputs({ icon, placeHolder, value, onChangeText, keyboardType }: AuthTextInputsProps) {
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
                keyboardType={keyboardType}
                autoCapitalize='none'
                style={styles.input}/>
         </View>
      );
}