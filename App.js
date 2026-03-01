import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Pressable, TextInput, Switch, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';

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

  // Colors
  const workColor = '#4CAF50'; // Green
  const restColor = '#F44336'; // Red
  const backgroundColor = isWorkMode ? workColor : restColor;

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
    if (newMode) setSetCount(prev => prev + 1);
    setIsWorkMode(newMode);
    setTimeLeft(newMode ? (workIsTimed ? workDuration : 0) : restDuration);
  };

  const handleResetSet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSetCount(1);
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

  const formatTime = (seconds) => {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const paddedMins = mins.toString().padStart(2, '0');
    const paddedSecs = secs.toString().padStart(2, '0');
    return `${isNegative ? '-' : ''}${paddedMins}:${paddedSecs}`;
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
            <Text style={[styles.timerText, { color: timerColor }]} allowFontScaling={false}>
              {formatTime(timeLeft)}
            </Text>
          </TouchableOpacity>
        </View>



        <Text style={styles.modeText}>
          {isWorkMode ? 'WORK' : 'REST'}
        </Text>
      </View>

      <View style={styles.bottomControls}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>WORK SETTINGS</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.settingsRow}>
          <Text style={styles.settingsLabel}>Timed Mode</Text>
          <Switch
            value={workIsTimed}
            onValueChange={setWorkIsTimed}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={workIsTimed ? '#f5dd4b' : '#f4f3f4'}
          />
        </View>

        {workIsTimed && (
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsLabel}>Work Duration</Text>
            <View style={styles.stepperContainer}>
              <Pressable onPress={() => handleDurationChange(true, -5)} style={styles.stepperBtn}>
                <Text style={styles.stepperBtnText}>-</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{workDuration}s</Text>
              <Pressable onPress={() => handleDurationChange(true, 5)} style={styles.stepperBtn}>
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>REST SETTINGS</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.settingsContainer}>
          <Text style={styles.settingsLabel}>Rest Duration</Text>
          <View style={styles.stepperContainer}>
            <Pressable onPress={() => handleDurationChange(false, -5)} style={styles.stepperBtn}>
              <Text style={styles.stepperBtnText}>-</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{restDuration}s</Text>
            <Pressable onPress={() => handleDurationChange(false, 5)} style={styles.stepperBtn}>
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

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
    paddingVertical: 40,
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
});
