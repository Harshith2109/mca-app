import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

// Default target to local Android emulator host (10.0.2.2) or custom saved base
let GLOBAL_API_BASE = 'https://exam-system-api-d7s6.onrender.com/api';

export default function App() {
  const [theme, setTheme] = useState('dark'); // dark, light
  const [apiBase, setApiBase] = useState(GLOBAL_API_BASE);
  const [tempApiBase, setTempApiBase] = useState(GLOBAL_API_BASE);
  const [showSettings, setShowSettings] = useState(false);

  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('login'); // login, register, admin, instructor, student, exam-runner

  const [loading, setLoading] = useState(false);

  // Login States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Tab states for dashboards
  const [adminTab, setAdminTab] = useState('create'); // create, list
  const [instructorTab, setInstructorTab] = useState('build'); // build, eligibility, attempts
  const [studentTab, setStudentTab] = useState('available'); // available, ongoing, attempts

  // API configurations
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  });

  const apiCall = async (endpoint, options = {}) => {
    const url = `${apiBase}${endpoint}`;
    const defaultHeaders = getHeaders();
    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };
    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const res = await fetch(url, config);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      return data;
    } catch (err) {
      console.error(`API Error for ${endpoint}:`, err);
      throw err;
    }
  };

  // --- SETTINGS ---
  const saveSettings = () => {
    GLOBAL_API_BASE = tempApiBase;
    setApiBase(tempApiBase);
    setShowSettings(false);
    Alert.alert('Success', `API Base URL updated to: ${tempApiBase}`);
  };

  // --- AUTH SERVICES ---
  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: { username, password }
      });
      setToken(data.token);
      setCurrentUser(data.user);

      // Initialize workspace logic for instructor/student
      if (data.user.role === 'instructor') {
        await apiCall('/instructor/init', {
          method: 'POST',
          body: { instructor_id: data.user.userId }
        });
        setView('instructor');
      } else if (data.user.role === 'student') {
        await apiCall('/student/init', {
          method: 'POST',
          body: { student_id: data.user.userId }
        });
        setView('student');
      } else if (data.user.role === 'admin') {
        setView('admin');
      }
    } catch (err) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setCurrentUser(null);
    setView('login');
    setUsername('');
    setPassword('');
  };

  // --- ADMIN SYSTEM ---
  const [usersList, setUsersList] = useState([]);
  const [adminExams, setAdminExams] = useState([]);
  const [newRegUser, setNewRegUser] = useState({
    username: '', password: '', fullname: '', email: '', role: 'student', userId: ''
  });

  const loadAdminData = async () => {
    if (view !== 'admin') return;
    setLoading(true);
    try {
      const usersData = await apiCall('/admin/users');
      setUsersList(usersData.users || []);
      const examsData = await apiCall('/admin/exams');
      setAdminExams(examsData.exams || []);
    } catch (err) {
      Alert.alert('Load Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    const { username, password, fullname, email, role, userId } = newRegUser;
    if (!username || !password || !fullname || !email || !userId) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await apiCall('/admin/users', {
        method: 'POST',
        body: newRegUser
      });
      Alert.alert('Success', `Registered ${fullname} as ${role}`);
      setNewRegUser({ username: '', password: '', fullname: '', email: '', role: 'student', userId: '' });
      loadAdminData();
    } catch (err) {
      Alert.alert('Registration Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userIdToDelete) => {
    Alert.alert(
      'Delete User',
      'Are you sure you want to delete this user account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await apiCall(`/admin/users/${userIdToDelete}`, { method: 'DELETE' });
              Alert.alert('Success', 'User account deleted');
              loadAdminData();
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleStopExam = async (examId) => {
    setLoading(true);
    try {
      await apiCall(`/admin/exams/${examId}/stop`, { method: 'PUT' });
      Alert.alert('Success', 'Exam deactivated successfully');
      loadAdminData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (examId) => {
    Alert.alert(
      'Delete Exam',
      'Are you sure you want to permanently delete this exam?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await apiCall(`/admin/exams/${examId}`, { method: 'DELETE' });
              Alert.alert('Success', 'Exam deleted');
              loadAdminData();
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // --- INSTRUCTOR SYSTEM ---
  const [exams, setExams] = useState([]);
  const [newExam, setNewExam] = useState({
    course_id: '', exam_name: '', description: '', duration: '3600', total_marks: '100', passing_marks: '40'
  });
  const [addingQuestionExamId, setAddingQuestionExamId] = useState(null);
  const [newQuestion, setNewQuestion] = useState({
    question_text: '', question_type: 'multiple_choice', options: '', correct_answer: '', marks: '10'
  });
  const [eligibilityExamId, setEligibilityExamId] = useState('');
  const [eligibleStudents, setEligibleStudents] = useState('');
  const [examAttempts, setExamAttempts] = useState([]);
  const [viewingAttemptsExam, setViewingAttemptsExam] = useState(null);
  const [editingExam, setEditingExam] = useState(null);
  const [evaluatingAttempt, setEvaluatingAttempt] = useState(null);
  const [evaluatingScores, setEvaluatingScores] = useState({});

  const loadInstructorData = async () => {
    if (view !== 'instructor') return;
    setLoading(true);
    try {
      const data = await apiCall(`/instructor/${currentUser.userId}/exams`);
      setExams(data.exams || []);
      const usersData = await apiCall('/admin/users');
      setUsersList(usersData.users || []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExam = async () => {
    const { course_id, exam_name, description, duration, total_marks, passing_marks } = newExam;
    if (!course_id || !exam_name || !duration) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }
    setLoading(true);
    try {
      await apiCall(`/instructor/${currentUser.userId}/exams`, {
        method: 'POST',
        body: {
          course_id,
          exam_name,
          description,
          duration: parseInt(duration),
          total_marks: parseInt(total_marks),
          passing_marks: parseInt(passing_marks)
        }
      });
      Alert.alert('Success', 'Exam created successfully');
      setNewExam({ course_id: '', exam_name: '', description: '', duration: '3600', total_marks: '100', passing_marks: '40' });
      loadInstructorData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async () => {
    const { question_text, question_type, options, correct_answer, marks } = newQuestion;
    if (!question_text || !correct_answer) {
      Alert.alert('Error', 'Question text and correct answer are required');
      return;
    }
    setLoading(true);
    try {
      const parsedOptions = question_type === 'multiple_choice'
        ? options.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      await apiCall(`/instructor/${currentUser.userId}/exams/${addingQuestionExamId}/questions`, {
        method: 'POST',
        body: {
          question_text,
          question_type,
          options: parsedOptions,
          correct_answer,
          marks: parseInt(marks)
        }
      });
      Alert.alert('Success', 'Question added to exam');
      setNewQuestion({ question_text: '', question_type: 'multiple_choice', options: '', correct_answer: '', marks: '10' });
      setAddingQuestionExamId(null);
      loadInstructorData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignStudents = async () => {
    if (!eligibilityExamId || !eligibleStudents) {
      Alert.alert('Error', 'Please select an exam and input student IDs');
      return;
    }
    setLoading(true);
    try {
      const studentIds = eligibleStudents.split(',').map(s => s.trim()).filter(Boolean);
      await apiCall(`/instructor/${currentUser.userId}/exams/${eligibilityExamId}/students`, {
        method: 'POST',
        body: { student_ids: studentIds }
      });
      Alert.alert('Success', 'Students enrolled successfully');
      setEligibilityExamId('');
      setEligibleStudents('');
      loadInstructorData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExamActive = async (exam) => {
    setLoading(true);
    const action = exam.is_active ? 'deactivate' : 'activate';
    try {
      await apiCall(`/instructor/${currentUser.userId}/exams/${exam.exam_id}/${action}`, {
        method: 'PUT'
      });
      Alert.alert('Success', `Exam is now ${exam.is_active ? 'Inactive' : 'Active'}`);
      loadInstructorData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExam = async () => {
    if (!editingExam.exam_name) {
      Alert.alert('Error', 'Exam Name is required');
      return;
    }
    setLoading(true);
    try {
      await apiCall(`/instructor/${currentUser.userId}/exams/${editingExam.exam_id}`, {
        method: 'PUT',
        body: {
          exam_name: editingExam.exam_name,
          description: editingExam.description,
          duration: parseInt(editingExam.duration),
          total_marks: parseInt(editingExam.total_marks),
          passing_marks: parseInt(editingExam.passing_marks)
        }
      });
      Alert.alert('Success', 'Exam updated successfully');
      setEditingExam(null);
      loadInstructorData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEvaluate = (attempt) => {
    setEvaluatingAttempt(attempt);
    const initialScores = {};
    if (viewingAttemptsExam && viewingAttemptsExam.questions) {
      viewingAttemptsExam.questions.forEach(q => {
        const qIdStr = String(q.question_id);
        let existingScore = '';
        if (attempt.question_scores) {
          if (attempt.question_scores instanceof Map) {
            existingScore = attempt.question_scores.get(qIdStr);
          } else if (typeof attempt.question_scores === 'object') {
            existingScore = attempt.question_scores[qIdStr];
          }
        }
        initialScores[qIdStr] = existingScore !== undefined && existingScore !== null ? String(existingScore) : '';
      });
    }
    setEvaluatingScores(initialScores);
  };

  const handleSaveEvaluation = async () => {
    setLoading(true);
    try {
      const parsedScores = {};
      Object.entries(evaluatingScores).forEach(([qId, val]) => {
        if (val !== '') {
          parsedScores[qId] = Number(val);
        }
      });

      await apiCall(`/instructor/${currentUser.userId}/exams/${viewingAttemptsExam.exam_id}/attempts/${evaluatingAttempt.attempt_id}/grade`, {
        method: 'PUT',
        body: { question_scores: parsedScores }
      });

      Alert.alert('Success', 'Attempt evaluated successfully');
      setEvaluatingAttempt(null);
      const data = await apiCall(`/instructor/${currentUser.userId}/exams/${viewingAttemptsExam.exam_id}/attempts`);
      setExamAttempts(data.attempts || []);
    } catch (err) {
      Alert.alert('Evaluation Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAttempts = async (exam) => {
    setLoading(true);
    try {
      const data = await apiCall(`/instructor/${currentUser.userId}/exams/${exam.exam_id}/attempts`);
      setExamAttempts(data.attempts || []);
      setViewingAttemptsExam(exam);
      setInstructorTab('attempts');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- STUDENT SYSTEM ---
  const [availableExams, setAvailableExams] = useState([]);
  const [studentAttempts, setStudentAttempts] = useState([]);
  const [ongoingExams, setOngoingExams] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchInstructorId, setStudentSearchInstructorId] = useState('');
  const [activeInstructorId, setActiveInstructorId] = useState('');

  // Active Exam Taker State
  const [activeExam, setActiveExam] = useState(null);
  const [activeAttemptId, setActiveAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef(null);

  const loadStudentData = async () => {
    if (view !== 'student') return;
    setLoading(true);
    try {
      const ongoing = await apiCall(`/student/exams/ongoing?search=${encodeURIComponent(studentSearch)}`);
      setOngoingExams(ongoing.exams || []);

      const attempts = await apiCall(`/student/${currentUser.userId}/attempts`);
      setStudentAttempts(attempts.attempts || []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const queryAvailableExams = async () => {
    if (!studentSearchInstructorId) {
      Alert.alert('Error', 'Please enter an Instructor ID');
      return;
    }
    setLoading(true);
    try {
      const res = await apiCall(`/student/${currentUser.userId}/exams/available`, {
        method: 'POST',
        body: {
          student_id: currentUser.userId,
          instructor_id: String(studentSearchInstructorId)
        }
      });
      setAvailableExams(res.exams || []);
      setActiveInstructorId(studentSearchInstructorId);
    } catch (err) {
      Alert.alert('Search Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async (exam, instructorIdParam = null) => {
    const finalInstructorId = instructorIdParam || activeInstructorId;
    Alert.alert(
      'Start Exam',
      `Are you ready to start taking "${exam.exam_name}"?\nDuration: ${Math.round(exam.duration / 60)} mins`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await apiCall(`/student/${currentUser.userId}/exams/${exam.exam_id}/start`, {
                method: 'POST',
                body: {
                  student_id: currentUser.userId,
                  instructor_id: String(finalInstructorId)
                }
              });

              setActiveExam({
                ...exam,
                ...res,
                questions: res.questions || exam.questions || []
              });
              setActiveInstructorId(finalInstructorId);
              setActiveAttemptId(res.attempt_id);
              setQuestions(res.questions || exam.questions || []);
              setCurrentQuestionIndex(0);
              setStudentAnswers({});
              setTimeRemaining(res.duration || exam.duration);
              setView('exam-runner');
            } catch (err) {
              Alert.alert('Start Error', err.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSaveAnswer = async (questionId, answer) => {
    setStudentAnswers(prev => ({ ...prev, [questionId]: answer }));
    try {
      await apiCall(`/student/${currentUser.userId}/exams/${activeExam.exam_id}/submit-answer`, {
        method: 'POST',
        body: {
          attempt_id: activeAttemptId,
          question_id: questionId,
          answer: String(answer)
        }
      });
    } catch (err) {
      console.error('Save answer fail:', err);
    }
  };

  const handleExamSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setLoading(true);
    try {
      const instructorId = activeExam.instructor_id || activeInstructorId || '';
      const res = await apiCall(`/student/${currentUser.userId}/exams/${activeExam.exam_id}/submit`, {
        method: 'POST',
        body: {
          attempt_id: activeAttemptId,
          instructor_id: String(instructorId)
        }
      });

      Alert.alert(
        'Exam Submitted!',
        `Your score: ${res.result.score}%\nFeedback: ${res.feedback || 'None'}`,
        [{
          text: 'OK', onPress: () => {
            setView('student');
            setActiveExam(null);
            setActiveAttemptId(null);
            loadStudentData();
          }
        }]
      );
    } catch (err) {
      Alert.alert('Submit Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Exam Countdown Timer Hook
  useEffect(() => {
    if (view !== 'exam-runner' || !activeExam || !activeAttemptId) return;

    timerRef.current = setInterval(async () => {
      try {
        const res = await apiCall(`/student/${currentUser.userId}/exams/${activeExam.exam_id}/time-remaining?attempt_id=${activeAttemptId}`);
        const remaining = res.remaining_seconds;
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          clearInterval(timerRef.current);
          Alert.alert("Time's Up!", 'Submitting your exam attempt automatically.', [
            { text: 'OK', onPress: handleExamSubmit }
          ]);
        }
      } catch (err) {
        console.error('Time Sync Error:', err);
      }
    }, 5000); // sync server time every 5s

    // Local tick-down every 1s
    const localTimer = setInterval(() => {
      setTimeRemaining(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(localTimer);
    };
  }, [view, activeExam, activeAttemptId]);

  // Initial load hooks
  useEffect(() => {
    if (view === 'admin') loadAdminData();
    if (view === 'instructor') loadInstructorData();
    if (view === 'student') loadStudentData();
  }, [view]);

  // Format countdown text
  const formatTime = (secs) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* HEADER BANNER */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="ribbon-outline" size={24} color="#6366f1" />
          <Text style={styles.headerTitle}>NATIVE EXAM PORTAL</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={22} color="#a1a1aa" />
          </TouchableOpacity>
          {currentUser && (
            <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* DYNAMIC VIEW CONTAINER */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, padding: 16 }}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={{ color: '#a1a1aa', marginTop: 10 }}>Loading data...</Text>
            </View>
          )}

          {/* 1. LOGIN SCREEN */}
          {view === 'login' && (
            <ScrollView contentContainerStyle={styles.centerContainer}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Sign In</Text>
                <Text style={styles.cardSubtitle}>Enter credentials to access your portal</Text>

                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. student1, instructor1"
                  placeholderTextColor="#71717a"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderBottomWidth: 0, marginBottom: 0 }]}
                    placeholder="••••••••"
                    placeholderTextColor="#71717a"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#a1a1aa" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
                  <Text style={styles.primaryButtonText}>Log In</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* 2. ADMIN PORTAL */}
          {view === 'admin' && (
            <View style={{ flex: 1 }}>
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, adminTab === 'create' && styles.tabActive]}
                  onPress={() => setAdminTab('create')}
                >
                  <Text style={[styles.tabText, adminTab === 'create' && styles.tabTextActive]}>Register User</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabButton, adminTab === 'list' && styles.tabActive]}
                  onPress={() => setAdminTab('list')}
                >
                  <Text style={[styles.tabText, adminTab === 'list' && styles.tabTextActive]}>Exams & Users</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1, marginTop: 10 }}>
                {adminTab === 'create' && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Create New Account</Text>

                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="John Doe"
                      placeholderTextColor="#71717a"
                      value={newRegUser.fullname}
                      onChangeText={val => setNewRegUser(p => ({ ...p, fullname: val }))}
                    />

                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="john@moodleexam.com"
                      placeholderTextColor="#71717a"
                      value={newRegUser.email}
                      onChangeText={val => setNewRegUser(p => ({ ...p, email: val }))}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />

                    <Text style={styles.label}>Role</Text>
                    <View style={styles.roleRow}>
                      {['student', 'instructor', 'admin'].map(r => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.roleSelectButton, newRegUser.role === r && styles.roleActive]}
                          onPress={() => setNewRegUser(p => ({ ...p, role: r }))}
                        >
                          <Text style={[styles.roleText, newRegUser.role === r && styles.roleTextActive]}>
                            {r.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>User ID (Numeric Unique)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 5"
                      placeholderTextColor="#71717a"
                      value={newRegUser.userId}
                      onChangeText={val => setNewRegUser(p => ({ ...p, userId: val }))}
                      keyboardType="numeric"
                    />

                    <Text style={styles.label}>Username</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="john_doe"
                      placeholderTextColor="#71717a"
                      value={newRegUser.username}
                      onChangeText={val => setNewRegUser(p => ({ ...p, username: val }))}
                      autoCapitalize="none"
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Password string"
                      placeholderTextColor="#71717a"
                      value={newRegUser.password}
                      onChangeText={val => setNewRegUser(p => ({ ...p, password: val }))}
                      secureTextEntry
                      autoCapitalize="none"
                    />

                    <TouchableOpacity style={styles.primaryButton} onPress={handleCreateUser}>
                      <Text style={styles.primaryButtonText}>Create User Account</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {adminTab === 'list' && (
                  <View>
                    {/* USERS LIST */}
                    <View style={styles.card}>
                      <Text style={styles.sectionTitle}>Registered Users ({usersList.length})</Text>
                      {usersList.map((usr, i) => (
                        <View key={usr.userId || i} style={styles.listItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>{usr.fullname}</Text>
                            <Text style={styles.itemSubtitle}>{usr.email} • ID: {usr.userId} • Role: {usr.role}</Text>
                          </View>
                          {usr.role !== 'admin' && (
                            <TouchableOpacity onPress={() => handleDeleteUser(usr.userId)} style={styles.dangerButton}>
                              <Ionicons name="trash-outline" size={16} color="#ef4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>

                    {/* EXAMS LIST */}
                    <View style={styles.card}>
                      <Text style={styles.sectionTitle}>Global Exam Status</Text>
                      {adminExams.map((ex, i) => (
                        <View key={ex.exam_id || i} style={styles.listItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>{ex.exam_name}</Text>
                            <Text style={styles.itemSubtitle}>Course: {ex.course_id} • Status: {ex.is_active ? 'Active' : 'Inactive'}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {ex.is_active && (
                              <TouchableOpacity onPress={() => handleStopExam(ex.exam_id)} style={styles.warningButton}>
                                <Text style={styles.warningButtonText}>Stop</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => handleDeleteExam(ex.exam_id)} style={styles.dangerButton}>
                              <Ionicons name="trash-outline" size={16} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* 3. INSTRUCTOR PORTAL */}
          {view === 'instructor' && (
            <View style={{ flex: 1 }}>
              {/* TAB ROW */}
              <View style={styles.tabContainer}>
                {['build', 'eligibility', 'attempts'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tabButton, instructorTab === t && styles.tabActive]}
                    onPress={() => setInstructorTab(t)}
                  >
                    <Text style={[styles.tabText, instructorTab === t && styles.tabTextActive]}>
                      {t === 'build' ? 'Manage' : t === 'eligibility' ? 'Enroll' : 'Attempts'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={{ flex: 1, marginTop: 10 }}>
                {instructorTab === 'build' && (
                  <View>
                    {/* CREATE EXAM FORM */}
                    <View style={styles.card}>
                      <Text style={styles.sectionTitle}>Create New Exam Paper</Text>

                      <Text style={styles.label}>Course Code</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. CS201"
                        placeholderTextColor="#71717a"
                        value={newExam.course_id}
                        onChangeText={val => setNewExam(p => ({ ...p, course_id: val }))}
                      />

                      <Text style={styles.label}>Exam Title</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Midterm Theory"
                        placeholderTextColor="#71717a"
                        value={newExam.exam_name}
                        onChangeText={val => setNewExam(p => ({ ...p, exam_name: val }))}
                      />

                      <Text style={styles.label}>Description</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Topics covered..."
                        placeholderTextColor="#71717a"
                        value={newExam.description}
                        onChangeText={val => setNewExam(p => ({ ...p, description: val }))}
                      />

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Duration (sec)</Text>
                          <TextInput
                            style={styles.input}
                            value={newExam.duration}
                            onChangeText={val => setNewExam(p => ({ ...p, duration: val }))}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Passing Marks</Text>
                          <TextInput
                            style={styles.input}
                            value={newExam.passing_marks}
                            onChangeText={val => setNewExam(p => ({ ...p, passing_marks: val }))}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>

                      <TouchableOpacity style={styles.primaryButton} onPress={handleCreateExam}>
                        <Text style={styles.primaryButtonText}>Initialize Exam</Text>
                      </TouchableOpacity>
                    </View>

                    {/* INSTRUCTOR EXAMS LIST */}
                    <View style={styles.card}>
                      <Text style={styles.sectionTitle}>Your Exam Papers</Text>
                      {exams.map((ex, i) => {
                        const combinedMarks = ex.questions?.reduce((sum, q) => sum + (Number(q.marks) || 0), 0) || 0;
                        const intendedTotal = Number(ex.total_marks) || 0;
                        const marksMismatch = combinedMarks !== intendedTotal;

                        return (
                          <View key={ex.exam_id || i} style={styles.examCard}>
                            <Text style={styles.itemTitle}>{ex.exam_name}</Text>
                            <Text style={styles.itemSubtitle}>Course: {ex.course_id} • Duration: {Math.round(ex.duration / 60)} min • Questions: {ex.questions?.length || 0}</Text>
                            <Text style={styles.itemSubtitle}>Intended Marks: {intendedTotal} • Added Marks: {combinedMarks}</Text>
                            
                            {marksMismatch && (
                              <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>
                                ⚠️ Marks Mismatch! Sum ({combinedMarks}) must equal total ({intendedTotal}).
                              </Text>
                            )}

                            <View style={styles.examCardActions}>
                              <TouchableOpacity
                                style={[styles.smallButton, { backgroundColor: ex.is_active ? '#eab308' : '#22c55e' }]}
                                onPress={() => handleToggleExamActive(ex)}
                              >
                                <Text style={{ color: '#09090b', fontWeight: 'bold', fontSize: 12 }}>
                                  {ex.is_active ? 'Deactivate' : 'Publish'}
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.smallButton, { backgroundColor: '#6366f1' }]}
                                onPress={() => setAddingQuestionExamId(ex.exam_id)}
                              >
                                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>+ Question</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.smallButton, { backgroundColor: '#3f3f46' }]}
                                onPress={() => setEditingExam(ex)}
                              >
                                <Text style={{ color: '#fff', fontSize: 12 }}>Edit</Text>
                              </TouchableOpacity>

                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* ADD QUESTION MODAL CARD OVERLAY */}
                {addingQuestionExamId && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Add Question to ID: {addingQuestionExamId}</Text>

                    <Text style={styles.label}>Question Text</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Type query detail..."
                      placeholderTextColor="#71717a"
                      value={newQuestion.question_text}
                      onChangeText={val => setNewQuestion(p => ({ ...p, question_text: val }))}
                    />

                    <Text style={styles.label}>Question Type</Text>
                    <View style={styles.roleRow}>
                      {['multiple_choice', 'short_answer', 'essay'].map(type => (
                        <TouchableOpacity
                          key={type}
                          style={[styles.roleSelectButton, newQuestion.question_type === type && styles.roleActive]}
                          onPress={() => setNewQuestion(p => ({ ...p, question_type: type }))}
                        >
                          <Text style={[styles.roleText, newQuestion.question_type === type && styles.roleTextActive, { fontSize: 10 }]}>
                            {type.replace('_', ' ').toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {newQuestion.question_type === 'multiple_choice' && (
                      <View>
                        <Text style={styles.label}>Options (comma-separated list)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. Option A, Option B, Option C, Option D"
                          placeholderTextColor="#71717a"
                          value={newQuestion.options}
                          onChangeText={val => setNewQuestion(p => ({ ...p, options: val }))}
                        />
                      </View>
                    )}

                    <Text style={styles.label}>Correct Answer</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Option A (or answer text)"
                      placeholderTextColor="#71717a"
                      value={newQuestion.correct_answer}
                      onChangeText={val => setNewQuestion(p => ({ ...p, correct_answer: val }))}
                    />

                    <Text style={styles.label}>Marks Assigned</Text>
                    <TextInput
                      style={styles.input}
                      value={newQuestion.marks}
                      onChangeText={val => setNewQuestion(p => ({ ...p, marks: val }))}
                      keyboardType="numeric"
                    />

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#27272a', borderRadius: 8, alignItems: 'center' }} onPress={() => setAddingQuestionExamId(null)}>
                        <Text style={{ color: '#fff' }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#6366f1', borderRadius: 8, alignItems: 'center' }} onPress={handleAddQuestion}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save Question</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* EDIT EXAM MODAL CARD OVERLAY */}
                {editingExam && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Edit Exam (ID: {editingExam.exam_id})</Text>

                    <Text style={styles.label}>Exam Name</Text>
                    <TextInput
                      style={styles.input}
                      value={editingExam.exam_name}
                      onChangeText={val => setEditingExam(p => ({ ...p, exam_name: val }))}
                    />

                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={styles.input}
                      value={editingExam.description || ''}
                      onChangeText={val => setEditingExam(p => ({ ...p, description: val }))}
                    />

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Duration (sec)</Text>
                        <TextInput
                          style={styles.input}
                          value={String(editingExam.duration)}
                          onChangeText={val => setEditingExam(p => ({ ...p, duration: val }))}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Total Marks</Text>
                        <TextInput
                          style={styles.input}
                          value={String(editingExam.total_marks)}
                          onChangeText={val => setEditingExam(p => ({ ...p, total_marks: val }))}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Passing Marks (%)</Text>
                        <TextInput
                          style={styles.input}
                          value={String(editingExam.passing_marks)}
                          onChangeText={val => setEditingExam(p => ({ ...p, passing_marks: val }))}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#27272a', borderRadius: 8, alignItems: 'center' }} onPress={() => setEditingExam(null)}>
                        <Text style={{ color: '#fff' }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#6366f1', borderRadius: 8, alignItems: 'center' }} onPress={handleUpdateExam}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save Changes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {instructorTab === 'eligibility' && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Assign Student Eligibility</Text>

                    <Text style={styles.label}>Select Exam Paper</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {exams.map(ex => (
                          <TouchableOpacity
                            key={ex.exam_id}
                            style={[styles.examChip, eligibilityExamId === ex.exam_id && styles.examChipActive]}
                            onPress={() => setEligibilityExamId(ex.exam_id)}
                          >
                            <Text style={[styles.examChipText, eligibilityExamId === ex.exam_id && styles.examChipTextActive]}>
                              {ex.exam_name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    <Text style={styles.label}>Student IDs (comma-separated, e.g. 3, 4)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="3, 4"
                      placeholderTextColor="#71717a"
                      value={eligibleStudents}
                      onChangeText={setEligibleStudents}
                    />

                    <TouchableOpacity style={styles.primaryButton} onPress={handleAssignStudents}>
                      <Text style={styles.primaryButtonText}>Enroll Students</Text>
                    </TouchableOpacity>

                    {/* AVAILABLE STUDENTS DIRECTORY */}
                    <Text style={[styles.label, { marginTop: 20, marginBottom: 8, borderTopWidth: 1, borderTopColor: '#27272a', paddingTop: 16 }]}>
                      Available Students Database:
                    </Text>
                    {usersList.filter(u => u.role === 'student').length === 0 ? (
                      <Text style={{ color: '#71717a', fontSize: 12, fontStyle: 'italic' }}>No students registered in the database.</Text>
                    ) : (
                      usersList.filter(u => u.role === 'student').map((stud, idx) => (
                        <View key={stud.userId || idx} style={[styles.listItem, { paddingVertical: 8 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemTitle, { fontSize: 13 }]}>{stud.fullname}</Text>
                            <Text style={[styles.itemSubtitle, { fontSize: 10 }]}>ID: {stud.userId} • {stud.email}</Text>
                          </View>
                          <TouchableOpacity 
                            style={[styles.smallButton, { backgroundColor: '#27272a', borderWidth: 1, borderColor: '#3f3f46' }]}
                            onPress={() => {
                              const currentVal = eligibleStudents ? eligibleStudents.trim() : '';
                              if (currentVal === '') {
                                setEligibleStudents(String(stud.userId));
                              } else {
                                const ids = currentVal.split(',').map(s => s.trim()).filter(Boolean);
                                if (!ids.includes(String(stud.userId))) {
                                  ids.push(String(stud.userId));
                                }
                                setEligibleStudents(ids.join(', '));
                              }
                            }}
                          >
                            <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: 'bold' }}>+ Add</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {instructorTab === 'attempts' && (
                  <View style={{ flex: 1 }}>
                    {evaluatingAttempt ? (
                      <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Evaluate Attempt: ID #{evaluatingAttempt.attempt_id}</Text>
                        <Text style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 16 }}>Student ID: {evaluatingAttempt.student_id}</Text>

                        <ScrollView style={{ maxHeight: 400, marginBottom: 16 }}>
                          {(viewingAttemptsExam?.questions || []).map((q, idx) => {
                            const qIdStr = String(q.question_id);
                            let studentAns = '';
                            if (evaluatingAttempt.answers) {
                              if (evaluatingAttempt.answers instanceof Map) {
                                studentAns = evaluatingAttempt.answers.get(qIdStr);
                              } else if (typeof evaluatingAttempt.answers === 'object') {
                                studentAns = evaluatingAttempt.answers[qIdStr];
                              }
                            }
                            
                            let displayAnswer = studentAns;
                            if (q.question_type === 'multiple_choice' && studentAns !== undefined) {
                              let optionText = '';
                              if (q.options instanceof Map) {
                                optionText = q.options.get(studentAns);
                              } else if (q.options && typeof q.options === 'object') {
                                optionText = q.options[studentAns];
                              }
                              displayAnswer = optionText ? `[Choice Index ${studentAns}] ${optionText}` : studentAns;
                            }

                            return (
                              <View key={q.question_id || idx} style={{ borderBottomWidth: 1, borderBottomColor: '#27272a', paddingVertical: 12 }}>
                                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Q{idx + 1}: {q.question_text}</Text>
                                <Text style={{ color: '#a1a1aa', fontSize: 11, marginTop: 4 }}>Type: {q.question_type.toUpperCase()} • Max Marks: {q.marks}</Text>
                                <Text style={{ color: '#38bdf8', fontSize: 12, marginTop: 6, fontWeight: '500' }}>Student's Answer: {displayAnswer || '(No answer submitted)'}</Text>
                                
                                <Text style={[styles.label, { marginTop: 8 }]}>Assign Marks (0 - {q.marks}):</Text>
                                <TextInput
                                  style={[styles.input, { marginBottom: 0, paddingVertical: 6 }]}
                                  placeholder={`Score (Max ${q.marks})`}
                                  placeholderTextColor="#71717a"
                                  value={evaluatingScores[qIdStr] || ''}
                                  onChangeText={val => setEvaluatingScores(prev => ({ ...prev, [qIdStr]: val }))}
                                  keyboardType="numeric"
                                />
                              </View>
                            );
                          })}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#27272a', borderRadius: 8, alignItems: 'center' }} onPress={() => setEvaluatingAttempt(null)}>
                            <Text style={{ color: '#fff' }}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#10b981', borderRadius: 8, alignItems: 'center' }} onPress={handleSaveEvaluation}>
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Finalize Grade</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.card}>
                        <Text style={styles.sectionTitle}>View Exam Submissions</Text>
                        
                        <Text style={styles.label}>Select Exam Paper</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {exams.map(ex => (
                              <TouchableOpacity
                                key={ex.exam_id}
                                style={[styles.examChip, viewingAttemptsExam?.exam_id === ex.exam_id && styles.examChipActive]}
                                onPress={() => handleViewAttempts(ex)}
                              >
                                <Text style={[styles.examChipText, viewingAttemptsExam?.exam_id === ex.exam_id && styles.examChipTextActive]}>
                                  {ex.exam_name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>

                        {!viewingAttemptsExam ? (
                          <Text style={{ color: '#71717a', textAlign: 'center', marginVertical: 20 }}>Select an exam above to view submissions.</Text>
                        ) : examAttempts.length === 0 ? (
                          <Text style={{ color: '#71717a', textAlign: 'center', marginTop: 20 }}>No submissions found for this exam.</Text>
                        ) : (
                          examAttempts.map((at, i) => (
                            <View key={at.attempt_id || i} style={[styles.listItem, { paddingVertical: 10 }]}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.itemTitle}>Student ID: {at.student_id}</Text>
                                <Text style={styles.itemSubtitle}>Score: {at.score}% • Status: {at.status}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text style={{ color: at.score >= (viewingAttemptsExam?.passing_marks || 40) ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: 12 }}>
                                  {at.score >= (viewingAttemptsExam?.passing_marks || 40) ? 'PASSED' : 'FAILED'}
                                </Text>
                                <TouchableOpacity
                                  style={[styles.smallButton, { backgroundColor: '#6366f1', paddingHorizontal: 10 }]}
                                  onPress={() => handleOpenEvaluate(at)}
                                >
                                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Evaluate</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* 4. STUDENT PORTAL */}
          {view === 'student' && (
            <View style={{ flex: 1 }}>
              <View style={styles.tabContainer}>
                {['available', 'ongoing', 'attempts'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tabButton, studentTab === t && styles.tabActive]}
                    onPress={() => setStudentTab(t)}
                  >
                    <Text style={[styles.tabText, studentTab === t && styles.tabTextActive]}>
                      {t === 'available' ? 'Available' : t === 'ongoing' ? 'Active Pool' : 'My Grades'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* SEARCH BAR (Active Pool & Available) */}
              {studentTab !== 'attempts' && (
                <View style={styles.searchRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Search courses..."
                    placeholderTextColor="#71717a"
                    value={studentSearch}
                    onChangeText={setStudentSearch}
                  />
                  <TouchableOpacity style={styles.iconButton} onPress={loadStudentData}>
                    <Ionicons name="search" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              <ScrollView style={{ flex: 1, marginTop: 10 }}>
                {studentTab === 'available' && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Find Exams by Instructor</Text>
                    <View style={styles.searchRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="Enter Instructor User ID"
                        placeholderTextColor="#71717a"
                        value={studentSearchInstructorId}
                        onChangeText={setStudentSearchInstructorId}
                      />
                      <TouchableOpacity style={styles.activeChip} onPress={queryAvailableExams}>
                        <Text style={styles.activeChipText}>Search</Text>
                      </TouchableOpacity>
                    </View>

                    {availableExams.length === 0 ? (
                      <Text style={{ color: '#71717a', textAlign: 'center', marginVertical: 20 }}>Enter an Instructor ID above to list available exams.</Text>
                    ) : (
                      availableExams.map((ex, i) => (
                        <View key={ex.exam_id || i} style={styles.listItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>{ex.exam_name}</Text>
                            <Text style={styles.itemSubtitle}>Course: {ex.course_id} • Duration: {Math.round(ex.duration / 60)} min</Text>
                          </View>
                          <TouchableOpacity style={styles.activeChip} onPress={() => handleStartExam(ex)}>
                            <Text style={styles.activeChipText}>Start</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {studentTab === 'ongoing' && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>All Active Exams</Text>
                    {ongoingExams.length === 0 ? (
                      <Text style={{ color: '#71717a', textAlign: 'center', marginVertical: 20 }}>No ongoing exams right now.</Text>
                    ) : (
                      ongoingExams.map((ex, i) => (
                        <View key={ex.exam_id || i} style={styles.listItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>{ex.exam_name}</Text>
                            <Text style={styles.itemSubtitle}>Course: {ex.course_id} • Instructor: {ex.instructor_id}</Text>
                            <Text style={styles.itemSubtitle}>Duration: {Math.round(ex.duration / 60)} min</Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.activeChip} 
                            onPress={() => handleStartExam(ex, ex.instructor_id)}
                          >
                            <Text style={styles.activeChipText}>Attempt</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {studentTab === 'attempts' && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Your Evaluation History</Text>
                    {studentAttempts.length === 0 ? (
                      <Text style={{ color: '#71717a', textAlign: 'center', marginVertical: 20 }}>You have not submitted any attempts yet.</Text>
                    ) : (
                      studentAttempts.map((at, i) => (
                        <View key={at.attempt_id || i} style={styles.listItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>Exam ID: {at.exam_id}</Text>
                            <Text style={styles.itemSubtitle}>Score: {at.score}% • Status: {at.status}</Text>
                          </View>
                          <Text style={{ color: at.status === 'submitted' || at.score >= 50 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                            {at.score}%
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* 5. NATIVE EXAM RUNNER CONTAINER */}
          {view === 'exam-runner' && activeExam && (
            <View style={{ flex: 1 }}>
              {/* TIMER BANNER */}
              <View style={styles.timerBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="time-outline" size={20} color="#f59e0b" />
                  <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
                </View>
                <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{activeExam.exam_name}</Text>
              </View>

              {/* QUESTIONS NAVIGATION HEADER */}
              <View style={styles.questionsNavHeader}>
                {questions.map((_, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.qCircle,
                      currentQuestionIndex === idx && styles.qCircleActive,
                      studentAnswers[questions[idx].question_id] !== undefined && styles.qCircleAnswered
                    ]}
                    onPress={() => setCurrentQuestionIndex(idx)}
                  >
                    <Text style={{
                      color: currentQuestionIndex === idx ? '#09090b' : '#fff',
                      fontWeight: 'bold',
                      fontSize: 12
                    }}>
                      {idx + 1}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ACTIVE QUESTION PANEL */}
              <ScrollView style={{ flex: 1, marginTop: 10 }}>
                {questions.length === 0 ? (
                  <Text style={{ color: '#a1a1aa', textAlign: 'center', marginVertical: 30 }}>This exam has no questions loaded.</Text>
                ) : (
                  <View style={styles.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ color: '#6366f1', fontWeight: 'bold' }}>
                        QUESTION {currentQuestionIndex + 1} OF {questions.length}
                      </Text>
                      <Text style={{ color: '#a1a1aa' }}>
                        {questions[currentQuestionIndex].marks} MARKS
                      </Text>
                    </View>

                    <Text style={styles.questionText}>
                      {questions[currentQuestionIndex].question_text}
                    </Text>

                    {/* MCQs Option Render */}
                    {questions[currentQuestionIndex].question_type === 'multiple_choice' && (
                      <View style={{ marginTop: 16 }}>
                        {Object.entries(questions[currentQuestionIndex].options || {}).map(([key, opt]) => (
                          <TouchableOpacity
                            key={key}
                            style={[
                              styles.optionButton,
                              String(studentAnswers[questions[currentQuestionIndex].question_id]) === String(key) && styles.optionButtonActive
                            ]}
                            onPress={() => handleSaveAnswer(questions[currentQuestionIndex].question_id, key)}
                          >
                            <Ionicons
                              name={String(studentAnswers[questions[currentQuestionIndex].question_id]) === String(key) ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={String(studentAnswers[questions[currentQuestionIndex].question_id]) === String(key) ? '#6366f1' : '#a1a1aa'}
                            />
                            <Text style={[
                              styles.optionText,
                              String(studentAnswers[questions[currentQuestionIndex].question_id]) === String(key) && styles.optionTextActive
                            ]}>
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* True / False Option Render */}
                    {questions[currentQuestionIndex].question_type === 'true_false' && (
                      <View style={{ marginTop: 16, flexDirection: 'row', gap: 12 }}>
                        {['true', 'false'].map((val) => (
                          <TouchableOpacity
                            key={val}
                            style={[
                              styles.optionButton,
                              { flex: 1 },
                              String(studentAnswers[questions[currentQuestionIndex].question_id]) === String(val) && styles.optionButtonActive
                            ]}
                            onPress={() => handleSaveAnswer(questions[currentQuestionIndex].question_id, val)}
                          >
                            <Ionicons
                              name={String(studentAnswers[questions[currentQuestionIndex].question_id]) === String(val) ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={String(studentAnswers[questions[currentQuestionIndex].question_id]) === String(val) ? '#6366f1' : '#a1a1aa'}
                            />
                            <Text style={[
                              styles.optionText,
                              { textTransform: 'capitalize' },
                              String(studentAnswers[questions[currentQuestionIndex].question_id]) === String(val) && styles.optionTextActive
                            ]}>
                              {val}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Short Answer / Essay Input Render */}
                    {(questions[currentQuestionIndex].question_type === 'short_answer' || questions[currentQuestionIndex].question_type === 'essay') && (
                      <View style={{ marginTop: 16 }}>
                        <TextInput
                          style={[
                            styles.input,
                            questions[currentQuestionIndex].question_type === 'essay' && { height: 120, textAlignVertical: 'top' }
                          ]}
                          placeholder="Type your response here..."
                          placeholderTextColor="#71717a"
                          value={studentAnswers[questions[currentQuestionIndex].question_id] || ''}
                          onChangeText={text => setStudentAnswers(prev => ({ ...prev, [questions[currentQuestionIndex].question_id]: text }))}
                          onEndEditing={(e) => handleSaveAnswer(questions[currentQuestionIndex].question_id, e.nativeEvent.text)}
                          multiline={questions[currentQuestionIndex].question_type === 'essay'}
                        />
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>

              {/* FOOTER ACTIONS */}
              <View style={styles.runnerFooter}>
                <TouchableOpacity
                  style={[styles.navBtn, currentQuestionIndex === 0 && { opacity: 0.5 }]}
                  disabled={currentQuestionIndex === 0}
                  onPress={() => setCurrentQuestionIndex(prev => prev - 1)}
                >
                  <Text style={styles.navBtnText}>Previous</Text>
                </TouchableOpacity>

                {currentQuestionIndex < questions.length - 1 ? (
                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={() => setCurrentQuestionIndex(prev => prev + 1)}
                  >
                    <Text style={styles.navBtnText}>Next</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.navBtn, { backgroundColor: '#10b981' }]}
                    onPress={handleExamSubmit}
                  >
                    <Text style={[styles.navBtnText, { color: '#09090b' }]}>Submit Paper</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* DYNAMIC API CONFIGURATION MODAL */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <Ionicons name="settings" size={24} color="#6366f1" />
              <Text style={styles.modalTitle}>API Server Config</Text>
            </View>

            <Text style={styles.label}>Backend API URL Base</Text>
            <TextInput
              style={styles.input}
              placeholder="http://10.0.2.2:5000/api"
              placeholderTextColor="#71717a"
              value={tempApiBase}
              onChangeText={setTempApiBase}
              autoCapitalize="none"
            />

            <Text style={styles.modalInfo}>
              Use <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#6366f1' }}>http://10.0.2.2:5000/api</Text> for Android Emulator loopback, or your computer's local IP address if deploying on physical devices.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, backgroundColor: '#27272a', borderRadius: 8, alignItems: 'center' }}
                onPress={() => {
                  setTempApiBase(apiBase);
                  setShowSettings(false);
                }}
              >
                <Text style={{ color: '#fff' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, backgroundColor: '#6366f1', borderRadius: 8, alignItems: 'center' }}
                onPress={saveSettings}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#09090b',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#f4f4f5',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 6,
  },
  centerContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#f4f4f5',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  cardSubtitle: {
    color: '#a1a1aa',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  label: {
    color: '#a1a1aa',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    height: 44,
    backgroundColor: '#09090b',
    borderColor: '#27272a',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#f4f4f5',
    marginBottom: 16,
    fontSize: 14,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090b',
    borderColor: '#27272a',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    paddingRight: 10,
  },
  eyeIcon: {
    padding: 8,
  },
  primaryButton: {
    height: 44,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#27272a',
  },
  tabText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#f4f4f5',
  },
  sectionTitle: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingBottom: 6,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  itemTitle: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
  },
  itemSubtitle: {
    color: '#a1a1aa',
    fontSize: 11,
    marginTop: 2,
  },
  dangerButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  warningButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  warningButtonText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  roleSelectButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    backgroundColor: '#09090b',
  },
  roleActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  roleText: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  roleTextActive: {
    color: '#6366f1',
  },
  examCard: {
    backgroundColor: '#09090b',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 12,
  },
  examCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  examChipActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  examChipText: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  examChipTextActive: {
    color: '#6366f1',
    fontWeight: 'bold',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  activeChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  activeChipText: {
    color: '#6366f1',
    fontWeight: 'bold',
    fontSize: 12,
  },
  timerBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  timerText: {
    color: '#f59e0b',
    fontWeight: 'bold',
    fontSize: 16,
  },
  questionsNavHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 6,
  },
  qCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qCircleActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  qCircleAnswered: {
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  questionText: {
    color: '#f4f4f5',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  optionButtonActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  optionText: {
    color: '#a1a1aa',
    fontSize: 14,
  },
  optionTextActive: {
    color: '#f4f4f5',
    fontWeight: '600',
  },
  runnerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    backgroundColor: '#09090b',
  },
  navBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#18181b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  navBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalInfo: {
    color: '#71717a',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 10,
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(9, 9, 11, 0.7)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
