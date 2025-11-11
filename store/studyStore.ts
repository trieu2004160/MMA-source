import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import * as NotificationService from '../services/notifications';
import { Course, DashboardStats, StudySession } from '../types';

interface StudyState {
  sessions: StudySession[];
  courses: Course[];
  loading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  fetchCourses: () => Promise<void>;
  addSession: (session: Omit<StudySession, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateSession: (id: string, session: Partial<StudySession>) => Promise<void>;
  toggleReminder: (sessionId: string, reminderTime?: string) => Promise<void>;
  addCourse: (course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Course>;
  clearCache: () => Promise<void>;
  getDashboardStats: () => DashboardStats;
  clearError: () => void;
}

const API_URL = 'https://687319aac75558e273535336.mockapi.io/api/courses';
const STORAGE_KEY_SESSIONS = '@study_mate:sessions';
const STORAGE_KEY_COURSES = '@study_mate:courses';

// Helper function to get notification date
function getNotificationDate(dateString: string, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date(dateString);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export const useStudyStore = create<StudyState>((set, get) => ({
  sessions: [],
  courses: [],
  loading: false,
  error: null,

  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      // ALWAYS load from cache first to preserve local updates
      const cachedSessions = await AsyncStorage.getItem(STORAGE_KEY_SESSIONS);
      const cachedCourses = await AsyncStorage.getItem(STORAGE_KEY_COURSES);
      if (cachedSessions && cachedCourses) {
        const parsedSessions = JSON.parse(cachedSessions);
        const parsedCourses = JSON.parse(cachedCourses);
        // Validate cache format - check if courses have 'name' field (not 'course_name')
        if (parsedCourses.length > 0 && parsedCourses[0].name !== undefined) {
          console.log('Loading valid cached data', parsedSessions.length, 'sessions');
          // Set state immediately with cached data
          set({ sessions: parsedSessions, courses: parsedCourses, loading: false });
        } else {
          console.log('Cache has invalid format, clearing...');
          await AsyncStorage.removeItem(STORAGE_KEY_SESSIONS);
          await AsyncStorage.removeItem(STORAGE_KEY_COURSES);
        }
      }

      // Fetch from API
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }
      
      const apiData: any = await response.json();
      
      // Handle different API response structures
      let coursesData: Course[] = [];
      let sessionsData: StudySession[] = [];
      
        // Check if API returns sessions directly
        if (Array.isArray(apiData) && apiData.length > 0) {
          // Check if first item has session properties (API format uses course_name, not courseName)
          const firstItem = apiData[0];
          if (firstItem.duration !== undefined && firstItem.course_name) {
            console.log('API returns sessions with course_name format');
            // API returns sessions - need to transform to our format
            sessionsData = (apiData as any[]).map((item, index) => ({
              id: item.id || `api-session-${Date.now()}-${index}`,
              courseId: `course-${item.course_name}`, // Use course_name as unique ID
              courseName: item.course_name,
              courseIcon: item.icon || '📖',
              duration: item.duration,
              date: item.date.split('T')[0], // Convert to YYYY-MM-DD
              notes: item.notes,
              completed: item.completion || false,
              createdAt: item.date,
              updatedAt: item.date,
            }));
            
            // Extract unique courses from sessions
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
              // Count lessons for this course
              const course = courseMap.get(courseId)!;
              course.totalLessons++;
              if (session.completed) {
                course.completedLessons++;
              }
            });
            coursesData = Array.from(courseMap.values());
            console.log('Extracted courses from sessions:', coursesData);
          } else {
          // API returns courses, transform to sessions
          coursesData = apiData as Course[];
          let sessionCounter = 0;
          sessionsData = coursesData.flatMap((course, courseIndex) => {
            const courseSessions: StudySession[] = [];
            const sessionCount = Math.min(course.completedLessons || 3, 7);
            const courseId = course.id || `course-${courseIndex}`;
            
            // Generate sessions spread over the past week
            for (let i = 0; i < sessionCount; i++) {
              const sessionDate = new Date();
              sessionDate.setDate(sessionDate.getDate() - (i % 7)); // Spread over 7 days
              sessionDate.setHours(9 + (i % 8), 0, 0, 0); // Different times
              
              const isCompleted = i < (course.completedLessons || 0);
              
              // Generate unique ID using counter and timestamp
              const uniqueId = `session-${Date.now()}-${sessionCounter++}-${courseId}-${i}`;
              
              const courseDisplayName = course.name || `Course ${courseIndex + 1}`;
              
              courseSessions.push({
                id: uniqueId,
                courseId: courseId,
                courseName: courseDisplayName,
                courseIcon: course.icon,
                duration: Math.floor(Math.random() * 90) + 45, // 45-135 minutes
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

      // Merge with existing local sessions to preserve local updates
      const { sessions: existingSessions } = get();
      const existingSessionMap = new Map(existingSessions.map(s => [s.id, s]));
      
      // Update existing sessions or add new ones from API
      const mergedSessions = sessionsData.map(apiSession => {
        const existing = existingSessionMap.get(apiSession.id);
        if (existing) {
          // Preserve local updates (like reminder settings, notes, etc.)
          // Only update if API has newer data or if local doesn't have certain fields
          return {
            ...apiSession,
            // Preserve local fields that might not be in API
            reminderEnabled: existing.reminderEnabled ?? apiSession.reminderEnabled,
            reminderTime: existing.reminderTime ?? apiSession.reminderTime,
            notificationId: existing.notificationId ?? apiSession.notificationId,
            notes: existing.notes || apiSession.notes,
            completed: existing.completed !== undefined ? existing.completed : apiSession.completed,
            // Keep local updatedAt if it's newer
            updatedAt: existing.updatedAt && new Date(existing.updatedAt) > new Date(apiSession.updatedAt || 0)
              ? existing.updatedAt
              : apiSession.updatedAt,
          };
        }
        return apiSession;
      });
      
      // Add any local-only sessions (not in API)
      existingSessions.forEach(localSession => {
        if (!sessionsData.find(s => s.id === localSession.id)) {
          mergedSessions.push(localSession);
        }
      });
      
      // Save merged data to cache
      await AsyncStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(mergedSessions));
      await AsyncStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(coursesData));
      
      set({ 
        sessions: mergedSessions, 
        courses: coursesData,
        loading: false 
      });
      
      console.log('Store: Fetched and merged sessions', {
        fromAPI: sessionsData.length,
        local: existingSessions.length,
        merged: mergedSessions.length
      });
    } catch (error) {
      // If API fails, try to use cached data
      const cachedSessions = await AsyncStorage.getItem(STORAGE_KEY_SESSIONS);
      const cachedCourses = await AsyncStorage.getItem(STORAGE_KEY_COURSES);
      
      if (cachedSessions && cachedCourses) {
        set({ 
          sessions: JSON.parse(cachedSessions),
          courses: JSON.parse(cachedCourses),
          loading: false,
          error: 'Using cached data. Check your connection.'
        });
      } else {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to load data',
          loading: false 
        });
      }
    }
  },

  fetchCourses: async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }
      const coursesData: Course[] = await response.json();
      await AsyncStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(coursesData));
      set({ courses: coursesData });
    } catch (error) {
      const cachedCourses = await AsyncStorage.getItem(STORAGE_KEY_COURSES);
      if (cachedCourses) {
        set({ courses: JSON.parse(cachedCourses) });
      }
    }
  },

  getDashboardStats: (): DashboardStats => {
    const { sessions, courses } = get();
    
    // Calculate total study hours this week
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekSessions = sessions.filter((session) => {
      const sessionDate = new Date(session.date);
      return sessionDate >= weekAgo;
    });
    
    const totalMinutesThisWeek = thisWeekSessions.reduce(
      (sum, session) => sum + session.duration,
      0
    );
    const totalStudyHoursThisWeek = Math.round((totalMinutesThisWeek / 60) * 10) / 10;

    // Find most active course
    const courseMinutes: Record<string, number> = {};
    thisWeekSessions.forEach((session) => {
      courseMinutes[session.courseId] = 
        (courseMinutes[session.courseId] || 0) + session.duration;
    });
    
    const mostActiveCourseId = Object.entries(courseMinutes).reduce(
      (a, b) => (a[1] > b[1] ? a : b),
      ['', 0]
    )[0];
    
    const mostActiveCourse = sessions.find(s => s.courseId === mostActiveCourseId)?.courseName || 'None';

    // Calculate completion percentage
    const totalLessons = courses.reduce((sum, course) => sum + course.totalLessons, 0);
    const completedLessons = courses.reduce((sum, course) => sum + course.completedLessons, 0);
    const completionPercentage = totalLessons > 0 
      ? Math.round((completedLessons / totalLessons) * 100) 
      : 0;

    // Calculate average daily time spent (this week)
    const daysInWeek = 7;
    const averageDailyTimeSpent = Math.round(totalMinutesThisWeek / daysInWeek);

    return {
      totalStudyHoursThisWeek,
      mostActiveCourse,
      completionPercentage,
      averageDailyTimeSpent,
    };
  },

  addSession: async (sessionData) => {
    try {
      console.log('Store: Adding session', sessionData);
      
      const newSession: StudySession = {
        ...sessionData,
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        reminderEnabled: sessionData.reminderEnabled || false,
        reminderTime: sessionData.reminderTime || '09:00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Schedule notification if reminder is enabled
      if (newSession.reminderEnabled && newSession.reminderTime) {
        try {
          const notificationDate = getNotificationDate(newSession.date, newSession.reminderTime);
          if (notificationDate > new Date()) {
            const notificationId = await NotificationService.scheduleNotification(
              newSession.id,
              'Study Reminder',
              `It's time to study your planned course: ${newSession.courseName}`,
              notificationDate
            );
            newSession.notificationId = notificationId;
          }
        } catch (error) {
          console.error('Failed to schedule notification:', error);
        }
      }

      console.log('Store: New session created', newSession);

      const { sessions } = get();
      const updatedSessions = [newSession, ...sessions];
      
      // Save to cache
      await AsyncStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updatedSessions));
      
      console.log('Store: Session saved successfully');
      set({ sessions: updatedSessions });
    } catch (error) {
      console.error('Store: Error adding session', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add session';
      set({ error: errorMessage });
      throw error;
    }
  },

  updateSession: async (id, sessionData) => {
    try {
      console.log('Store: Updating session', id, sessionData);
      
      const { sessions } = get();
      const existingSession = sessions.find(s => s.id === id);
      
      if (!existingSession) {
        throw new Error('Session not found');
      }
      
      const updatedSessions = sessions.map((session) => {
        if (session.id === id) {
          // Preserve important fields that shouldn't be overwritten
          const updated = {
            ...session, // Keep all existing fields first
            ...sessionData, // Then apply updates
            id: session.id, // Never change ID
            createdAt: session.createdAt, // Preserve creation date
            reminderEnabled: sessionData.reminderEnabled !== undefined 
              ? sessionData.reminderEnabled 
              : session.reminderEnabled, // Preserve if not provided
            reminderTime: sessionData.reminderTime !== undefined 
              ? sessionData.reminderTime 
              : session.reminderTime, // Preserve if not provided
            notificationId: session.notificationId, // Preserve notification ID
            updatedAt: new Date().toISOString(),
          };
          
          // Handle notification updates if reminder settings changed
          const reminderChanged = 
            (sessionData.reminderEnabled !== undefined && sessionData.reminderEnabled !== session.reminderEnabled) ||
            (sessionData.reminderTime !== undefined && sessionData.reminderTime !== session.reminderTime) ||
            (sessionData.date !== undefined && sessionData.date !== session.date);
          
          if (reminderChanged) {
            // Cancel existing notification
            if (session.notificationId) {
              NotificationService.cancelNotification(session.notificationId).catch(console.error);
              updated.notificationId = undefined;
            }
            
            // Schedule new notification if enabled
            if (updated.reminderEnabled && updated.reminderTime) {
              const notificationDate = getNotificationDate(updated.date, updated.reminderTime);
              if (notificationDate > new Date()) {
                NotificationService.scheduleNotification(
                  updated.id,
                  'Study Reminder',
                  `It's time to study your planned course: ${updated.courseName}`,
                  notificationDate
                ).then(notificationId => {
                  // Update session again with notification ID
                  const { sessions: currentSessions } = get();
                  const reUpdatedSessions = currentSessions.map(s =>
                    s.id === id ? { ...s, notificationId } : s
                  );
                  AsyncStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(reUpdatedSessions));
                  set({ sessions: reUpdatedSessions });
                }).catch(console.error);
              }
            }
          }
          
          return updated;
        }
        return session;
      });
      
      // Save to cache FIRST
      await AsyncStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updatedSessions));
      
      // Then update state - this ensures data is persisted
      set({ sessions: updatedSessions });
      
      // Verify the update
      const updatedSession = updatedSessions.find(s => s.id === id);
      console.log('Store: Session updated successfully', {
        id: updatedSession?.id,
        courseName: updatedSession?.courseName,
        date: updatedSession?.date,
        totalSessions: updatedSessions.length
      });
      
      // Double-check: reload from storage to ensure it's saved
      const savedSessions = await AsyncStorage.getItem(STORAGE_KEY_SESSIONS);
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        const savedSession = parsed.find((s: StudySession) => s.id === id);
        if (savedSession) {
          console.log('Store: Verified session saved to storage', savedSession.courseName);
        } else {
          console.error('Store: WARNING - Session not found in storage after save!');
        }
      }
    } catch (error) {
      console.error('Store: Error updating session', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update session';
      set({ error: errorMessage });
      throw error;
    }
  },

  toggleReminder: async (sessionId, reminderTime = '09:00') => {
    try {
      const { sessions } = get();
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const newReminderEnabled = !session.reminderEnabled;
      
      // Cancel existing notification
      if (session.notificationId) {
        await NotificationService.cancelNotification(session.notificationId);
      }

      let notificationId: string | undefined;
      
      // Schedule new notification if enabling
      if (newReminderEnabled) {
        const notificationDate = getNotificationDate(session.date, reminderTime);
        if (notificationDate > new Date()) {
          notificationId = await NotificationService.scheduleNotification(
            sessionId,
            'Study Reminder',
            `It's time to study your planned course: ${session.courseName}`,
            notificationDate
          );
        }
      }

      const updatedSessions = sessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              reminderEnabled: newReminderEnabled,
              reminderTime: reminderTime,
              notificationId,
              updatedAt: new Date().toISOString(),
            }
          : s
      );

      await AsyncStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updatedSessions));
      set({ sessions: updatedSessions });
    } catch (error) {
      console.error('Error toggling reminder:', error);
      throw error;
    }
  },

  addCourse: async (courseData) => {
    try {
      const newCourse: Course = {
        ...courseData,
        id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { courses } = get();
      const updatedCourses = [newCourse, ...courses];
      
      // Save to cache
      await AsyncStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(updatedCourses));
      
      set({ courses: updatedCourses });
      
      return newCourse;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add course'
      });
      throw error;
    }
  },

  clearCache: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_SESSIONS);
      await AsyncStorage.removeItem(STORAGE_KEY_COURSES);
      set({ sessions: [], courses: [], error: null });
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  },

  clearError: () => set({ error: null }),
}));

