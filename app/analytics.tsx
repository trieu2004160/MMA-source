import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store/reduxStore';
import {
  getDailyMinutesThisWeek,
  getCourseCompletionData,
} from '../store/studySlice';
import { BarChart, LineChart } from 'react-native-gifted-charts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 40;

export default function AnalyticsScreen() {
  const dailyMinutes = useSelector(getDailyMinutesThisWeek);
  const courseCompletion = useSelector(getCourseCompletionData);

  const hasData = dailyMinutes.some(day => day.minutes > 0) || courseCompletion.length > 0;

  // Prepare data for BarChart (daily minutes)
  const barChartData = dailyMinutes.map((day, index) => ({
    value: day.minutes,
    label: day.day,
    spacing: 2,
    labelWidth: 40,
    labelTextStyle: { color: '#666', fontSize: 12 },
    frontColor: '#007AFF',
    gradientColor: '#4DA3FF',
    topLabelComponent: () => (
      <Text style={styles.barTopLabel}>{day.minutes > 0 ? day.minutes : ''}</Text>
    ),
  }));

  // Prepare data for LineChart (course completion)
  const lineChartData = courseCompletion.map((course, index) => ({
    value: course.completionPercentage,
    label: course.courseName.length > 8 
      ? course.courseName.substring(0, 8) + '...' 
      : course.courseName,
    labelTextStyle: { color: '#666', fontSize: 10 },
  }));

  const maxMinutes = Math.max(...dailyMinutes.map(d => d.minutes), 1);
  const maxCompletion = Math.max(...courseCompletion.map(c => c.completionPercentage), 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
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
            <Text style={styles.chartTitle}>Total Minutes Studied Per Day</Text>
            <Text style={styles.chartSubtitle}>This Week</Text>
            
            {dailyMinutes.some(day => day.minutes > 0) ? (
              <View style={styles.chartWrapper}>
                <BarChart
                  data={barChartData}
                  width={CHART_WIDTH}
                  height={220}
                  barWidth={32}
                  spacing={20}
                  roundedTop
                  roundedBottom
                  hideRules
                  xAxisThickness={1}
                  xAxisColor="#E0E0E0"
                  yAxisThickness={1}
                  yAxisColor="#E0E0E0"
                  yAxisTextStyle={{ color: '#666', fontSize: 10 }}
                  maxValue={maxMinutes > 0 ? Math.ceil(maxMinutes * 1.2) : 60}
                  noOfSections={4}
                  yAxisLabelSuffix="m"
                  showGradient
                  gradientColor="#4DA3FF"
                />
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>No study sessions this week</Text>
              </View>
            )}
          </View>

          {/* Course Completion Chart */}
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Completion Progress by Course</Text>
            <Text style={styles.chartSubtitle}>Percentage (%)</Text>
            
            {courseCompletion.length > 0 ? (
              <View style={styles.chartWrapper}>
                <LineChart
                  data={lineChartData}
                  width={CHART_WIDTH}
                  height={220}
                  spacing={40}
                  thickness={3}
                  color="#4CAF50"
                  hideRules={false}
                  rulesType="solid"
                  rulesColor="#E0E0E0"
                  xAxisThickness={1}
                  xAxisColor="#E0E0E0"
                  yAxisThickness={1}
                  yAxisColor="#E0E0E0"
                  yAxisTextStyle={{ color: '#666', fontSize: 10 }}
                  maxValue={100}
                  noOfSections={4}
                  yAxisLabelSuffix="%"
                  curved
                  areaChart
                  startFillColor="#4CAF50"
                  endFillColor="#E8F5E9"
                  startOpacity={0.4}
                  endOpacity={0.1}
                  dataPointsColor="#4CAF50"
                  dataPointsRadius={4}
                  textShiftY={-10}
                  textShiftX={-5}
                  textFontSize={10}
                  textColor="#333"
                />
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>No courses with lessons</Text>
              </View>
            )}

            {/* Course completion details */}
            {courseCompletion.length > 0 && (
              <View style={styles.completionList}>
                {courseCompletion.map((course) => (
                  <View key={course.courseId} style={styles.completionItem}>
                    <View style={styles.completionInfo}>
                      <Text style={styles.completionCourseName} numberOfLines={1}>
                        {course.courseName}
                      </Text>
                      <Text style={styles.completionDetails}>
                        {course.completedLessons} / {course.totalLessons} lessons
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
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
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
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  chartWrapper: {
    alignItems: 'center',
    marginTop: 10,
  },
  barTopLabel: {
    color: '#007AFF',
    fontSize: 10,
    fontWeight: '600',
  },
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
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
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  completionDetails: {
    fontSize: 12,
    color: '#666',
  },
  completionBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  completionBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  completionBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  completionPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    minWidth: 40,
    textAlign: 'right',
  },
});

