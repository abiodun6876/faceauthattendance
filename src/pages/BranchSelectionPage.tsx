import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  Button,
  Alert,
  Spin,
  Layout,
  List,
  Radio
} from 'antd';
import {
  Building,
  MapPin,
  CheckCircle,
  ArrowLeft,
  Plus
} from 'lucide-react';
import { supabase, deviceService } from '../lib/supabase';
import { Form, Input, Modal, message as antdMessage } from 'antd';

const { Title, Text } = Typography;
const { Content } = Layout;

const BranchSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [currentDevice, setCurrentDevice] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);

  const loadBranches = useCallback(async () => {
    try {
      const { isRegistered, device } = await deviceService.checkDeviceRegistration();

      if (!isRegistered || !device) {
        navigate('/device-setup');
        return;
      }

      setCurrentDevice(device);

      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', device.organization_id)
        .eq('is_active', true)
        .order('name');

      if (branchError) throw branchError;

      setBranches(branchData || []);
      setSelectedBranch(device.branch_id);
    } catch (err: any) {
      setError(err.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const handleSave = async () => {
    if (!selectedBranch) {
      setError('Please select a branch');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('devices')
        .update({ branch_id: selectedBranch })
        .eq('id', currentDevice.id);

      if (updateError) throw updateError;

      // Update local storage
      const deviceToken = localStorage.getItem('device_token');
      if (deviceToken) {
        const { data: updatedDevice } = await supabase
          .from('devices')
          .select('*, branches(*), organizations(*)')
          .eq('device_token', deviceToken)
          .eq('status', 'active')
          .single();

        if (updatedDevice) {
          localStorage.setItem('branch_id', updatedDevice.branch_id || '');
          // Update context by reloading
          window.location.href = '/';
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update branch');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBranch = async (values: any) => {
    if (!currentDevice?.organization_id) return;

    setCreating(true);
    try {
      const { data: newBranch, error: createError } = await supabase
        .from('branches')
        .insert({
          organization_id: currentDevice.organization_id,
          name: values.name,
          code: values.code || values.name.substring(0, 3).toUpperCase(),
          address: values.address,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;

      antdMessage.success('Branch created successfully!');
      setShowCreateModal(false);
      createForm.resetFields();

      // Reload branches and select the new one
      await loadBranches();
      setSelectedBranch(newBranch.id);
    } catch (err: any) {
      if (err.message?.includes('row-level security')) {
        Modal.error({
          title: 'Database Security Violation',
          content: 'Supabase RLS is blocking branch creation. Ensure you have enabled public access to the branches table for initial setup.',
        });
      } else {
        antdMessage.error(err.message || 'Failed to create branch');
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <Spin size="large" />
        <Text type="secondary" style={{ marginTop: 20 }}>
          Loading branches...
        </Text>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <Content style={{
        padding: 24,
        maxWidth: 800,
        margin: '0 auto',
        width: '100%'
      }}>
        <div style={{ marginBottom: 32 }}>
          <Button
            type="text"
            icon={<ArrowLeft size={18} />}
            onClick={() => navigate(-1)}
            style={{
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 16
            }}
          >
            <Text style={{ fontSize: 14 }}>Back</Text>
          </Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: '#667eea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Building size={24} color="#fff" />
            </div>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Select Branch
              </Title>
              <Text type="secondary">
                Choose your current location
              </Text>
            </div>
          </div>
        </div>

        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Card style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 16 }}>
              Current Organization
            </Text>
          </div>

          {currentDevice && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              backgroundColor: '#f6ffed',
              borderRadius: 8,
              border: '1px solid #b7eb8f'
            }}>
              <Building size={20} color="#52c41a" />
              <div>
                <Text strong>{currentDevice.organization?.name}</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Current: {currentDevice.branch?.name}
                  </Text>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ fontSize: 16 }}>
              Available Branches
            </Text>
            <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
              Select where you're currently located
            </Text>
          </div>

          <div style={{ marginBottom: 24 }}>
            <Button
              type="dashed"
              block
              icon={<Plus size={16} />}
              onClick={() => setShowCreateModal(true)}
              style={{ height: 50, borderRadius: 8 }}
            >
              Add New Branch
            </Button>
          </div>

          <Radio.Group
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{ width: '100%' }}
          >
            <List
              dataSource={branches}
              renderItem={(branch) => (
                <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Radio value={branch.id} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor: '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <MapPin size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Text strong>{branch.name}</Text>
                        {branch.address && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {branch.address}
                            </Text>
                          </div>
                        )}
                      </div>
                      {selectedBranch === branch.id && (
                        <CheckCircle size={20} color="#52c41a" />
                      )}
                    </div>
                  </Radio>
                </List.Item>
              )}
            />
          </Radio.Group>

          {branches.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Building size={48} color="#d9d9d9" />
              <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                No branches available for this organization
              </Text>
            </div>
          )}

          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              onClick={handleSave}
              loading={saving}
              disabled={!selectedBranch || selectedBranch === currentDevice?.branch_id}
              style={{ minWidth: 200 }}
            >
              {saving ? 'Saving...' : 'Save Branch Selection'}
            </Button>
          </div>
        </Card>

        <div style={{
          marginTop: 32,
          padding: '16px',
          backgroundColor: '#fff3cd',
          borderRadius: 8,
          border: '1px solid #ffeaa7'
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <strong>Note:</strong> Changing branch will affect where attendance is recorded.
            Make sure you select the correct location.
          </Text>
        </div>

        <Modal
          title="Create New Branch"
          open={showCreateModal}
          onCancel={() => setShowCreateModal(false)}
          onOk={() => createForm.submit()}
          confirmLoading={creating}
          destroyOnClose
        >
          <Form
            form={createForm}
            layout="vertical"
            onFinish={handleCreateBranch}
            initialValues={{ is_active: true }}
          >
            <Form.Item
              name="name"
              label="Branch Name"
              rules={[{ required: true, message: 'Please enter branch name' }]}
            >
              <Input placeholder="e.g. Ikeja Office, Lekki Branch" />
            </Form.Item>
            <Form.Item
              name="code"
              label="Branch Code (Optional)"
              extra="3-letter code, e.g. IKJ, LEK"
            >
              <Input maxLength={5} placeholder="e.g. IKJ" />
            </Form.Item>
            <Form.Item
              name="address"
              label="Address (Optional)"
            >
              <Input.TextArea rows={2} placeholder="Enter branch address" />
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default BranchSelectionPage;