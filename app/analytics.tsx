import { useRouter } from "expo-router";
import React from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { useSelector } from "react-redux";
import { RootState } from "../store/reduxStore";
import {
  getCourseCompletionData,
  getWeeklyStudyData,
} from "../store/studySlice";
import { CourseCompletionData, DailyMinutesData } from "../types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 40;

export default function AnalyticsScreen() {
  const router = useRouter();
  const weeklyData = useSelector((state: RootState) =>
    getWeeklyStudyData(state)
  );
  const courseCompletion = useSelector((state: RootState) =>
    getCourseCompletionData(state)
  );

  const hasWeeklyData = weeklyData.some(
    (day: DailyMinutesData) => day.minutes > 0
  );
  const hasCourseData = courseCompletion.length > 0;
  const hasData = hasWeeklyData || hasCourseData;

  // Prepare data for BarChart (daily minutes) - react-native-chart-kit format
  const weeklyChartData = {
    labels: weeklyData.map((d: DailyMinutesData) => d.day),
    datasets: [
      {
        data: weeklyData.map((d: DailyMinutesData) => d.minutes || 0.1), // Minimum 0.1 to show bar
      },
    ],
  };

  // Prepare data for LineChart (course completion) - react-native-chart-kit format
  const courseChartData = hasCourseData
    ? {
        labels: courseCompletion.map((c: CourseCompletionData) =>
          c.courseName.length > 10
            ? c.courseName.substring(0, 10) + "..."
            : c.courseName
        ),
        datasets: [
          {
            data: courseCompletion.map(
              (c: CourseCompletionData) => c.completionPercentage || 0.1
            ),
          },
        ],
      }
    : null;

  const chartConfig = {
    backgroundColor: "#ffffff",
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "6",
      strokeWidth: "2",
      stroke: "#007AFF",
    },
    propsForBackgroundLines: {
      strokeDasharray: "",
      stroke: "#E0E0E0",
      strokeWidth: 1,
    },
  };

  const maxMinutes = Math.max(
    ...weeklyData.map((d: DailyMinutesData) => d.minutes),
    1
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Learning Analytics</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {!hasData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No Study Data This Week</Text>
            <Text style={styles.emptySubtext}>
              Start studying to see your analytics here!
            </Text>
          </View>
        ) : (
          <>
            {/* Daily Minutes Chart */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>
                📊 Total Minutes Studied Per Day
              </Text>
              <Text style={styles.chartSubtitle}>This Week</Text>

              {hasWeeklyData ? (
                <View style={styles.chartWrapper}>
                  <BarChart
                    data={weeklyChartData}
                    width={CHART_WIDTH - 40}
                    height={220}
                    yAxisLabel=""
                    yAxisSuffix="m"
                    chartConfig={chartConfig}
                    style={styles.chart}
                    fromZero
                    showValuesOnTopOfBars
                  />
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Total</Text>
                      <Text style={styles.statValue}>
                        {weeklyData.reduce(
                          (sum: number, d: DailyMinutesData) => sum + d.minutes,
                          0
                        )}
                        m
                      </Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Average</Text>
                      <Text style={styles.statValue}>
                        {Math.round(
                          weeklyData.reduce(
                            (sum: number, d: DailyMinutesData) =>
                              sum + d.minutes,
                            0
                          ) / 7
                        )}
                        m/day
                      </Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Peak Day</Text>
                      <Text style={styles.statValue}>
                        {
                          weeklyData.reduce(
                            (max: DailyMinutesData, d: DailyMinutesData) =>
                              d.minutes > max.minutes ? d : max
                          ).day
                        }
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>
                    No study sessions this week
                  </Text>
                </View>
              )}
            </View>

            {/* Course Completion Chart */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>
                🎯 Completion Progress by Course
              </Text>
              <Text style={styles.chartSubtitle}>Percentage (%)</Text>

              {hasCourseData && courseChartData ? (
                <View style={styles.chartWrapper}>
                  <LineChart
                    data={courseChartData}
                    width={CHART_WIDTH - 40}
                    height={220}
                    yAxisSuffix="%"
                    chartConfig={chartConfig}
                    style={styles.chart}
                    fromZero
                    bezier
                  />
                  {/* Course completion details */}
                  <View style={styles.completionList}>
                    {courseCompletion.map((course) => (
                      <View key={course.courseId} style={styles.completionItem}>
                        <View style={styles.completionInfo}>
                          <Text
                            style={styles.completionCourseName}
                            numberOfLines={1}
                          >
                            {course.courseName}
                          </Text>
                          <Text style={styles.completionDetails}>
                            {course.completedLessons} / {course.totalLessons}{" "}
                            lessons
                          </Text>
                        </View>
                        <View style={styles.completionBarContainer}>
                          <View style={styles.completionBarBackground}>
                            <View
                              style={[
                                styles.completionBarFill,
                                { width: `${course.completionPercentage}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.completionPercentage}>
                            {course.completionPercentage}%
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>No courses with lessons</Text>
                </View>
              )}
            </View>

            {/* Insights Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💡 Insights</Text>
              <View style={styles.insightCard}>
                <Text style={styles.insightIcon}>🔥</Text>
                <Text style={styles.insightText}>
                  {hasWeeklyData
                    ? `You studied ${weeklyData.reduce(
                        (sum: number, d: DailyMinutesData) => sum + d.minutes,
                        0
                      )} minutes this week!`
                    : "Start your learning journey today!"}
                </Text>
              </View>
              {hasCourseData && (
                <View style={styles.insightCard}>
                  <Text style={styles.insightIcon}>🎓</Text>
                  <Text style={styles.insightText}>
                    {courseCompletion.filter(
                      (c) => c.completionPercentage === 100
                    ).length > 0
                      ? `${
                          courseCompletion.filter(
                            (c) => c.completionPercentage === 100
                          ).length
                        } course(s) completed!`
                      : `Keep going! ${courseCompletion.length} course(s) in progress`}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    width: 60,
  },
  backButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  chartContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  chartWrapper: {
    alignItems: "center",
    marginTop: 10,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  statBox: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#007AFF",
  },
  barTopLabel: {
    color: "#007AFF",
    fontSize: 10,
    fontWeight: "600",
  },
  noDataContainer: {
    padding: 40,
    alignItems: "center",
  },
  noDataText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },
  completionList: {
    marginTop: 20,
  },
  completionItem: {
    marginBottom: 16,
  },
  completionInfo: {
    marginBottom: 8,
  },
  completionCourseName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  completionDetails: {
    fontSize: 12,
    color: "#666",
  },
  completionBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  completionBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    overflow: "hidden",
  },
  completionBarFill: {
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 4,
  },
  completionPercentage: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4CAF50",
    minWidth: 40,
    textAlign: "right",
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  insightIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  insightText: {
    fontSize: 15,
    color: "#333",
    flex: 1,
    fontWeight: "500",
  },
});
