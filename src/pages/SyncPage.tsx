// src/pages/SyncPage.tsx
import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Typography, Alert, Tag, Progress, message } from 'antd';
import { 
  RefreshCw, 
  Database, 
  CheckCircle, 
  XCircle, 
  Clock,
  Trash2,
  Wifi,
  WifiOff
} from 'lucide-react';
import { LocalSyncService } from '../lib/supabase';
import { format } from 'date-fns';

const { Title, Text } = Typography;

const SyncPage: React.FC = () => {
  const [syncQueue, setSyncQueue] = useState<any[]>([]);
  const [offlineData, setOfflineData] = useState<Record<string, any>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    loadData();
    setLastSync(LocalSyncService.getLastSyncTime());
    
    // Listen for online/offline events
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  const handleOnlineStatus = () => {
    setIsOnline(navigator.onLine);
  };

  const loadData = async () => {
    const queue = await LocalSyncService.getSyncQueue();
    const data = LocalSyncService.getOfflineData();
    setSyncQueue(queue);
    setOfflineData(data);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await LocalSyncService.syncPendingItems();
      if (result.success) {
        message.success(`Successfully synced ${result.synced} items`);
        setLastSync(new Date());
      } else {
        message.error(`Failed to sync ${result.errors.length} items`);
      }
      await loadData();
    } catch (error) {
      message.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearProcessed = async () => {
    await LocalSyncService.clearProcessedItems();
    await loadData();
    message.success('Cleared processed items');
  };

  const columns = [
    {
      title: 'Table',
      dataIndex: 'table_name',
      key: 'table_name',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Operation',
      dataIndex: 'operation',
      key: 'operation',
      render: (op: string) => (
        <Tag color={
          op === 'insert' ? 'green' :
          op === 'update' ? 'orange' : 'red'
        }>
          {op.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Record ID',
      dataIndex: 'record_id',
      key: 'record_id',
      render: (id: string) => <Text code>{id.substring(0, 8)}...</Text>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => (
        record.processed ? (
          <Space>
            <CheckCircle size={16} color="#52c41a" />
            <Text type="success">Synced</Text>
          </Space>
        ) : (
          <Space>
            <Clock size={16} color="#faad14" />
            <Text type="warning">Pending</Text>
          </Space>
        )
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => format(new Date(date), 'dd/MM HH:mm'),
    },
    {
      title: 'Synced',
      dataIndex: 'synced_at',
      key: 'synced_at',
      render: (date: string) => date ? format(new Date(date), 'dd/MM HH:mm') : '-',
    },
  ];

  const pendingItems = syncQueue.filter(item => !item.processed);
  const syncedItems = syncQueue.filter(item => item.processed);

  return (
    <div>
      <Title level={2}>Data Sync Management</Title>
      <Text type="secondary">
        Manage offline data and sync with AFE Babalola University servers
      </Text>

      {/* Network Status */}
      <Card style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4}>Network Status</Title>
            {isOnline ? (
              <Tag icon={<Wifi size={14} />} color="success">
                Online
              </Tag>
            ) : (
              <Tag icon={<WifiOff size={14} />} color="error">
                Offline
              </Tag>
            )}
          </div>
          
          {!isOnline && (
            <Alert
              message="You are currently offline"
              description="Data will be stored locally and synced when connection is restored."
              type="warning"
              showIcon
            />
          )}
          
          {lastSync && (
            <div>
              <Text>Last successful sync: </Text>
              <Text strong>{format(lastSync, 'dd/MM/yyyy HH:mm:ss')}</Text>
            </div>
          )}
        </Space>
      </Card>

      {/* Sync Controls */}
      <Card style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4}>Sync Controls</Title>
            <Text type="secondary">
              {pendingItems.length} items pending sync
            </Text>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<RefreshCw />}
              onClick={handleSync}
              loading={syncing}
              disabled={pendingItems.length === 0 || !isOnline}
            >
              Sync Now
            </Button>
            <Button
              icon={<Trash2 />}
              onClick={handleClearProcessed}
              disabled={syncedItems.length === 0}
            >
              Clear Processed
            </Button>
          </Space>
        </div>

        {pendingItems.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Progress 
              percent={Math.round((syncedItems.length / syncQueue.length) * 100)}
              status="active"
              format={() => `${syncedItems.length}/${syncQueue.length} items synced`}
            />
          </div>
        )}
      </Card>

      {/* Sync Queue */}
      <Card style={{ marginTop: 24 }}>
        <Title level={4}>Sync Queue</Title>
        <Table
          columns={columns}
          dataSource={syncQueue}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ margin: 0 }}>
                <Text strong>Data:</Text>
                <pre style={{ marginTop: 8, background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(record.data, null, 2)}
                </pre>
              </div>
            ),
          }}
        />
      </Card>

      {/* Offline Storage */}
      <Card style={{ marginTop: 24 }}>
        <Title level={4}>Offline Storage</Title>
        <Alert
          message="Local Storage Status"
          description={`Currently storing ${Object.keys(offlineData).length} offline records`}
          type="info"
          showIcon
          icon={<Database />}
        />
        
        {Object.keys(offlineData).length > 0 && (
          <Table
            style={{ marginTop: 16 }}
            dataSource={Object.entries(offlineData).map(([key, value]) => ({
              key,
              ...value,
            }))}
            columns={[
              {
                title: 'Key',
                dataIndex: 'key',
                key: 'key',
              },
              {
                title: 'Type',
                key: 'type',
                render: (_, record) => {
                  const data = record.data;
                  if (data.event_id) return 'Attendance';
                  if (data.student_id && data.embedding) return 'Face Enrollment';
                  return 'Other';
                },
              },
              {
                title: 'Timestamp',
                dataIndex: 'timestamp',
                key: 'timestamp',
                render: (date: string) => format(new Date(date), 'dd/MM HH:mm'),
              },
            ]}
            pagination={{ pageSize: 5 }}
          />
        )}
      </Card>

      {/* Sync Instructions */}
      <Card style={{ marginTop: 24 }}>
        <Title level={4}>Sync Instructions</Title>
        <Space direction="vertical">
          <div>
            <CheckCircle size={16} color="#52c41a" style={{ marginRight: 8 }} />
            <Text>Data is automatically stored locally when offline</Text>
          </div>
          <div>
            <CheckCircle size={16} color="#52c41a" style={{ marginRight: 8 }} />
            <Text>Click "Sync Now" to upload pending data when online</Text>
          </div>
          <div>
            <CheckCircle size={16} color="#52c41a" style={{ marginRight: 8 }} />
            <Text>Processed items can be cleared to free up space</Text>
          </div>
          <div>
            <XCircle size={16} color="#ff4d4f" style={{ marginRight: 8 }} />
            <Text>Do not close browser while syncing is in progress</Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default SyncPage;