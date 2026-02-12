const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'pages', 'EnrollmentPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const newFunction = `  const handleEnrollment = useCallback(async (userData: any, photoData: string, faceResult: FaceProcessingResult) => {
    setLoading(true);

    try {
      if (!faceResult.embedding) {
        throw new Error('Face embedding not available');
      }

      // 💾 SAVE DRAFT TO LOCAL STORAGE FIRST
      const enrollmentDraft = {
        userData,
        faceResult: {
          ...faceResult,
          embedding: Array.from(faceResult.embedding)
        },
        photoData,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('pending_enrollment_draft', JSON.stringify(enrollmentDraft));

      // Use userService to enroll the user
      const { user, faceEnrollment, error: enrollError } = await userService.enrollUser({
        fullName: userData.full_name,
        staffId: userData.staff_id,
        email: userData.email,
        phone: userData.phone,
        userRole: userData.user_role || 'staff',
        gender: userData.gender,
        organizationId: deviceInfo?.organization_id,
        branchId: userData.branch_id || deviceInfo?.branch_id,
        departmentId: userData.department_id || null,
        photoUrl: photoData,
        embedding: Array.from(faceResult.embedding),
        qualityScore: faceResult.quality || 0,
        deviceName: deviceInfo?.device_name || 'web_camera',
        locationName: deviceInfo?.branch?.name || 'online'
      } as any);

      if (enrollError) throw enrollError;

      // Create log entry using attendanceService
      await attendanceService.logFaceMatch({
        userId: user.id || '',
        organizationId: deviceInfo?.organization_id || '',
        deviceId: deviceInfo?.id || '',
        photoUrl: photoData,
        confidence: faceResult.quality || 0,
        isMatch: true,
        result: 'enrollment'
      } as any);

      const result = {
        success: true,
        user,
        faceEnrollment,
        faceDetected: faceResult.faceDetected,
        quality: faceResult.quality
      };

      // ✅ SUCCESS - CLEAR DRAFT
      localStorage.removeItem('pending_enrollment_draft');
      localStorage.removeItem('processing_draft');

      const roles: Record<string, string> = {
        student: 'Student',
        estate_member: 'Estate Member',
        visitor: 'Visitor',
        staff: 'Staff'
      };
      const roleDisplayName = roles[userData.user_role as string] || 'User';

      setEnrollmentResult(result);
      setFormData(userData);
      setCurrentStep(2);
      message.success(\`\${roleDisplayName} enrolled with biometrics!\`);

    } catch (error: any) {
      console.error('Enrollment error:', error);
      const result = {
        success: false,
        error: error.message || 'Enrollment failed. Please try again.'
      };
      setEnrollmentResult(result);
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  }, [deviceInfo]);`;

// Regex to find handleEnrollment function with its dependencies array
// We look for useCallback(async (userData: any, photoData: string, faceResult: FaceProcessingResult) => {
// until its end matching the closing brace and bracket/parenthesis.
const functionRegex = /const handleEnrollment = useCallback\(async \(userData: any, photoData: string, faceResult: FaceProcessingResult\) => \{[\s\S]*?\}, \[deviceInfo\]\);/;

if (functionRegex.test(content)) {
    content = content.replace(functionRegex, newFunction);
    fs.writeFileSync(filePath, content);
    console.log('Successfully refactored handleEnrollment');
} else {
    console.error('Could not find handleEnrollment function using regex');
    // Fallback search
    const startString = 'const handleEnrollment = useCallback(async (userData: any';
    const startIndex = content.indexOf(startString);
    if (startIndex !== -1) {
        // Find the matching end
        const endIndex = content.indexOf('}, [deviceInfo]);', startIndex);
        if (endIndex !== -1) {
            const fullEndIndex = endIndex + '}, [deviceInfo]);'.length;
            content = content.substring(0, startIndex) + newFunction + content.substring(fullEndIndex);
            fs.writeFileSync(filePath, content);
            console.log('Successfully refactored handleEnrollment using fallback index hunt');
        } else {
            console.error('Found start but not end of function');
        }
    } else {
        console.error('Could not find start of handleEnrollment function');
    }
}
