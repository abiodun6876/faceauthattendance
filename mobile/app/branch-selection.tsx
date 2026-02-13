import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { deviceService } from '../services/deviceService';
import { orgService } from '../services/orgService';
import { Building, MapPin, ArrowRight } from 'lucide-react-native';

export default function BranchSelectionScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [device, setDevice] = useState<any>(null);
    const [branches, setBranches] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const { isRegistered, device: deviceInfo } = await deviceService.checkRegistration();

            if (!isRegistered || !deviceInfo) {
                router.replace('/device-setup');
                return;
            }

            setDevice(deviceInfo);

            // Load branches if organization is set
            if (deviceInfo.organization_id) {
                const { data: branchList, error } = await orgService.getBranches(deviceInfo.organization_id);
                if (branchList) {
                    setBranches(branchList);
                }
            }
        } catch (error) {
            console.error('Data load error:', error);
            Alert.alert('Error', 'Failed to load organization data');
        } finally {
            setLoading(false);
        }
    };

    const handleBranchSelect = (branch: any) => {
        router.push({
            pathname: '/attendance',
            params: {
                branchId: branch.id,
                branchName: branch.name,
                organizationId: device.organization_id
            }
        } as any);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1890ff" />
                <Text style={styles.loadingText}>Loading branches...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Building size={32} color="#1890ff" />
                <Text style={styles.headerTitle}>Select Location</Text>
                <Text style={styles.headerSubtitle}>
                    {device?.organization?.name || 'Organization'}
                </Text>
            </View>

            <ScrollView style={styles.content}>
                <Text style={styles.sectionTitle}>Available Branches</Text>

                {branches.map((branch) => (
                    <TouchableOpacity
                        key={branch.id}
                        style={styles.branchCard}
                        onPress={() => handleBranchSelect(branch)}
                    >
                        <View style={styles.branchIcon}>
                            <MapPin size={24} color="#1890ff" />
                        </View>
                        <View style={styles.branchInfo}>
                            <Text style={styles.branchName}>{branch.name}</Text>
                            <Text style={styles.branchCode}>{branch.code}</Text>
                        </View>
                        <ArrowRight size={20} color="#ccc" />
                    </TouchableOpacity>
                ))}

                {branches.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No branches found</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    header: {
        backgroundColor: '#fff',
        padding: 24,
        paddingTop: 60,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        marginTop: 12,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 4,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 16,
        marginLeft: 4,
    },
    branchCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    branchIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#e6f7ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    branchInfo: {
        flex: 1,
    },
    branchName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    branchCode: {
        fontSize: 14,
        color: '#888',
        marginTop: 2,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#999',
        fontSize: 16,
    },
});
