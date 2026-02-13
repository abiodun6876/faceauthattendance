import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { deviceService } from '../services/deviceService';
import { Smartphone, CheckCircle } from 'lucide-react-native';

export default function DeviceSetupScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        deviceCode: '',
        pairingCode: ''
    });

    const handleLogin = async () => {
        if (!formData.deviceCode || !formData.pairingCode) {
            Alert.alert('Error', 'Please enter both device code and pairing code');
            return;
        }

        setLoading(true);
        try {
            const result = await deviceService.loginDevice(formData.deviceCode, formData.pairingCode);

            if (result.success) {
                Alert.alert('Success', 'Device linked successfully!');
                router.replace('/branch-selection');
            } else {
                Alert.alert('Error', result.error || 'Failed to link device');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.iconContainer}>
                    <Smartphone size={48} color="#1890ff" />
                </View>
                <Text style={styles.title}>Device Setup</Text>
                <Text style={styles.subtitle}>Link this device to your organization</Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Device Code</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. DEV-123"
                        value={formData.deviceCode}
                        onChangeText={(text) => setFormData({ ...formData, deviceCode: text })}
                        autoCapitalize="characters"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Pairing Code</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. 123456"
                        value={formData.pairingCode}
                        onChangeText={(text) => setFormData({ ...formData, pairingCode: text })}
                        keyboardType="number-pad"
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <CheckCircle size={20} color="#fff" style={styles.buttonIcon} />
                            <Text style={styles.buttonText}>Link Device</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#e6f7ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 24,
        textAlign: 'center',
    },
    inputContainer: {
        width: '100%',
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        width: '100%',
        height: 48,
        borderWidth: 1,
        borderColor: '#d9d9d9',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    button: {
        width: '100%',
        height: 48,
        backgroundColor: '#1890ff',
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        backgroundColor: '#a0c5e8',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonIcon: {
        marginRight: 8,
    },
});
