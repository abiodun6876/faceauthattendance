// src/pages/CourseRegistrationPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Typography,
  Space,
  Alert,
  Row,
  Col,
  Input,
  Tag,
  Select,
  Spin,
  Checkbox,
  message,
  Modal,
  Form,
  Popconfirm,
  Tooltip
} from 'antd';
import {
  Book,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  Plus,
  Users,
  Delete
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const { Title, Text } = Typography;
const { Search: AntdSearch } = Input;

const CourseRegistrationPage: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [matricNumber, setMatricNumber] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [isSelectAll, setIsSelectAll] = useState(false);

  useEffect(() => {
    fetchCourses();
    fetchStudents();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*, department:departments(*)')
        .eq('is_active', true)
        .order('level');

      if (!error) {
        setCourses(data || []);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!error) {
        setStudents(data || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const findStudentByMatric = async (matric: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('matric_number', matric.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          message.error('Student not found');
        } else {
          throw error;
        }
        return null;
      }

      setSelectedStudent(data);
      fetchStudentEnrollments(data.id);
      return data;
    } catch (error) {
      console.error('Error finding student:', error);
      message.error('Failed to find student');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentEnrollments = async (studentId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('enrollments')
        .select('*, course:courses(*)')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .order('enrollment_date', { ascending: false });

      if (!error) {
        setEnrolledCourses(data || []);
        
        // Filter available courses (not enrolled and matching student level)
        const enrolledCourseIds = (data || []).map((e: any) => e.course_id);
        const available = courses.filter(c => 
          !enrolledCourseIds.includes(c.id) && 
          c.level === selectedStudent?.level
        );
        setAvailableCourses(available);
        setSelectedCourses([]);
        setIsSelectAll(false);
      }
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMatricSearch = async () => {
    if (!matricNumber.trim()) {
      message.error('Please enter a matric number');
      return;
    }

    const student = await findStudentByMatric(matricNumber);
    if (!student) {
      setSelectedStudent(null);
      setEnrolledCourses([]);
      setAvailableCourses([]);
    }
  };

  const handleCourseSelect = (courseId: string, checked: boolean) => {
    if (checked) {
      setSelectedCourses([...selectedCourses, courseId]);
    } else {
      setSelectedCourses(selectedCourses.filter(id => id !== courseId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setIsSelectAll(checked);
    if (checked) {
      const allCourseIds = availableCourses.map(course => course.id);
      setSelectedCourses(allCourseIds);
    } else {
      setSelectedCourses([]);
    }
  };

  const enrollInCourses = async () => {
    if (!selectedStudent) {
      message.error('Please select a student first');
      return;
    }

    if (selectedCourses.length === 0) {
      message.error('Please select at least one course');
      return;
    }

    try {
      const enrollments = selectedCourses.map(courseId => ({
        student_id: selectedStudent.id,
        course_id: courseId,
        enrollment_date: new Date().toISOString().split('T')[0],
        academic_session: '2024/2025', // You might want to make this dynamic
        status: 'active'
      }));

      const { error } = await supabase
        .from('enrollments')
        .insert(enrollments);

      if (error) throw error;

      message.success(`Successfully enrolled in ${selectedCourses.length} course(s)`);
      fetchStudentEnrollments(selectedStudent.id);
    } catch (error: any) {
      console.error('Enrollment error:', error);
      message.error(`Failed to enroll: ${error.message}`);
    }
  };

  const unenrollCourse = async (enrollmentId: string) => {
    try {
      const { error } = await supabase
        .from('enrollments')
        .update({ 
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', enrollmentId);

      if (error) throw error;

      message.success('Course unenrolled successfully');
      fetchStudentEnrollments(selectedStudent?.id || '');
    } catch (error: any) {
      console.error('Unenrollment error:', error);
      message.error(`Failed to unenroll: ${error.message}`);
    }
  };

  const columns = [
    {
      title: 'Course Code',
      dataIndex: ['course', 'code'],
      key: 'code',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Course Title',
      dataIndex: ['course', 'title'],
      key: 'title',
    },
    {
      title: 'Level',
      dataIndex: ['course', 'level'],
      key: 'level',
      render: (level: number) => `Level ${level}`,
    },
    {
      title: 'Credit Units',
      dataIndex: ['course', 'credit_units'],
      key: 'credits',
    },
    {
      title: 'Enrollment Date',
      dataIndex: 'enrollment_date',
      key: 'date',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Popconfirm
          title="Are you sure you want to unenroll from this course?"
          onConfirm={() => unenrollCourse(record.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button
            danger
            size="small"
            icon={<Delete size={14} />}
          >
            Unenroll
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Student Course Enrollment</Title>
      <Text type="secondary">
        Enroll students in courses
      </Text>

      <Card style={{ marginTop: 20 }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} md={12}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="Enter Matric Number"
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value)}
                onPressEnter={handleMatricSearch}
                allowClear
              />
              <Button 
                type="primary" 
                onClick={handleMatricSearch}
                loading={loading}
              >
                <Search size={16} /> Search
              </Button>
            </Space.Compact>
          </Col>
          <Col xs={24} md={12}>
            {selectedStudent && (
              <Alert
                message={`Selected Student: ${selectedStudent.name}`}
                description={`Matric: ${selectedStudent.matric_number} | Level: ${selectedStudent.level} | Department: ${selectedStudent.department}`}
                type="info"
                showIcon
              />
            )}
          </Col>
        </Row>

        {selectedStudent && (
          <>
            <div style={{ marginBottom: 30 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}>
                  Available Courses (Level {selectedStudent.level})
                </Title>
                <Space>
                  <Checkbox
                    checked={isSelectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={availableCourses.length === 0}
                  >
                    Select All ({availableCourses.length} courses)
                  </Checkbox>
                  <Button
                    type="primary"
                    icon={<Plus size={16} />}
                    onClick={enrollInCourses}
                    disabled={selectedCourses.length === 0}
                  >
                    Enroll Selected ({selectedCourses.length})
                  </Button>
                </Space>
              </div>
              
              {availableCourses.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {availableCourses.map(course => (
                    <Col xs={24} md={12} lg={8} key={course.id}>
                      <Card size="small" hoverable>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <Checkbox
                            checked={selectedCourses.includes(course.id)}
                            onChange={(e) => handleCourseSelect(course.id, e.target.checked)}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <Text strong style={{ display: 'block' }}>{course.code}</Text>
                                <Text type="secondary" style={{ fontSize: '12px' }}>{course.title}</Text>
                              </div>
                              <Tag color="blue">Level {course.level}</Tag>
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <Tag color="green">{course.credit_units} Credits</Tag>
                              {course.lecturer_name && (
                                <Tag color="purple">{course.lecturer_name}</Tag>
                              )}
                            </div>
                            {course.department && (
                              <Text style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                                Department: {course.department.name}
                              </Text>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Alert
                  message="No available courses"
                  description="All courses for this level have been enrolled"
                  type="info"
                  showIcon
                />
              )}
            </div>

            <div>
              <Title level={4}>Enrolled Courses</Title>
              <Table
                columns={columns}
                dataSource={enrolledCourses}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 5 }}
                locale={{
                  emptyText: 'No courses enrolled yet'
                }}
              />
            </div>
          </>
        )}

        {!selectedStudent && matricNumber && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <User size={48} style={{ color: '#d9d9d9', marginBottom: 16 }} />
            <Text type="secondary">Student not found or matric number is invalid</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Please check the matric number and try again
            </Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CourseRegistrationPage;