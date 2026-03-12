import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Pressable, TextInput, Switch, TouchableOpacity, ScrollView, Keyboard, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';

const TurboStepper = ({ value, label, decrementFn, incrementFn, formatValue = v => v }) => {
  const intervalRef = useRef(null);

  const startTurbo = (fn) => {
    fn();
    intervalRef.current = setInterval(() => {
      fn();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 100);
  };

  const stopTurbo = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return (
    <View style={styles.settingsContainer}>
      <Text style={styles.settingsLabel}>{label}</Text>
      <View style={styles.stepperContainer}>
        <Pressable
          delayLongPress={100}
          delayPressIn={0}
          onPressIn={() => startTurbo(decrementFn)}
          onPressOut={stopTurbo}
          style={styles.stepperBtn}>
          <Text style={styles.stepperBtnText}>-</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{formatValue(value)}</Text>
        <Pressable
          delayLongPress={100}
          delayPressIn={0}
          onPressIn={() => startTurbo(incrementFn)}
          onPressOut={stopTurbo}
          style={styles.stepperBtn}>
          <Text style={styles.stepperBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default function App() {
  useKeepAwake();

  const [isWorkMode, setIsWorkMode] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [exerciseName, setExerciseName] = useState('Exercise');
  const [restEndAction, setRestEndAction] = useState('Overtime');
  const [restDuration, setRestDuration] = useState(60);
  const [workIsTimed, setWorkIsTimed] = useState(false);
  const [workDuration, setWorkDuration] = useState(40);
  const [setCount, setSetCount] = useState(1);
  const [targetSets, setTargetSets] = useState(3);

  const [repsCompleted, setRepsCompleted] = useState('');
  const [setHistory, setSetHistory] = useState([]);

  const [isWorkExpanded, setIsWorkExpanded] = useState(false);
  const [isRestExpanded, setIsRestExpanded] = useState(false);
  const [isSetExpanded, setIsSetExpanded] = useState(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Colors
  const workColor = '#4CAF50'; // Green
  const restColor = '#F44336'; // Red
  const backgroundColor = isWorkMode ? workColor : restColor;

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (isWorkMode && !workIsTimed) {
          return prev + 1;
        } else {
          // Counting down (Rest or Timed Work)
          if (restEndAction === 'Overtime') {
            return prev - 1;
          } else {
            return prev > 0 ? prev - 1 : 0;
          }
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isWorkMode, restEndAction, workIsTimed]);

  useEffect(() => {
    const isCountingDown = !isWorkMode || (isWorkMode && workIsTimed);
    if (isCountingDown) {
      if (timeLeft === 3 || timeLeft === 2 || timeLeft === 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (timeLeft === 0) {
        if (isWorkMode) {
          // Work timer hit 0: Auto switch to Rest
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsWorkMode(false);
          setTimeLeft(restDuration);
        } else {
          // Rest timer hit 0: Respect restEndAction
          if (restEndAction === 'Auto-Start') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsWorkMode(true);
            setSetCount(prev => prev + 1);
            setTimeLeft(workIsTimed ? workDuration : 0);
          } else if (restEndAction === 'Hard Stop') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      }
    }
  }, [timeLeft, isWorkMode, restEndAction, workIsTimed, workDuration, restDuration]);

  const handlePress = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newMode = !isWorkMode;

    // Changing from Rest to Work -> new set starting
    if (newMode) {
      if (repsCompleted.trim() !== '') {
        setSetHistory(prev => [...prev, `Set ${setCount}: ${repsCompleted} reps`]);
      } else {
        setSetHistory(prev => [...prev, `Set ${setCount}: Done`]);
      }
      setRepsCompleted('');
      setSetCount(prev => prev + 1);
    }

    setIsWorkMode(newMode);
    setTimeLeft(newMode ? (workIsTimed ? workDuration : 0) : restDuration);
  };

  const handleResetSet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSetCount(1);
    setSetHistory([]);
  };

  const handlePresetPress = (duration) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isWorkMode && workIsTimed) {
      setWorkDuration(duration);
    } else {
      setRestDuration(duration);
    }
  };

  const handleDurationChange = (isWork, change) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isWork) {
      setWorkDuration(r => Math.max(5, r + change));
    } else {
      setRestDuration(r => Math.max(5, r + change));
    }
  };

  const handleTargetSetsChange = (change) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTargetSets(prev => Math.max(1, prev + change));
  };

  const formatTime = (seconds) => {
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const paddedMins = mins.toString().padStart(2, '0');
    const paddedSecs = secs.toString().padStart(2, '0');
    return `${paddedMins}:${paddedSecs}`;
  };

  const isCuttingIntoSet = !isWorkMode && timeLeft < 0;
  const timerColor = isCuttingIntoSet ? '#FFEB3B' : '#FFFFFF';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style="light" />

      {/* Background press area */}
      <Pressable style={StyleSheet.absoluteFillObject} onPress={handlePress} />

      <View style={styles.content} pointerEvents="box-none">
        <Pressable onLongPress={handleResetSet} delayLongPress={800} style={styles.setHeaderContainer}>
          <Text style={styles.setHeaderText}>SET {setCount}</Text>
        </Pressable>

        <TextInput
          style={styles.exerciseInput}
          value={exerciseName}
          onChangeText={setExerciseName}
          placeholder="Exercise"
          placeholderTextColor="rgba(255,255,255,0.5)"
          maxLength={30}
        />

        <View style={styles.timerContainer}>
          <TouchableOpacity activeOpacity={0.6} onPress={handlePress}>
            {timeLeft < 0 && (
              <Text style={styles.negativeSign}>-</Text>
            )}
            <Text style={[styles.timerText, { color: timerColor }]} allowFontScaling={false}>
              {formatTime(timeLeft)}
            </Text>
          </TouchableOpacity>
        </View>



        <Text style={styles.modeText}>
          {isWorkMode ? 'WORK' : 'REST'}
        </Text>
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.repsContainer}>
          <Text style={styles.repsLabel}>Reps completed:</Text>
          <TextInput
            style={styles.repsInput}
            value={repsCompleted}
            onChangeText={setRepsCompleted}
            placeholder="0"
            placeholderTextColor="rgba(255,255,255,0.5)"
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        <View style={styles.bottomControls}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setIsWorkExpanded(!isWorkExpanded)} style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>WORK SETTINGS</Text>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionHeaderIcon}>{isWorkExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {isWorkExpanded && (
            <TurboStepper
              label="Work Duration"
              value={workDuration}
              formatValue={v => `${v}s`}
              decrementFn={() => handleDurationChange(true, -5)}
              incrementFn={() => handleDurationChange(true, 5)}
            />
          )}

          <TouchableOpacity activeOpacity={0.7} onPress={() => setIsRestExpanded(!isRestExpanded)} style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>REST SETTINGS</Text>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionHeaderIcon}>{isRestExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {isRestExpanded && (
            <View>
              <TurboStepper
                label="Rest Duration"
                value={restDuration}
                formatValue={v => `${v}s`}
                decrementFn={() => handleDurationChange(false, -5)}
                incrementFn={() => handleDurationChange(false, 5)}
              />
              <View style={styles.endActionContainer}>
                <Text style={styles.settingsLabel}>Rest End Action</Text>
                <View style={styles.segmentContainer}>
                  {['Auto-Start', 'Hard Stop', 'Overtime'].map(action => (
                    <Pressable
                      key={action}
                      style={[styles.segmentBtn, restEndAction === action && styles.segmentBtnActive]}
                      onPress={() => setRestEndAction(action)}
                    >
                      <Text style={[styles.segmentBtnText, restEndAction === action && styles.segmentBtnTextActive]}>
                        {action}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity activeOpacity={0.7} onPress={() => setIsSetExpanded(!isSetExpanded)} style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>SET SETTINGS</Text>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionHeaderIcon}>{isSetExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {isSetExpanded && (
            <View>
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>Timed Mode</Text>
                <Switch
                  value={workIsTimed}
                  onValueChange={setWorkIsTimed}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={workIsTimed ? '#f5dd4b' : '#f4f3f4'}
                />
              </View>
              <TurboStepper
                label="Target Sets"
                value={targetSets}
                decrementFn={() => handleTargetSetsChange(-1)}
                incrementFn={() => handleTargetSetsChange(1)}
              />
            </View>
          )}

          {setHistory.length > 0 && (
            <View style={styles.historyContainer}>
              <Text style={styles.historyTitle}>Set History</Text>
              {setHistory.map((entry, index) => (
                <Text key={index} style={styles.historyText}>{entry}</Text>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {keyboardHeight > 0 && (
        <TouchableOpacity
          style={[styles.doneButton, { bottom: keyboardHeight + 15 }]}
          onPress={() => Keyboard.dismiss()}
          activeOpacity={0.8}
        >
          <Text style={styles.doneButtonText}>DONE</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    zIndex: 1, // Ensure it sits above the absolute Pressable
    width: '100%',
    paddingTop: 40,
    paddingBottom: 0,
  },
  setHeaderContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
  },
  setHeaderText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  exerciseInput: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 10,
    minWidth: 200,
  },
  timerContainer: {
    marginVertical: 10,
  },
  timerText: {
    fontSize: 120, // 1.5x scaling
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },

  presetBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginTop: 10,
  },
  bottomControls: {
    padding: 20,
    paddingBottom: 40,
    zIndex: 1,
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  sectionHeaderText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginRight: 10,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  settingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  settingsLabel: {
    color: '#FFF',
    marginRight: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  repsLabel: {
    color: '#FFF',
    marginRight: 10,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: -20,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 4,
  },
  stepperBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stepperBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  stepperValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 10,
    minWidth: 40,
    textAlign: 'center',
  },
  endActionContainer: {
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 4,
    marginTop: 12,
    width: '100%',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#FFF',
  },
  segmentBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  segmentBtnTextActive: {
    color: '#000',
  },
  negativeSign: {
    color: '#FFEB3B',
    fontSize: 60,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: -20,
    lineHeight: 60,
  },
  scrollContainer: {
    width: '100%',
    flex: 1,
    marginTop: 5,
  },
  scrollContent: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  repsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
    marginRight: 120,
  },
  repsInput: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    borderRadius: 8,
    paddingVertical: 10,
    width: 90,
    textAlign: 'center',
    marginLeft: 1,
  },
  sectionHeaderIcon: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginLeft: 10,
  },
  historyContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    width: '100%',
  },
  historyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  historyText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 5,
    textAlign: 'center',
  },
  doneButton: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#FFF',
    width: 100,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    zIndex: 9999,
  },
  doneButtonText: {
    color: '#000',
    fontSize: 22,
    fontWeight: '900',
  },
});
