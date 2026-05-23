import {Text, View, StyleSheet } from 'react-native'
import React from 'react'
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from '../assets/styles/index.styles';

interface FeatureListProps {
    icon: string;
    title: string;
    text: string;
}

// This is a temporary component.
const FeatureList = ({ icon, title, text }: FeatureListProps) => (
    <View style={styles.featureCard}>
        <Ionicons name={icon} size={22} color="#5d3fd3" style={styles.featureIcon} />
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureText}>{text}</Text>
    </View>
);

export default FeatureList;