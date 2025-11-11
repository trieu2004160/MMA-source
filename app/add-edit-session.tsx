import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../store/reduxStore";
import {
  addCourse,
  addSession,
  fetchCourses,
  fetchSessions,
  selectCourses,
  selectSessions,
  updateSession,
} from "../store/studySlice";

export default function AddEditSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const sessions = useSelector(selectSessions);
  const courses = useSelector(selectCourses);

  const isEditMode = !!params.id;
  const existingSession = isEditMode
    ? sessions.find((s) => s.id === params.id)
    : null;

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState<string>("");
  const [completed, setCompleted] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showCoursePicker, setShowCoursePicker] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showNewCourseModal, setShowNewCourseModal] = useState<boolean>(false);
  const [newCourseName, setNewCourseName] = useState<string>("");
  const [newCourseIcon, setNewCourseIcon] = useState<string>("📖");

  useEffect(() => {
    dispatch(fetchCourses() as any);
    dispatch(fetchSessions() as any);
  }, [dispatch]);

  useEffect(() => {
    if (existingSession) {
      console.log("Loading existing session:", existingSession);
      console.log("Existing courseId:", existingSession.courseId);
      console.log("Available courses:", courses);

      const courseExists = courses.find(
        (c) => c.id === existingSession.courseId
      );
      console.log("Course found?", courseExists);

      // If course doesn't exist, create it automatically
      if (!courseExists && existingSession.courseName) {
        console.log("Course not found, creating it automatically...");
        dispatch(
          addCourse({
            name: existingSession.courseName,
            icon: existingSession.courseIcon || "📖",
            totalLessons: 1,
            completedLessons: existingSession.completed ? 1 : 0,
          }) as any
        );
      }

      setSelectedCourseId(existingSession.courseId);
      setDuration(existingSession.duration.toString());
      setSelectedDate(new Date(existingSession.date));
      setNotes(existingSession.notes || "");
      setCompleted(existingSession.completed);
    }
  }, [existingSession, courses, dispatch]);

  useEffect(() => {
    console.log("Selected course ID changed:", selectedCourseId);
    const course = courses.find((c) => c.id === selectedCourseId);
    console.log("Selected course:", course);
  }, [selectedCourseId, courses]);

  const handleSave = async () => {
    // Validation
    if (!selectedCourseId) {
      Alert.alert("Course Required", "Please select a course before saving.", [
        {
          text: "Select Course",
          onPress: () => setShowCoursePicker(true),
        },
      ]);
      return;
    }

    const durationNum = parseInt(duration, 10);
    if (!duration || isNaN(durationNum) || durationNum <= 0) {
      Alert.alert("Error", "Please enter a valid duration in minutes");
      return;
    }

    const selectedCourse = courses.find((c) => c.id === selectedCourseId);
    if (!selectedCourse) {
      Alert.alert("Error", "Selected course not found");
      return;
    }

    try {
      const sessionData = {
        courseId: selectedCourseId,
        courseName: selectedCourse.name || "Unknown Course",
        courseIcon: selectedCourse.icon,
        duration: durationNum,
        date: selectedDate.toISOString().split("T")[0],
        notes: notes.trim() || undefined,
        completed,
      };

      console.log("Saving session data:", sessionData);

      if (isEditMode && params.id) {
        await dispatch(updateSession({ id: params.id, session: sessionData }));
      } else {
        await dispatch(addSession(sessionData));
      }

      router.back();
    } catch (error) {
      console.error("Save error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to save session. Please try again.";
      Alert.alert("Error", errorMessage);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleCreateCourse = async () => {
    if (!newCourseName.trim()) {
      Alert.alert("Error", "Please enter a course name");
      return;
    }

    try {
      const result = await dispatch(
        addCourse({
          name: newCourseName.trim(),
          icon: newCourseIcon,
          totalLessons: 0,
          completedLessons: 0,
        }) as any
      );

      // Wait for state to update and Redux Persist to save
      await new Promise(resolve => setTimeout(resolve, 300));

      // Get the new course from the result payload
      const newCourse = result.payload;
      if (!newCourse) {
        Alert.alert("Error", "Failed to create course");
        return;
      }

      console.log("Course created:", newCourse);

      // Close modal first
      setShowNewCourseModal(false);
      setShowCoursePicker(false);

      // Then select the course
      setSelectedCourseId(newCourse.id);

      // Reset form
      setNewCourseName("");
      setNewCourseIcon("📖");

      // Show success message
      Alert.alert(
        "Success",
        `Course "${newCourse.name}" created and selected!`
      );
    } catch (error) {
      console.error("Create course error:", error);
      Alert.alert("Error", "Failed to create course. Please try again.");
    }
  };

  const commonIcons = [
    "📖",
    "📚",
    "💻",
    "🔬",
    "📐",
    "🎨",
    "🎵",
    "⚽",
    "🌍",
    "📝",
    "🧪",
    "🎭",
  ];

  const filteredCourses = courses.filter((course) => {
    const courseName = course.name || "";
    return courseName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  console.log("Render - Selected course ID:", selectedCourseId);
  console.log("Render - Selected course:", selectedCourse);
  console.log("Render - Total courses:", courses.length);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Course Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Course *</Text>
          <TouchableOpacity
            style={[
              styles.pickerButton,
              !selectedCourseId && styles.pickerButtonRequired,
              selectedCourseId && styles.pickerButtonSelected,
            ]}
            onPress={() => setShowCoursePicker(true)}
          >
            <Text
              style={[
                styles.pickerText,
                !selectedCourseId && styles.placeholder,
              ]}
            >
              {selectedCourse
                ? `${selectedCourse.icon || "📖"} ${
                    selectedCourse.name || "Unknown Course"
                  }`
                : "Select a course"}
            </Text>
            <Text style={styles.arrow}>▼</Text>
          </TouchableOpacity>
          {!selectedCourseId && (
            <Text style={styles.helperText}>
              Tap to select a course or create a new one
            </Text>
          )}
          {selectedCourseId && selectedCourse && (
            <Text style={styles.successText}>
              ✓ Course selected: {selectedCourse.name}
            </Text>
          )}
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.label}>Duration (minutes) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter duration in minutes"
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
        </View>

        {/* Date Picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Date *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.pickerText}>{formatDate(selectedDate)}</Text>
            <Text style={styles.arrow}>📅</Text>
          </TouchableOpacity>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add notes about this study session..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor="#999"
          />
        </View>

        {/* Completion Checkbox */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setCompleted(!completed)}
          >
            <View
              style={[styles.checkbox, completed && styles.checkboxChecked]}
            >
              {completed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Mark as completed</Text>
          </TouchableOpacity>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>
              {isEditMode ? "Update" : "Save"} Session
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Course Picker Modal */}
      <Modal
        visible={showCoursePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCoursePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Course</Text>
              <TouchableOpacity
                onPress={() => setShowCoursePicker(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search courses..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />

            <ScrollView style={styles.courseList}>
              {courses.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No courses available</Text>
                  <Text style={styles.emptySubtext}>
                    Create a new course to get started
                  </Text>
                </View>
              ) : filteredCourses.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No courses match "{searchQuery}"
                  </Text>
                  <Text style={styles.emptySubtext}>
                    Try a different search term or create a new course
                  </Text>
                </View>
              ) : (
                filteredCourses.map((course) => (
                  <TouchableOpacity
                    key={course.id}
                    style={[
                      styles.courseItem,
                      selectedCourseId === course.id &&
                        styles.courseItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedCourseId(course.id);
                      setShowCoursePicker(false);
                      setSearchQuery("");
                    }}
                  >
                    <Text style={styles.courseIcon}>{course.icon || "📖"}</Text>
                    <Text style={styles.courseName}>
                      {course.name || `Course ${course.id}`}
                    </Text>
                    {selectedCourseId === course.id && (
                      <Text style={styles.selectedIcon}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.createCourseButton}
              onPress={() => {
                setShowCoursePicker(false);
                setShowNewCourseModal(true);
              }}
            >
              <Text style={styles.createCourseButtonText}>
                + Create New Course
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Course Modal */}
      <Modal
        visible={showNewCourseModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewCourseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Course</Text>
              <TouchableOpacity
                onPress={() => setShowNewCourseModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.newCourseForm}>
              <Text style={styles.label}>Course Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter course name"
                value={newCourseName}
                onChangeText={setNewCourseName}
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Choose Icon</Text>
              <View style={styles.iconGrid}>
                {commonIcons.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconButton,
                      newCourseIcon === icon && styles.iconButtonSelected,
                    ]}
                    onPress={() => setNewCourseIcon(icon)}
                  >
                    <Text style={styles.iconText}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowNewCourseModal(false);
                    setNewCourseName("");
                    setNewCourseIcon("📖");
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleCreateCourse}
                >
                  <Text style={styles.saveButtonText}>Create Course</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.datePickerContainer}>
              {Array.from({ length: 30 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const isSelected =
                  date.toDateString() === selectedDate.toDateString();

                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.dateItem,
                      isSelected && styles.dateItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedDate(date);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dateText,
                        isSelected && styles.dateTextSelected,
                      ]}
                    >
                      {formatDate(date)}
                    </Text>
                    {isSelected && <Text style={styles.selectedIcon}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    color: "#FF9800",
    marginTop: 6,
    fontStyle: "italic",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    color: "#333",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
  pickerButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerButtonRequired: {
    borderColor: "#FF9800",
    borderWidth: 2,
  },
  pickerButtonSelected: {
    borderColor: "#4CAF50",
    borderWidth: 2,
  },
  pickerText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  placeholder: {
    color: "#999",
  },
  arrow: {
    fontSize: 12,
    color: "#666",
    marginLeft: 8,
  },
  successText: {
    fontSize: 12,
    color: "#4CAF50",
    marginTop: 6,
    fontWeight: "500",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#007AFF",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 24,
    color: "#666",
  },
  searchInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 12,
    margin: 20,
    marginBottom: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  courseList: {
    maxHeight: 400,
  },
  courseItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  courseItemSelected: {
    backgroundColor: "#E3F2FD",
  },
  courseIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  courseName: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  selectedIcon: {
    fontSize: 20,
    color: "#007AFF",
    fontWeight: "bold",
  },
  datePickerContainer: {
    maxHeight: 400,
  },
  dateItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  dateItemSelected: {
    backgroundColor: "#E3F2FD",
  },
  dateText: {
    fontSize: 16,
    color: "#333",
  },
  dateTextSelected: {
    fontWeight: "600",
    color: "#007AFF",
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    textAlign: "center",
    padding: 20,
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
  },
  emptySubtext: {
    textAlign: "center",
    paddingHorizontal: 20,
    color: "#999",
    fontSize: 14,
    marginTop: 8,
  },
  createCourseButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    margin: 20,
    marginTop: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  createCourseButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  newCourseForm: {
    padding: 20,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
    marginBottom: 20,
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  iconButtonSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#E3F2FD",
  },
  iconText: {
    fontSize: 28,
  },
});
