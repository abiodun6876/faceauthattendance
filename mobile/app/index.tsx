import { useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { deviceService } from '../services/deviceService';
import SyncService from '../services/syncService';
import React from 'react';

export default function SplashScreen() {
    const router = useRouter();

    useEffect(() => {
        checkRegistration();
    }, []);

    const checkRegistration = async () => {
        try {
            // Initialize sync service (starts periodic sync)
            SyncService.startPeriodicSync();

            const { isRegistered } = await deviceService.checkRegistration();

            // Artificial delay for splash effect
            await new Promise(resolve => setTimeout(resolve, 1500));

            if (isRegistered) {
                router.replace('/branch-selection');
            } else {
                router.replace('/device-setup');
            }
        } catch (error) {
            console.error('Registration check failed:', error);
            // Fallback to setup on error
            router.replace('/device-setup');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>FaceAuth Attendance</Text>
            <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
            <Text style={styles.status}>Checking device status...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    loader: {
        marginVertical: 20,
    },
    status: {
        fontSize: 16,
        color: '#666',
    },
});
