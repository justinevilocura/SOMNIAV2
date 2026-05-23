import { Text, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../assets/styles/home.styles';
import { ReactElement } from 'react';

interface BottomNavProps {
    onPress: () => void;
    icon: string;
    iconColor: string;
    navName: ReactElement;
}

export default function BottomNav({ onPress, icon, iconColor, navName }: BottomNavProps) {

    return (
        <TouchableOpacity 
              style={styles.navItem}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={icon} 
                size={24} 
                color={iconColor} 
              />
              {navName}
        </TouchableOpacity>
    );
};