import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/reduxStore';
import { 
  selectSessions,
  fetchSessions,
  toggleReminder
} from '../store/studySlice';
import { StudySession } from '../types';
import * as NotificationService from '../services/notifications';

export default function PlannerScreen() {
  const dispatch = useDispatch();
  const sessions = useSelector(selectSessions);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    NotificationService.registerForPushNotificationsAsync();
    dispatch(fetchSessions() as any);
  }, [dispatch]);

  // Get upcoming sessions (future dates or today)
  const getUpcomingSessions = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return sessions
      .filter(session => {
        const sessionDate = new Date(session.date);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate >= today && !session.completed;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        // If same date, sort by reminder time
        const timeA = a.reminderTime || '00:00';
        const timeB = b.reminderTime || '00:00';
        return timeA.localeCompare(timeB);
      });
  };

  const upcomingSessions = getUpcomingSessions();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'Not set';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleToggleReminder = async (session: StudySession) => {
    try {
      setLoading(true);
      const newReminderTime = session.reminderTime || '09:00';
      dispatch(toggleReminder({ sessionId: session.id, reminderTime: newReminderTime }));
    } catch (error) {
      Alert.alert('Error', 'Failed to update reminder. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetReminderTime = (session: StudySession) => {
    Alert.prompt(
      'Set Reminder Time',
      'Enter time in HH:mm format (e.g., 09:00)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set',
          onPress: async (time) => {
            if (time && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
              try {
                setLoading(true);
                dispatch(toggleReminder({ sessionId: session.id, reminderTime: time }));
                if (!session.reminderEnabled) {
                  dispatch(toggleReminder({ sessionId: session.id, reminderTime: time }));
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to set reminder time.');
              } finally {
                setLoading(false);
              }
            } else {
              Alert.alert('Invalid Format', 'Please enter time in HH:mm format (e.g., 09:00)');
            }
          },
        },
      ],
      'plain-text',
      session.reminderTime || '09:00'
    );
  };

  const renderSession = ({ item }: { item: StudySession }) => {
    const icon = item.courseIcon || '📖';
    
    return (
      <View style={styles.sessionCard}>
        <View style={styles.sessionHeader}>
          <View style={styles.courseInfo}>
            <Text style={styles.courseIcon}>{icon}</Text>
            <View style={styles.courseDetails}>
              <Text style={styles.courseName}>{item.courseName}</Text>
              <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sessionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration:</Text>
            <Text style={styles.detailValue}>{item.duration} minutes</Text>
          </View>
          
          <View style={styles.reminderSection}>
            <View style={styles.reminderRow}>
              <View style={styles.reminderInfo}>
                <Text style={styles.reminderLabel}>Reminder</Text>
                {item.reminderEnabled && (
                  <Text style={styles.reminderTime}>
                    {formatTime(item.reminderTime)}
                  </Text>
                )}
              </View>
              <Switch
                value={item.reminderEnabled || false}
                onValueChange={() => handleToggleReminder(item)}
                disabled={loading}
              />
            </View>
            
            {item.reminderEnabled && (
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => handleSetReminderTime(item)}
              >
                <Text style={styles.timeButtonText}>
                  {item.reminderTime ? `Change time (${formatTime(item.reminderTime)})` : 'Set time'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Study Planner</Text>
        <Text style={styles.headerSubtitle}>
          {upcomingSessions.length} upcoming session{upcomingSessions.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}

      {upcomingSessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyText}>No upcoming sessions</Text>
          <Text style={styles.emptySubtext}>
            Add study sessions to see them here
          </Text>
        </View>
      ) : (
        <FlatList
          data={upcomingSessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    padding: 10,
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  courseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  sessionDetails: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  reminderSection: {
    marginTop: 8,
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderInfo: {
    flex: 1,
  },
  reminderLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  reminderTime: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  timeButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

