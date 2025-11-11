export interface StudySession {
  id: string;
  courseId: string;
  courseName: string;
  courseIcon?: string;
  duration: number; // in minutes
  date: string; // ISO date string
  notes?: string;
  completed: boolean;
  reminderEnabled?: boolean;
  reminderTime?: string; // Time in HH:mm format
  notificationId?: string; // Expo notification identifier
  createdAt?: string;
  updatedAt?: string;
}

export interface Course {
  id: string;
  name: string;
  icon?: string;
  totalLessons: number;
  completedLessons: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardStats {
  totalStudyHoursThisWeek: number;
  mostActiveCourse: string;
  completionPercentage: number;
  averageDailyTimeSpent: number; // in minutes
}

export interface DailyMinutesData {
  day: string; // e.g., "Mon", "Tue"
  date: string; // e.g., "2024-01-15"
  minutes: number;
}

export interface CourseCompletionData {
  courseName: string;
  courseId: string;
  completionPercentage: number;
  completedLessons: number;
  totalLessons: number;
}

export interface StudyRecommendation {
  courseId: string;
  courseName: string;
  courseIcon?: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  suggestedMinutes: number;
  score: number; // 0-100, higher = more urgent
}
