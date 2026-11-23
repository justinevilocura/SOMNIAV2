import { View, Text, TouchableOpacity, ScrollView, Modal, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import styles from '../assets/styles/diary.styles';

const DIARY_STORAGE_KEY = 'sleepDiaryEntries';

export default function Diary() {
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'bedtime' | 'wakeTime'>('bedtime');
  const [diaryEntries, setDiaryEntries] = useState<any[]>([]);

  const initialEntryState = {
    date: new Date(),
    bedtime: new Date(),
    wakeTime: new Date(),
    sleepQuality: 'Rested',
    moodBeforeSleep: '😊',
    lifestyleFactors: {
      exercise: false,
      caffeine: false,
      alcohol: false,
      screenTime: '0-1 hour',
      stressLevel: 'Low',
      meals: {
        breakfast: false,
        lunch: false,
        dinner: false,
      },
    },
    diaryNotes: '',
  };

  const [diaryEntry, setDiaryEntry] = useState(initialEntryState);

  // Load persisted entries on mount
  useEffect(() => {
    loadDiaryEntries();
  }, []);

  const loadDiaryEntries = async () => {
    try {
      const stored = await AsyncStorage.getItem(DIARY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setDiaryEntries(parsed);
        }
      }
    } catch (e) {
      console.log('Error loading diary entries:', e);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedTime) {
      if (timePickerMode === 'bedtime') {
        setDiaryEntry({ ...diaryEntry, bedtime: selectedTime });
      } else {
        setDiaryEntry({ ...diaryEntry, wakeTime: selectedTime });
      }
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDiaryEntry({ ...diaryEntry, date: selectedDate });
    }
  };

  const formatTime = (dateInput: any) => {
    if (!dateInput) return '';
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateInput: any) => {
    if (!dateInput) return '';
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString([], {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
  };

  const handleSaveEntry = async () => {
    try {
      const newEntry = {
        ...diaryEntry,
        id: Date.now().toString(),
        date: diaryEntry.date instanceof Date ? diaryEntry.date.toISOString() : diaryEntry.date,
        bedtime: diaryEntry.bedtime instanceof Date ? diaryEntry.bedtime.toISOString() : diaryEntry.bedtime,
        wakeTime: diaryEntry.wakeTime instanceof Date ? diaryEntry.wakeTime.toISOString() : diaryEntry.wakeTime,
        savedAt: new Date().toISOString(),
      };

      const updatedEntries = [newEntry, ...diaryEntries];
      setDiaryEntries(updatedEntries);
      await AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(updatedEntries));

      // Reset form
      setDiaryEntry({
        date: new Date(),
        bedtime: new Date(),
        wakeTime: new Date(),
        sleepQuality: 'Rested',
        moodBeforeSleep: '😊',
        lifestyleFactors: {
          exercise: false,
          caffeine: false,
          alcohol: false,
          screenTime: '0-1 hour',
          stressLevel: 'Low',
          meals: {
            breakfast: false,
            lunch: false,
            dinner: false,
          },
        },
        diaryNotes: '',
      });

      setShowDiaryModal(false);

      Toast.show({
        type: 'success',
        text1: 'Diary Added!',
        text2: 'Your sleep diary entry was saved successfully.',
      });
    } catch (e) {
      console.error('Error saving diary entry:', e);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Could not save your diary entry.',
      });
    }
  };

  const handleDeleteEntry = async (indexToDelete: number) => {
    try {
      const updatedEntries = diaryEntries.filter((_, idx) => idx !== indexToDelete);
      setDiaryEntries(updatedEntries);
      await AsyncStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(updatedEntries));
      Toast.show({
        type: 'info',
        text1: 'Entry Removed',
        text2: 'Sleep diary entry deleted.',
      });
    } catch (e) {
      console.error('Error deleting diary entry:', e);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Sleep Diary</Text>
      <TouchableOpacity 
        style={styles.addDiaryButton}
        onPress={() => setShowDiaryModal(true)}
      >
        <Ionicons name="add-circle-outline" size={24} color="#fff" />
        <Text style={styles.addDiaryButtonText}>Add New Entry</Text>
      </TouchableOpacity>

      {/* Empty State */}
      {diaryEntries.length === 0 && (
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 28 }}>
          <Ionicons name="book-outline" size={44} color="rgba(255, 255, 255, 0.25)" />
          <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 15, fontWeight: '600', marginTop: 10 }}>
            No diary entries yet
          </Text>
          <Text style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
            Tap "Add New Entry" above to log your daily pre-sleep habits and notes.
          </Text>
        </View>
      )}

      {/* Display saved entries */}
      {diaryEntries.map((entry, index) => (
        <View key={entry.id || index} style={styles.diaryEntry}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.diaryEntryDate}>{formatDate(entry.date)}</Text>
            <TouchableOpacity
              onPress={() => handleDeleteEntry(index)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>

          <View style={styles.diaryEntryTimes}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="moon-outline" size={14} color="#a259ff" />
              <Text style={styles.diaryEntryTime}>Bed: {formatTime(entry.bedtime)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="sunny-outline" size={14} color="#ffd166" />
              <Text style={styles.diaryEntryTime}>Wake: {formatTime(entry.wakeTime)}</Text>
            </View>
          </View>

          {/* Lifestyle Badges */}
          {entry.lifestyleFactors && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
              {entry.lifestyleFactors.exercise && (
                <View style={{ backgroundColor: 'rgba(67, 233, 123, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ color: '#43e97b', fontSize: 11, fontWeight: '600' }}>🏃 Exercised</Text>
                </View>
              )}
              {entry.lifestyleFactors.caffeine && (
                <View style={{ backgroundColor: 'rgba(255, 209, 102, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ color: '#ffd166', fontSize: 11, fontWeight: '600' }}>☕ Late Caffeine</Text>
                </View>
              )}
              {entry.lifestyleFactors.alcohol && (
                <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600' }}>🍷 Alcohol</Text>
                </View>
              )}
              {entry.lifestyleFactors.screenTime && (
                <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '600' }}>📱 Screen: {entry.lifestyleFactors.screenTime}</Text>
                </View>
              )}
              {entry.lifestyleFactors.stressLevel && (
                <View style={{ backgroundColor: 'rgba(162, 89, 255, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ color: '#c084fc', fontSize: 11, fontWeight: '600' }}>⚡ Stress: {entry.lifestyleFactors.stressLevel}</Text>
                </View>
              )}
            </View>
          )}

          {entry.diaryNotes ? (
            <Text style={styles.diaryEntryNotes}>{entry.diaryNotes}</Text>
          ) : null}
        </View>
      ))}

      {/* Diary Modal */}
      <Modal
        visible={showDiaryModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Diary Entry</Text>
              <TouchableOpacity onPress={() => setShowDiaryModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.diaryForm}>
              {/* Date */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.timePickerText}>{formatDate(diaryEntry.date)}</Text>
                </TouchableOpacity>
                {/* iOS inline picker */}
                {showDatePicker && Platform.OS === 'ios' && (
                  <DateTimePicker
                    value={diaryEntry.date}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    style={{ backgroundColor: '#23234b' }}
                  />
                )}
              </View>

              {/* Bedtime */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Bedtime</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => {
                    setTimePickerMode('bedtime');
                    setShowTimePicker(true);
                  }}
                >
                  <Text style={styles.timePickerText}>{formatTime(diaryEntry.bedtime)}</Text>
                </TouchableOpacity>
                {/* iOS inline picker */}
                {showTimePicker && Platform.OS === 'ios' && timePickerMode === 'bedtime' && (
                  <DateTimePicker
                    value={diaryEntry.bedtime}
                    mode="time"
                    is24Hour={false}
                    display="spinner"
                    onChange={handleTimeChange}
                    style={{ backgroundColor: '#23234b' }}
                  />
                )}
              </View>

              {/* Wake Time */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Wake Time</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => {
                    setTimePickerMode('wakeTime');
                    setShowTimePicker(true);
                  }}
                >
                  <Text style={styles.timePickerText}>{formatTime(diaryEntry.wakeTime)}</Text>
                </TouchableOpacity>
                {/* iOS inline picker */}
                {showTimePicker && Platform.OS === 'ios' && timePickerMode === 'wakeTime' && (
                  <DateTimePicker
                    value={diaryEntry.wakeTime}
                    mode="time"
                    is24Hour={false}
                    display="spinner"
                    onChange={handleTimeChange}
                    style={{ backgroundColor: '#23234b' }}
                  />
                )}
              </View>

              {/* Lifestyle Factors */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Lifestyle Factors</Text>
                
                {/* Exercise */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setDiaryEntry({
                    ...diaryEntry,
                    lifestyleFactors: {
                      ...diaryEntry.lifestyleFactors,
                      exercise: !diaryEntry.lifestyleFactors.exercise
                    }
                  })}
                >
                  <View style={[
                    styles.checkbox,
                    diaryEntry.lifestyleFactors.exercise && styles.checkboxSelected
                  ]}>
                    {diaryEntry.lifestyleFactors.exercise && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Exercised today</Text>
                </TouchableOpacity>

                {/* Caffeine */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setDiaryEntry({
                    ...diaryEntry,
                    lifestyleFactors: {
                      ...diaryEntry.lifestyleFactors,
                      caffeine: !diaryEntry.lifestyleFactors.caffeine
                    }
                  })}
                >
                  <View style={[
                    styles.checkbox,
                    diaryEntry.lifestyleFactors.caffeine && styles.checkboxSelected
                  ]}>
                    {diaryEntry.lifestyleFactors.caffeine && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Had caffeine after 6 PM</Text>
                </TouchableOpacity>

                {/* Alcohol */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setDiaryEntry({
                    ...diaryEntry,
                    lifestyleFactors: {
                      ...diaryEntry.lifestyleFactors,
                      alcohol: !diaryEntry.lifestyleFactors.alcohol
                    }
                  })}
                >
                  <View style={[
                    styles.checkbox,
                    diaryEntry.lifestyleFactors.alcohol && styles.checkboxSelected
                  ]}>
                    {diaryEntry.lifestyleFactors.alcohol && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Had alcohol today</Text>
                </TouchableOpacity>

                {/* Screen Time */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Screen Time Before Bed</Text>
                  <View style={styles.optionsContainer}>
                    {['0-1 hour', '1-2 hours', '2-3 hours', '3+ hours'].map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.optionButton,
                          diaryEntry.lifestyleFactors.screenTime === option && styles.optionButtonSelected
                        ]}
                        onPress={() => setDiaryEntry({
                          ...diaryEntry,
                          lifestyleFactors: {
                            ...diaryEntry.lifestyleFactors,
                            screenTime: option
                          }
                        })}
                      >
                        <Text style={styles.optionText}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Stress Level */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Stress Level</Text>
                  <View style={styles.optionsContainer}>
                    {['Low', 'Moderate', 'High', 'Very High'].map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={[
                          styles.optionButton,
                          diaryEntry.lifestyleFactors.stressLevel === level && styles.optionButtonSelected
                        ]}
                        onPress={() => setDiaryEntry({
                          ...diaryEntry,
                          lifestyleFactors: {
                            ...diaryEntry.lifestyleFactors,
                            stressLevel: level
                          }
                        })}
                      >
                        <Text style={styles.optionText}>{level}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Meals */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Meals Today</Text>
                  <View style={styles.mealsContainer}>
                    {Object.entries(diaryEntry.lifestyleFactors.meals).map(([meal, eaten]) => (
                      <TouchableOpacity
                        key={meal}
                        style={styles.checkboxContainer}
                        onPress={() => setDiaryEntry({
                          ...diaryEntry,
                          lifestyleFactors: {
                            ...diaryEntry.lifestyleFactors,
                            meals: {
                              ...diaryEntry.lifestyleFactors.meals,
                              [meal]: !eaten
                            }
                          }
                        })}
                      >
                        <View style={[
                          styles.checkbox,
                          eaten && styles.checkboxSelected
                        ]}>
                          {eaten && (
                            <Ionicons name="checkmark" size={20} color="#fff" />
                          )}
                        </View>
                        <Text style={styles.checkboxLabel}>{meal.charAt(0).toUpperCase() + meal.slice(1)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Diary Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  placeholder="How was your day? Any thoughts before sleep?"
                  placeholderTextColor="#666"
                  value={diaryEntry.diaryNotes}
                  onChangeText={(text) => setDiaryEntry({ ...diaryEntry, diaryNotes: text })}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveEntry}
              >
                <Text style={styles.saveButtonText}>Save Entry</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Android pickers rendered outside the modal */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={diaryEntry.date}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={timePickerMode === 'bedtime' ? diaryEntry.bedtime : diaryEntry.wakeTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}