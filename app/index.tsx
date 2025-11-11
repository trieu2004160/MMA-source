import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store/reduxStore";
import {
  clearCache,
  clearError,
  fetchSessions,
  selectError,
  selectLoading,
  selectSessions,
  getStudyRecommendations,
} from "../store/studySlice";
import { Course, StudySession } from "../types";

export default function DashboardScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const sessions = useSelector(selectSessions);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const courses = useSelector((state: RootState) => state.study.courses);
  const recommendations = useSelector(getStudyRecommendations);
  
  // Debug logging
  React.useEffect(() => {
    console.log('📊 Dashboard Debug:');
    console.log('  - Sessions:', sessions.length);
    console.log('  - Courses:', courses.length);
    console.log('  - Recommendations:', recommendations.length);
    if (courses.length > 0) {
      console.log('  - Course details:', courses.map(c => ({
        name: c.name,
        totalLessons: c.totalLessons,
        completedLessons: c.completedLessons
      })));
    }
    if (recommendations.length > 0) {
      console.log('  - Recommendation details:', recommendations);
    }
  }, [sessions, courses, recommendations]);

  // Calculate stats
  const stats = React.useMemo(() => {
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
    const totalStudyHoursThisWeek =
      Math.round((totalMinutesThisWeek / 60) * 10) / 10;

    const courseMinutes: Record<string, number> = {};
    thisWeekSessions.forEach((session: StudySession) => {
      courseMinutes[session.courseId] =
        (courseMinutes[session.courseId] || 0) + session.duration;
    });

    const mostActiveCourseId = Object.entries(courseMinutes).reduce(
      (a, b) => (a[1] > b[1] ? a : b),
      ["", 0] as [string, number]
    )[0];

    const mostActiveCourse =
      sessions.find((s: StudySession) => s.courseId === mostActiveCourseId)
        ?.courseName || "None";

    const totalLessons = courses.reduce(
      (sum: number, course: Course) => sum + course.totalLessons,
      0
    );
    const completedLessons = courses.reduce(
      (sum: number, course: Course) => sum + course.completedLessons,
      0
    );
    const completionPercentage =
      totalLessons > 0
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
  }, [sessions, courses]);

  useEffect(() => {
    dispatch(fetchSessions() as any);
  }, [dispatch]);

  // Reload sessions when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        dispatch(fetchSessions() as any);
      }, 300);
      return () => clearTimeout(timer);
    }, [dispatch])
  );

  useEffect(() => {
    if (error) {
      Alert.alert("Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error, dispatch]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year:
          date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getCourseIcon = (icon?: string, courseName?: string) => {
    if (icon) return icon;
    // Default icons based on course name
    const defaultIcons: Record<string, string> = {
      math: "📐",
      science: "🔬",
      english: "📚",
      history: "📜",
      programming: "💻",
    };
    const lowerName = courseName?.toLowerCase() || "";
    for (const [key, emoji] of Object.entries(defaultIcons)) {
      if (lowerName.includes(key)) return emoji;
    }
    return "📖"; // Default icon
  };

  const renderSession = ({ item }: { item: StudySession }) => {
    const icon = getCourseIcon(item.courseIcon, item.courseName);

    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => router.push(`/add-edit-session?id=${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.sessionHeader}>
          <View style={styles.courseInfo}>
            <Text style={styles.courseIcon}>{icon}</Text>
            <View style={styles.courseDetails}>
              <Text style={styles.courseName}>
                {item.courseName || "Unknown Course"}
              </Text>
              <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            </View>
          </View>
          <View style={styles.statusContainer}>
            {item.completed ? (
              <Text style={styles.completedIcon}>✔</Text>
            ) : (
              <Text style={styles.pendingIcon}>⏳</Text>
            )}
            <Text style={styles.editHint}>Tap to edit</Text>
          </View>
        </View>

        <View style={styles.sessionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration:</Text>
            <Text style={styles.detailValue}>
              {formatDuration(item.duration)}
            </Text>
          </View>
          {item.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesText} numberOfLines={2}>
                {item.notes}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <View style={styles.container}>
      {/* Summary Header */}
      <TouchableOpacity
        onLongPress={() => {
          Alert.alert(
            "Clear Cache",
            "Do you want to clear all cached data and reload from API?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Clear & Reload",
                style: "destructive",
                onPress: async () => {
                  dispatch(clearCache());
                  dispatch(fetchSessions() as any);
                },
              },
            ]
          );
        }}
        activeOpacity={1}
      >
        <View style={styles.header}>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.plannerButton}
                onPress={() => router.push("/planner")}
              >
                <Text style={styles.plannerButtonText}>📅 Planner</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.analyticsButton}
                onPress={() => router.push("/analytics")}
              >
                <Text style={styles.analyticsButtonText}>📊 Analytics</Text>
              </TouchableOpacity>
            </View>
          
          {/* AI Recommendations Card */}
          {recommendations && recommendations.length > 0 ? (
            <View style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <Text style={styles.aiIcon}>🤖</Text>
                <View style={styles.aiTitleContainer}>
                  <Text style={styles.aiTitle}>AI Study Recommendations</Text>
                  <Text style={styles.aiSubtitle}>Smart priorities for your learning</Text>
                </View>
              </View>
              
              {recommendations.map((rec, index) => {
                const priorityColor = 
                  rec.priority === 'high' ? '#FF5722' :
                  rec.priority === 'medium' ? '#FF9800' : '#4CAF50';
                
                return (
                  <View key={rec.courseId} style={styles.recommendationItem}>
                    <View style={styles.recommendationHeader}>
                      <View style={styles.recommendationLeft}>
                        <Text style={styles.recommendationIcon}>
                          {rec.courseIcon || '📖'}
                        </Text>
                        <View style={styles.recommendationInfo}>
                          <Text style={styles.recommendationCourse} numberOfLines={1}>
                            {rec.courseName}
                          </Text>
                          <Text style={styles.recommendationReason} numberOfLines={2}>
                            {rec.reason}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
                        <Text style={styles.priorityText}>{rec.priority.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.recommendationFooter}>
                      <View style={styles.suggestedTime}>
                        <Text style={styles.suggestedTimeLabel}>Suggested:</Text>
                        <Text style={styles.suggestedTimeValue}>{rec.suggestedMinutes} min</Text>
                      </View>
                      <View style={styles.scoreContainer}>
                        <Text style={styles.scoreLabel}>Priority Score:</Text>
                        <Text style={[styles.scoreValue, { color: priorityColor }]}>
                          {rec.score}/100
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : courses.length > 0 ? (
            // Show debug info if courses exist but no recommendations
            <View style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <Text style={styles.aiIcon}>🤖</Text>
                <View style={styles.aiTitleContainer}>
                  <Text style={styles.aiTitle}>AI Study Recommendations</Text>
                  <Text style={styles.aiSubtitle}>No recommendations available</Text>
                </View>
              </View>
              <View style={styles.recommendationItem}>
                <Text style={styles.recommendationReason}>
                  Courses found: {courses.length}. 
                  Courses with lessons: {courses.filter(c => c.totalLessons > 0).length}.
                  {courses.filter(c => c.totalLessons > 0).length === 0 && 
                    ' Please add courses with lessons to see recommendations.'}
                </Text>
              </View>
            </View>
          ) : null}
          
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Study Hours</Text>
            <Text style={styles.statValue}>
              {stats.totalStudyHoursThisWeek}
            </Text>
            <Text style={styles.statSubtext}>This Week</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Most Active</Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {stats.mostActiveCourse}
            </Text>
            <Text style={styles.statSubtext}>Course</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Completion</Text>
            <Text style={styles.statValue}>{stats.completionPercentage}%</Text>
            <Text style={styles.statSubtext}>All Lessons</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Avg Daily</Text>
            <Text style={styles.statValue}>
              {formatDuration(stats.averageDailyTimeSpent)}
            </Text>
            <Text style={styles.statSubtext}>Time Spent</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Sessions List */}
      {loading && sessions.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading study sessions...</Text>
        </View>
      ) : (
        <FlatList
          data={sortedSessions}
          renderItem={renderSession}
          keyExtractor={(item, index) =>
            item.id
              ? String(item.id)
              : `session-${index}-${item.date}-${item.courseName}`
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => dispatch(fetchSessions() as any)}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>No study sessions yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button below to add your first study session
              </Text>
              <TouchableOpacity
                style={styles.emptyAddButton}
                onPress={() => router.push("/add-edit-session")}
              >
                <Text style={styles.emptyAddButtonText}>+ Add Session</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Add Button - Floating Action Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push("/add-edit-session")}
        activeOpacity={0.8}
      >
        <View style={styles.addButtonContent}>
          <Text style={styles.addButtonText}>+</Text>
        </View>
        <View style={styles.addButtonLabel}>
          <Text style={styles.addButtonLabelText}>Add Session</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    flexWrap: "wrap",
  },
  statCard: {
    alignItems: "center",
    flex: 1,
    minWidth: "22%",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginBottom: 4,
    fontWeight: "500",
    textAlign: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 2,
    textAlign: "center",
  },
  statSubtext: {
    fontSize: 9,
    color: "#999",
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  sessionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  courseInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  courseIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  courseDetails: {
    flex: 1,
  },
  courseName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  statusContainer: {
    marginLeft: 12,
    alignItems: "flex-end",
  },
  editHint: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
    fontStyle: "italic",
  },
  completedIcon: {
    fontSize: 24,
    color: "#4CAF50",
  },
  pendingIcon: {
    fontSize: 24,
    color: "#FF9800",
  },
  sessionDetails: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  notesContainer: {
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    fontWeight: "500",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  addButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    alignItems: "center",
  },
  addButtonContent: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  addButtonText: {
    fontSize: 36,
    color: "#FFFFFF",
    fontWeight: "300",
    lineHeight: 40,
  },
  addButtonLabel: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 8,
  },
  addButtonLabelText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  emptyAddButton: {
    marginTop: 20,
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyAddButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  plannerButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  plannerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  analyticsButton: {
    flex: 1,
    backgroundColor: "#4CAF50",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  analyticsButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  aiCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  aiIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  aiTitleContainer: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },
  aiSubtitle: {
    fontSize: 12,
    color: "#666",
  },
  recommendationItem: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  recommendationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  recommendationLeft: {
    flexDirection: "row",
    flex: 1,
    marginRight: 12,
  },
  recommendationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  recommendationInfo: {
    flex: 1,
  },
  recommendationCourse: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  recommendationReason: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    alignItems: "center",
  },
  priorityText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  recommendationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  suggestedTime: {
    flexDirection: "row",
    alignItems: "center",
  },
  suggestedTimeLabel: {
    fontSize: 12,
    color: "#666",
    marginRight: 6,
  },
  suggestedTimeValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 12,
    color: "#666",
    marginRight: 6,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: "700",
  },
});
