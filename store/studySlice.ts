import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as NotificationService from '../services/notifications';
import { Course, DashboardStats, StudySession, DailyMinutesData, CourseCompletionData, StudyRecommendation } from '../types';
import type { RootState } from './reduxStore';

const API_URL = 'https://687319aac75558e273535336.mockapi.io/api/courses';
const STORAGE_KEY_SESSIONS = '@study_mate:sessions';
const STORAGE_KEY_COURSES = '@study_mate:courses';

interface StudyState {
  sessions: StudySession[];
  courses: Course[];
  loading: boolean;
  error: string | null;
}

const initialState: StudyState = {
  sessions: [],
  courses: [],
  loading: false,
  error: null,
};

// Helper function to get notification date
function getNotificationDate(dateString: string, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date(dateString);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// Async thunks
export const fetchSessions = createAsyncThunk(
  'study/fetchSessions',
  async (_, { getState }) => {
    const state = getState() as { study: StudyState };
    const existingSessions = state.study.sessions;
    const existingCourses = state.study.courses;
    
    console.log('🔄 fetchSessions START - Existing in state:', existingSessions.length, 'sessions,', existingCourses.length, 'courses');

    try {
      // Try to load from cache first for instant display
      const cachedSessions = await AsyncStorage.getItem(STORAGE_KEY_SESSIONS);
      const cachedCourses = await AsyncStorage.getItem(STORAGE_KEY_COURSES);
      
      let initialData = null;
      if (cachedSessions && cachedCourses) {
        const parsedSessions = JSON.parse(cachedSessions);
        const parsedCourses = JSON.parse(cachedCourses);
        console.log('📦 Cache found:', parsedSessions.length, 'sessions,', parsedCourses.length, 'courses');
        // Validate cache format - allow empty courses
        const isValidCourses = parsedCourses.length === 0 || parsedCourses[0].name !== undefined;
        if (isValidCourses) {
          console.log('✅ Loading valid cached data');
          initialData = {
            sessions: parsedSessions,
            courses: parsedCourses
          };
        } else {
          console.log('❌ Cache has invalid format, clearing...');
          await AsyncStorage.removeItem(STORAGE_KEY_SESSIONS);
          await AsyncStorage.removeItem(STORAGE_KEY_COURSES);
        }
      } else {
        console.log('📦 No cache found');
      }

      // Fetch from API
      const response = await fetch(API_URL);
      if (!response.ok) {
        // If API fails but we have cache, return cache
        if (initialData) {
          return initialData;
        }
        throw new Error('Failed to fetch courses');
      }

      const apiData: any = await response.json();
      let coursesData: Course[] = [];
      let sessionsData: StudySession[] = [];

      if (Array.isArray(apiData) && apiData.length > 0) {
        const firstItem = apiData[0];
        if (firstItem.duration !== undefined && firstItem.course_name) {
          console.log('API returns sessions with course_name format');
          sessionsData = (apiData as any[]).map((item, index) => ({
            id: item.id || `api-session-${Date.now()}-${index}`,
            courseId: `course-${item.course_name}`,
            courseName: item.course_name,
            courseIcon: item.icon || '📖',
            duration: item.duration,
            date: item.date.split('T')[0],
            notes: item.notes,
            completed: item.completion || false,
            createdAt: item.date,
            updatedAt: item.date,
          }));

          const courseMap = new Map<string, Course>();
          sessionsData.forEach((session) => {
            const courseId = session.courseId;
            if (!courseMap.has(courseId)) {
              courseMap.set(courseId, {
                id: courseId,
                name: session.courseName,
                icon: session.courseIcon,
                totalLessons: 0,
                completedLessons: 0,
              });
            }
            const course = courseMap.get(courseId)!;
            course.totalLessons++;
            if (session.completed) {
              course.completedLessons++;
            }
          });
          coursesData = Array.from(courseMap.values());
        } else {
          coursesData = apiData as Course[];
          let sessionCounter = 0;
          sessionsData = coursesData.flatMap((course, courseIndex) => {
            const courseSessions: StudySession[] = [];
            const sessionCount = Math.min(course.completedLessons || 3, 7);
            const courseId = course.id || `course-${courseIndex}`;

            for (let i = 0; i < sessionCount; i++) {
              const sessionDate = new Date();
              sessionDate.setDate(sessionDate.getDate() - (i % 7));
              sessionDate.setHours(9 + (i % 8), 0, 0, 0);

              const isCompleted = i < (course.completedLessons || 0);
              const uniqueId = `session-${Date.now()}-${sessionCounter++}-${courseId}-${i}`;
              const courseDisplayName = course.name || `Course ${courseIndex + 1}`;

              courseSessions.push({
                id: uniqueId,
                courseId: courseId,
                courseName: courseDisplayName,
                courseIcon: course.icon,
                duration: Math.floor(Math.random() * 90) + 45,
                date: sessionDate.toISOString().split('T')[0],
                notes: isCompleted
                  ? `Completed lesson ${i + 1} for ${courseDisplayName}`
                  : `Study session for ${courseDisplayName}`,
                completed: isCompleted,
                createdAt: sessionDate.toISOString(),
                updatedAt: sessionDate.toISOString(),
              });
            }
            return courseSessions;
          });
        }
      }

      // Merge with existing sessions to preserve local updates
      const existingSessionMap = new Map(existingSessions.map(s => [s.id, s]));
      const mergedSessions = sessionsData.map(apiSession => {
        const existing = existingSessionMap.get(apiSession.id);
        if (existing) {
          return {
            ...apiSession,
            reminderEnabled: existing.reminderEnabled ?? apiSession.reminderEnabled,
            reminderTime: existing.reminderTime ?? apiSession.reminderTime,
            notificationId: existing.notificationId ?? apiSession.notificationId,
            notes: existing.notes || apiSession.notes,
            completed: existing.completed !== undefined ? existing.completed : apiSession.completed,
            updatedAt: existing.updatedAt && new Date(existing.updatedAt) > new Date(apiSession.updatedAt || 0)
              ? existing.updatedAt
              : apiSession.updatedAt,
          };
        }
        return apiSession;
      });

      existingSessions.forEach(localSession => {
        if (!sessionsData.find(s => s.id === localSession.id)) {
          mergedSessions.push(localSession);
        }
      });

      // Merge courses: keep locally created courses + API courses
      const mergedCoursesMap = new Map<string, Course>();
      
      // First, add cached courses (if exists)
      if (initialData && initialData.courses) {
        console.log('📚 Adding cached courses:', initialData.courses.length);
        initialData.courses.forEach((course: Course) => {
          mergedCoursesMap.set(course.id, course);
        });
      }
      
      // Then, add or update with API courses
      console.log('🌐 Adding API courses:', coursesData.length);
      coursesData.forEach(course => {
        const existing = mergedCoursesMap.get(course.id);
        if (existing) {
          // Merge: keep local data but update from API if newer
          mergedCoursesMap.set(course.id, {
            ...existing,
            ...course,
            // Preserve local completions if not in API
            totalLessons: course.totalLessons || existing.totalLessons,
            completedLessons: course.completedLessons || existing.completedLessons,
          });
        } else {
          mergedCoursesMap.set(course.id, course);
        }
      });
      
      // Also add courses from state.study.courses that are not in API (locally created)
      console.log('💾 Adding existing state courses:', existingCourses.length);
      existingCourses.forEach(localCourse => {
        if (!mergedCoursesMap.has(localCourse.id)) {
          console.log('  ➕ Preserving locally created course:', localCourse.name);
          mergedCoursesMap.set(localCourse.id, localCourse);
        }
      });
      
      const mergedCourses = Array.from(mergedCoursesMap.values());
      console.log('✨ Final merged courses:', mergedCourses.length);

      // Save to cache
      await AsyncStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(mergedSessions));
      await AsyncStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(mergedCourses));
      console.log('💾 Saved to cache:', mergedSessions.length, 'sessions,', mergedCourses.length, 'courses');

      return { sessions: mergedSessions, courses: mergedCourses };
    } catch (error) {
      console.error('Fetch sessions error:', error);
      throw error;
    }
  }
);

export const fetchCourses = createAsyncThunk(
  'study/fetchCourses',
  async () => {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch courses');
    }
    const coursesData: Course[] = await response.json();
    return coursesData;
  }
);

export const addSession = createAsyncThunk(
  'study/addSession',
  async (sessionData: Omit<StudySession, 'id' | 'createdAt' | 'updatedAt'>, { getState }) => {
    const state = getState() as { study: StudyState };
    
    const newSession: StudySession = {
      ...sessionData,
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      reminderEnabled: sessionData.reminderEnabled || false,
      reminderTime: sessionData.reminderTime || '09:00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedSessions = [newSession, ...state.study.sessions];
    
    // Save to cache
    await AsyncStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updatedSessions));
    console.log('Session added and cached');
    
    return newSession;
  }
);

export const updateSession = createAsyncThunk(
  'study/updateSession',
  async ({ id, session }: { id: string; session: Partial<StudySession> }, { getState }) => {
    const state = getState() as { study: StudyState };
    
    const updatedSessions = state.study.sessions.map(s =>
      s.id === id
        ? {
            ...s,
            ...session,
            id: s.id,
            createdAt: s.createdAt,
            updatedAt: new Date().toISOString(),
          }
        : s
    );
    
    // Save to cache
    await AsyncStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updatedSessions));
    console.log('Session updated and cached');
    
    return { id, session };
  }
);

export const addCourse = createAsyncThunk(
  'study/addCourse',
  async (courseData: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>, { getState, dispatch }) => {
    const state = getState() as { study: StudyState };
    
    const newCourse: Course = {
      ...courseData,
      id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('➕ Adding new course:', newCourse.name, 'ID:', newCourse.id);
    console.log('📊 Current courses in state:', state.study.courses.length);
    
    const updatedCourses = [newCourse, ...state.study.courses];
    
    // Save to both AsyncStorage keys (for manual access and Redux Persist)
    await AsyncStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(updatedCourses));
    console.log('💾 Course saved to AsyncStorage. Total courses:', updatedCourses.length);
    
    // Verify it was saved
    const saved = await AsyncStorage.getItem(STORAGE_KEY_COURSES);
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('✅ Verified: Courses in AsyncStorage:', parsed.length);
      const found = parsed.find((c: Course) => c.id === newCourse.id);
      if (found) {
        console.log('✅ Verified: New course found in storage:', found.name);
      } else {
        console.error('❌ ERROR: New course NOT found in storage after save!');
      }
    }
    
    return newCourse;
  }
);

export const clearCache = createAsyncThunk(
  'study/clearCache',
  async () => {
    await AsyncStorage.removeItem(STORAGE_KEY_SESSIONS);
    await AsyncStorage.removeItem(STORAGE_KEY_COURSES);
    console.log('Cache cleared');
  }
);

const studySlice = createSlice({
  name: 'study',
  initialState,
  reducers: {
    // Note: addSession, updateSession, addCourse, clearCache are now async thunks
    // They are handled in extraReducers below

    toggleReminder: (state, action: PayloadAction<{ sessionId: string; reminderTime?: string }>) => {
      const { sessionId, reminderTime = '09:00' } = action.payload;
      const session = state.sessions.find(s => s.id === sessionId);
      
      if (!session) return;

      const newReminderEnabled = !session.reminderEnabled;

      if (session.notificationId) {
        NotificationService.cancelNotification(session.notificationId).catch(console.error);
      }

      if (newReminderEnabled) {
        const notificationDate = getNotificationDate(session.date, reminderTime);
        if (notificationDate > new Date()) {
          NotificationService.scheduleNotification(
            sessionId,
            'Study Reminder',
            `It's time to study your planned course: ${session.courseName}`,
            notificationDate
          ).then(notificationId => {
            session.notificationId = notificationId;
          }).catch(console.error);
        }
      }

      session.reminderEnabled = newReminderEnabled;
      session.reminderTime = reminderTime;
      session.updatedAt = new Date().toISOString();
    },

    // addCourse, addSession, updateSession, clearCache are async thunks - handled in extraReducers

    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSessions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.loading = false;
        state.sessions = action.payload.sessions;
        state.courses = action.payload.courses;
        console.log('✅ fetchSessions.fulfilled - Updated state with', state.sessions.length, 'sessions and', state.courses.length, 'courses');
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch sessions';
        console.log('❌ fetchSessions.rejected:', state.error);
      })
      .addCase(fetchCourses.fulfilled, (state, action) => {
        // Merge courses instead of replacing - preserve locally created courses
        const existingCourseMap = new Map(state.courses.map(c => [c.id, c]));
        action.payload.forEach(apiCourse => {
          existingCourseMap.set(apiCourse.id, apiCourse);
        });
        // Keep locally created courses that are not in API
        state.courses.forEach(localCourse => {
          if (!existingCourseMap.has(localCourse.id)) {
            existingCourseMap.set(localCourse.id, localCourse);
          }
        });
        state.courses = Array.from(existingCourseMap.values());
        console.log('✅ fetchCourses.fulfilled - Merged courses. Total:', state.courses.length);
      })
      .addCase(addSession.fulfilled, (state, action) => {
        state.sessions.unshift(action.payload);
        console.log('✅ addSession.fulfilled - Session added. Total:', state.sessions.length);
      })
      .addCase(updateSession.fulfilled, (state, action) => {
        const { id, session } = action.payload;
        const index = state.sessions.findIndex(s => s.id === id);
        if (index !== -1) {
          state.sessions[index] = {
            ...state.sessions[index],
            ...session,
            updatedAt: new Date().toISOString(),
          };
          console.log('✅ updateSession.fulfilled - Session updated:', id);
        }
      })
      .addCase(addCourse.fulfilled, (state, action) => {
        // Check if course already exists (avoid duplicates)
        const exists = state.courses.find(c => c.id === action.payload.id);
        if (!exists) {
          state.courses.unshift(action.payload);
          console.log('✅ addCourse.fulfilled - Course added:', action.payload.name, 'Total courses:', state.courses.length);
          
          // Also save to AsyncStorage to ensure persistence
          AsyncStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(state.courses)).then(() => {
            console.log('💾 Courses saved to AsyncStorage after addCourse');
          }).catch(console.error);
        } else {
          console.log('⚠️ Course already exists, skipping:', action.payload.name);
        }
      })
      .addCase(clearCache.fulfilled, (state) => {
        state.sessions = [];
        state.courses = [];
      });
  },
});

export const { toggleReminder, clearError } = studySlice.actions;
// addSession, updateSession, addCourse, clearCache are exported as async thunks above

// Selectors
export const selectSessions = (state: { study: StudyState }) => state.study.sessions;
export const selectCourses = (state: { study: StudyState }) => state.study.courses;
export const selectLoading = (state: { study: StudyState }) => state.study.loading;
export const selectError = (state: { study: StudyState }) => state.study.error;

export const getDashboardStats = (state: RootState): DashboardStats => {
  const { sessions, courses } = state.study;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeekSessions = sessions.filter((session: StudySession) => {
    const sessionDate = new Date(session.date);
    return sessionDate >= weekAgo;
  });

  const totalMinutesThisWeek = thisWeekSessions.reduce(
    (sum: number, session: StudySession) => sum + session.duration,
    0
  );
  const totalStudyHoursThisWeek = Math.round((totalMinutesThisWeek / 60) * 10) / 10;

  const courseMinutes: Record<string, number> = {};
  thisWeekSessions.forEach((session: StudySession) => {
    courseMinutes[session.courseId] =
      (courseMinutes[session.courseId] || 0) + session.duration;
  });

  const mostActiveCourseId = Object.entries(courseMinutes).reduce(
    (a, b) => (a[1] > b[1] ? a : b),
    ['', 0] as [string, number]
  )[0];

  const mostActiveCourse = sessions.find((s: StudySession) => s.courseId === mostActiveCourseId)?.courseName || 'None';

  const totalLessons = courses.reduce((sum: number, course: Course) => sum + course.totalLessons, 0);
  const completedLessons = courses.reduce((sum: number, course: Course) => sum + course.completedLessons, 0);
  const completionPercentage = totalLessons > 0
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  const daysInWeek = 7;
  const averageDailyTimeSpent = Math.round(totalMinutesThisWeek / daysInWeek);

  return {
    totalStudyHoursThisWeek,
    mostActiveCourse,
    completionPercentage,
    averageDailyTimeSpent,
  };
};

// Analytics selectors
export const getDailyMinutesThisWeek = (state: RootState): DailyMinutesData[] => {
  const { sessions } = state.study;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Get all days in the past week
  const days: DailyMinutesData[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dateString = date.toISOString().split('T')[0];
    
    // Calculate total minutes for this day
    const daySessions = sessions.filter((session: StudySession) => {
      const sessionDate = new Date(session.date);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate.getTime() === date.getTime();
    });
    
    const totalMinutes = daySessions.reduce(
      (sum: number, session: StudySession) => sum + session.duration,
      0
    );
    
    days.push({
      day: dayName,
      date: dateString,
      minutes: totalMinutes,
    });
  }
  
  return days;
};

export const getCourseCompletionData = (state: RootState): CourseCompletionData[] => {
  const { courses } = state.study;
  
  return courses.map((course: Course) => {
    const completionPercentage = course.totalLessons > 0
      ? Math.round((course.completedLessons / course.totalLessons) * 100)
      : 0;
    
    return {
      courseName: course.name,
      courseId: course.id,
      completionPercentage,
      completedLessons: course.completedLessons,
      totalLessons: course.totalLessons,
    };
  }).filter((data: CourseCompletionData) => data.totalLessons > 0); // Only show courses with lessons
};

/**
 * AI Study Recommendation Logic
 * 
 * This function analyzes study patterns and course progress to provide smart recommendations.
 * 
 * Algorithm:
 * 1. Calculate priority score (0-100) for each course based on:
 *    - Completion percentage (lower = higher priority, 40% weight)
 *    - Days since last study (longer = higher priority, 30% weight)
 *    - Total study time this week (less = higher priority, 20% weight)
 *    - Course progress urgency (courses near completion get boost, 10% weight)
 * 
 * 2. Determine priority level:
 *    - High: score ≥ 70 (urgent attention needed)
 *    - Medium: score 40-69 (should study soon)
 *    - Low: score < 40 (maintain current pace)
 * 
 * 3. Generate personalized reason based on the dominant factor
 * 
 * 4. Suggest study duration based on:
 *    - Average session length for the course
 *    - Remaining lessons to complete
 *    - User's typical study patterns
 * 
 * This creates a balanced recommendation system that adapts to individual learning patterns.
 */
export const getStudyRecommendations = (state: RootState): StudyRecommendation[] => {
  const { sessions, courses } = state.study;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Get this week's sessions
  const thisWeekSessions = sessions.filter((session: StudySession) => {
    const sessionDate = new Date(session.date);
    return sessionDate >= weekAgo;
  });
  
  // Calculate course study time this week
  const courseWeeklyMinutes: Record<string, number> = {};
  thisWeekSessions.forEach((session: StudySession) => {
    courseWeeklyMinutes[session.courseId] = 
      (courseWeeklyMinutes[session.courseId] || 0) + session.duration;
  });
  
  // Calculate last study date for each course
  const courseLastStudy: Record<string, Date | null> = {};
  courses.forEach((course: Course) => {
    const courseSessions = sessions
      .filter((s: StudySession) => s.courseId === course.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    courseLastStudy[course.id] = courseSessions.length > 0 
      ? new Date(courseSessions[0].date) 
      : null;
  });
  
  // Calculate average session duration per course
  const courseAvgDuration: Record<string, number> = {};
  courses.forEach((course: Course) => {
    const courseSessions = sessions.filter((s: StudySession) => s.courseId === course.id);
    if (courseSessions.length > 0) {
      const totalDuration = courseSessions.reduce((sum, s) => sum + s.duration, 0);
      courseAvgDuration[course.id] = Math.round(totalDuration / courseSessions.length);
    } else {
      courseAvgDuration[course.id] = 30; // Default 30 minutes
    }
  });
  
  // Generate recommendations for each course
  console.log('🤖 getStudyRecommendations - Starting analysis');
  console.log('  - Total courses:', courses.length);
  console.log('  - Courses with lessons:', courses.filter((c: Course) => c.totalLessons > 0).length);
  
  const recommendations: StudyRecommendation[] = courses
    .filter((course: Course) => {
      const hasLessons = course.totalLessons > 0;
      if (!hasLessons) {
        console.log(`  - Skipping course "${course.name}" (no lessons)`);
      }
      return hasLessons;
    }) // Only courses with lessons
    .map((course: Course) => {
      console.log(`  - Analyzing course: ${course.name}`);
      const completionPercentage = course.totalLessons > 0
        ? Math.round((course.completedLessons / course.totalLessons) * 100)
        : 0;
      
      // Factor 1: Completion percentage (lower = higher priority)
      const completionScore = (100 - completionPercentage) * 0.4;
      
      // Factor 2: Days since last study (longer = higher priority)
      const lastStudy = courseLastStudy[course.id];
      const daysSinceLastStudy = lastStudy 
        ? Math.floor((now.getTime() - lastStudy.getTime()) / (1000 * 60 * 60 * 24))
        : 999; // Never studied = very high priority
      const recencyScore = Math.min(daysSinceLastStudy * 5, 30); // Max 30 points
      
      // Factor 3: Weekly study time (less = higher priority)
      const weeklyMinutes = courseWeeklyMinutes[course.id] || 0;
      const weeklyScore = weeklyMinutes < 30 ? 20 : (weeklyMinutes < 60 ? 10 : 0);
      
      // Factor 4: Progress urgency (courses near completion get boost)
      const progressUrgency = completionPercentage >= 80 && completionPercentage < 100 ? 10 : 0;
      
      // Calculate total priority score
      const totalScore = completionScore + recencyScore + weeklyScore + progressUrgency;
      
      // Determine priority level
      let priority: 'high' | 'medium' | 'low';
      if (totalScore >= 70) {
        priority = 'high';
      } else if (totalScore >= 40) {
        priority = 'medium';
      } else {
        priority = 'low';
      }
      
      // Generate reason
      let reason = '';
      if (completionPercentage < 30) {
        reason = `Only ${completionPercentage}% complete. Focus needed to catch up.`;
      } else if (daysSinceLastStudy > 7) {
        reason = `Haven't studied in ${daysSinceLastStudy} days. Time to review!`;
      } else if (weeklyMinutes < 30) {
        reason = `Only ${weeklyMinutes} minutes this week. Increase study time.`;
      } else if (completionPercentage >= 80 && completionPercentage < 100) {
        reason = `${completionPercentage}% complete. Almost there! Finish strong.`;
      } else {
        reason = `Maintain steady progress. ${completionPercentage}% complete.`;
      }
      
      // Suggest study duration
      const avgDuration = courseAvgDuration[course.id] || 30;
      const remainingLessons = course.totalLessons - course.completedLessons;
      const suggestedMinutes = priority === 'high' 
        ? Math.max(avgDuration, 45) // At least 45 min for high priority
        : priority === 'medium'
        ? Math.max(avgDuration, 30) // At least 30 min for medium
        : avgDuration; // Use average for low priority
      
      return {
        courseId: course.id,
        courseName: course.name,
        courseIcon: course.icon,
        priority,
        reason,
        suggestedMinutes,
        score: Math.min(Math.round(totalScore), 100),
      };
    })
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .slice(0, 3); // Top 3 recommendations
  
  console.log('🤖 getStudyRecommendations - Results:', recommendations.length, 'recommendations');
  if (recommendations.length > 0) {
    recommendations.forEach((rec, idx) => {
      console.log(`  ${idx + 1}. ${rec.courseName} - ${rec.priority} (${rec.score}/100)`);
    });
  } else {
    console.log('  - No recommendations generated. Possible reasons:');
    console.log('    - No courses with lessons');
    console.log('    - All courses have 0 totalLessons');
  }
  
  return recommendations;
};

const studyReducer = studySlice.reducer;
export default studyReducer;

