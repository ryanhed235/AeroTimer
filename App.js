import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Pressable, TextInput, Switch, TouchableOpacity, ScrollView, Keyboard, Platform, Modal } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useKeepAwake } from 'expo-keep-awake';

const tickAsset = require('./assets/sounds/tick.wav');
const doneAsset = require('./assets/sounds/done.wav');
const finalDoneAsset = require('./assets/sounds/final_done.wav');

const TurboStepper = ({ value, label, decrementFn, incrementFn, formatValue = v => v, triggerHaptic = () => {}, turboDelay = 100 }) => {
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const prevValueRef = useRef(value);
  useEffect(() => {
    if (prevValueRef.current !== value) {
      triggerHaptic();
      prevValueRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    return () => stopTurbo();
  }, []);

  const startTurbo = (fn) => {
    stopTurbo(); // Kill any existing ghost intervals from rapid taps
    fn();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        fn();
      }, 150);
    }, 400); // Wait 400ms before turbo engages
  };

  const stopTurbo = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
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
  const [showSummary, setShowSummary] = useState(false);
  const [lastReps, setLastReps] = useState('0');
  const [lastWorkTime, setLastWorkTime] = useState(0);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [hapticLevel, setHapticLevel] = useState(2);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Phase 10.1 Audio Configuration States
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [alertVolume, setAlertVolume] = useState(1.0);
  const [soundStartWork, setSoundStartWork] = useState('Done');
  const [soundRestCountdown, setSoundRestCountdown] = useState('Tick');
  const [soundOvertime, setSoundOvertime] = useState('Silent');
  const [soundEndWork, setSoundEndWork] = useState('Done');
  const [isAudioExpanded, setIsAudioExpanded] = useState(false);

  const handleVolumeChange = (delta) => {
    setAlertVolume(prev => {
      const newVal = prev + delta;
      if (newVal < 0) return 0;
      if (newVal > 1.0) return 1.0;
      return Number(newVal.toFixed(1));
    });
  };

  const triggerHaptic = (isNotification = false) => {
    if (hapticLevel === 0) return;
    
    if (hapticLevel === 1) {
      if (isNotification) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.selectionAsync();
      }
    } else if (hapticLevel === 2) {
      if (isNotification) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    }
  };

  const commitSetData = () => {
    if (setHistory.some(entry => entry.setNum && entry.setNum === setCount.toString())) return;

    const val = repsCompleted.trim() !== '' ? repsCompleted.trim() : lastReps;
    const formattedWork = typeof formatTime === 'function' ? formatTime(lastWorkTime) : `${lastWorkTime}s`;
    
    let entryObj = {
      setNum: setCount.toString(),
      workDesc: formattedWork,
      repsDesc: val,
      restDesc: null
    };

    if (setCount < targetSets) {
      const actualRest = Math.max(0, restDuration - timeLeft);
      const formattedRest = typeof formatTime === 'function' ? formatTime(actualRest) : `${actualRest}s`;
      entryObj.restDesc = formattedRest;
    }

    setSetHistory(prev => [entryObj, ...prev]);
    setLastReps(val);
    setRepsCompleted('');
  };

  const tickSoundRef = useRef(null);
  const doneSoundRef = useRef(null);
  const finalDoneSoundRef = useRef(null);

  useEffect(() => {
    // Attempt to configure audio to play even if physical silent switch is flipped
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const loadSounds = async () => {
      try {
        const { sound: t } = await Audio.Sound.createAsync(tickAsset);
        tickSoundRef.current = t;
        
        const { sound: s } = await Audio.Sound.createAsync(doneAsset);
        doneSoundRef.current = s;
        
        const { sound: b } = await Audio.Sound.createAsync(finalDoneAsset);
        finalDoneSoundRef.current = b;
      } catch (e) {
        console.log("Preload error:", e.message);
      }
    };
    loadSounds();

    return () => {
      // Memory management: unload sounds when component unmounts
      if (tickSoundRef.current) {
        tickSoundRef.current.unloadAsync();
        tickSoundRef.current = null;
      }
      if (doneSoundRef.current) {
        doneSoundRef.current.unloadAsync();
        doneSoundRef.current = null;
      }
      if (finalDoneSoundRef.current) {
        finalDoneSoundRef.current.unloadAsync();
        finalDoneSoundRef.current = null;
      }
    };
  }, []);

  const playSound = async (type, forceVolume = alertVolume) => {
    if (!soundAlerts || type === 'Silent') return;
    
    try {
      let ref = null;
      if (type === 'Tick') ref = tickSoundRef.current;
      else if (type === 'Done') ref = doneSoundRef.current;
      else if (type === 'FinalDone') ref = finalDoneSoundRef.current;

      if (ref) {
        await ref.setVolumeAsync(forceVolume);
        await ref.replayAsync();
      }
    } catch (error) {
      console.log('Error playing sound: ' + error.message);
    }
  };

  const [repsCompleted, setRepsCompleted] = useState('');
  const [setHistory, setSetHistory] = useState([]);

  const [isWorkExpanded, setIsWorkExpanded] = useState(false);
  const [isRestExpanded, setIsRestExpanded] = useState(false);

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
      if (timeLeft <= countdownSeconds && timeLeft > 0) {
        if (!isWorkMode) {
          triggerHaptic();
          playSound(soundRestCountdown);
        } else {
          // You asked for the timer countdown beep logic to trigger.
          // Applying the same to Work Phase tick alerts for consistency if needed.
          triggerHaptic();
          playSound(soundRestCountdown); // Assuming map tick alert equally
        }
      }
      
      if (timeLeft === 0) {
        if (isWorkMode) {
          // Work timer hit 0: Auto switch to Rest
          setLastWorkTime(workDuration);
          triggerHaptic(true);

          if (setCount >= targetSets) {
            playSound(soundEndWork === 'Silent' ? 'Silent' : 'FinalDone');
            commitSetData();
            setIsWorkMode(false);
            setTimeLeft(0);
            setShowSummary(true);
          } else {
            playSound(soundEndWork);
            setIsWorkMode(false);
            setTimeLeft(restDuration);
          }
        } else {
          // Rest timer hit 0: Respect restEndAction
          if (restEndAction === 'Auto-Start') {
            triggerHaptic(true);
            playSound(soundStartWork);
            setIsWorkMode(true);
            commitSetData();
            setSetCount(prev => prev + 1);
            setTimeLeft(workIsTimed ? workDuration : 0);
          } else if (restEndAction === 'Hard Stop') {
            triggerHaptic(true);
            playSound(soundStartWork);
          } else if (restEndAction === 'Overtime') {
            triggerHaptic(true);
            playSound(soundOvertime);
          }
        }
      }
    }
  }, [timeLeft, isWorkMode, restEndAction, workIsTimed, workDuration, restDuration, hapticLevel, soundAlerts, countdownSeconds, alertVolume, soundStartWork, soundRestCountdown, soundOvertime]);

  const handlePress = async () => {
    if (showSummary) return;
    triggerHaptic(true);

    if (isWorkMode) {
      const actualWork = workIsTimed ? Math.max(0, workDuration - timeLeft) : timeLeft;
      setLastWorkTime(actualWork);

      if (setCount >= targetSets) {
        playSound(soundEndWork === 'Silent' ? 'Silent' : 'FinalDone');
        commitSetData();
        setIsWorkMode(false);
        setTimeLeft(0);
        setShowSummary(true);
        return;
      } else {
        playSound(soundEndWork);
      }
    } else {
      playSound(soundStartWork);
    }

    const newMode = !isWorkMode;

    // Changing from Rest to Work -> new set starting
    if (newMode) {
      commitSetData();
      setSetCount(prev => prev + 1);
    }

    setIsWorkMode(newMode);
    setTimeLeft(newMode ? (workIsTimed ? workDuration : 0) : restDuration);
  };

  const handleResetSet = () => {
    triggerHaptic();
    setSetCount(1);
    setSetHistory([]);
    setLastReps('0');
    setLastWorkTime(0);
    setShowSummary(false);
    setIsWorkMode(true);
    setTimeLeft(workIsTimed ? workDuration : 0);
    setIsWorkExpanded(true);
    setIsRestExpanded(true);
  };

  const handlePresetPress = (duration) => {
    triggerHaptic();
    if (isWorkMode && workIsTimed) {
      setWorkDuration(duration);
    } else {
      setRestDuration(duration);
    }
  };

  const handleDurationChange = (isWork, change) => {
    if (isWork) {
      setWorkDuration(r => Math.max(5, r + change));
    } else {
      setRestDuration(r => Math.max(5, r + change));
    }
  };

  const handleTargetSetsChange = (change) => {
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

      {/* Settings Trigger */}
      <TouchableOpacity 
        style={styles.settingsTrigger} 
        onPress={() => setSettingsVisible(true)}
      >
        <Text style={styles.settingsTriggerText}>⚙️</Text>
      </TouchableOpacity>

      {/* Settings Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={settingsVisible}
        onRequestClose={() => {
          setSettingsVisible(false);
          setShowConfirmReset(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%', padding: 0 }]}>
            <View style={[styles.modalHeader, { padding: 25, paddingBottom: 15, marginBottom: 0 }]}>
              <Text style={styles.modalTitle}>CONTROL PANEL</Text>
              <TouchableOpacity onPress={() => {
                setSettingsVisible(false);
                setShowConfirmReset(false);
              }}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingHorizontal: 25, paddingBottom: 25 }} showsVerticalScrollIndicator={false}>
              
              <View style={[styles.settingsRow, { width: '100%', marginBottom: isAudioExpanded ? 15 : 0 }]}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => setIsAudioExpanded(!isAudioExpanded)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.settingsLabelDark}>AUDIO CONFIG</Text>
                  <Text style={[styles.sectionHeaderIcon, { color: 'rgba(255,255,255,0.6)', marginLeft: 8 }]}>{isAudioExpanded ? '▼' : '▶'}</Text>
                </TouchableOpacity>
                <Switch
                  value={soundAlerts}
                  onValueChange={setSoundAlerts}
                  trackColor={{ false: '#767577', true: workColor }}
                  thumbColor={soundAlerts ? '#fff' : '#f4f3f4'}
                />
              </View>

              {isAudioExpanded && (
                <View style={{ width: '100%', marginBottom: 15 }}>
                  <View style={{ width: '100%', marginBottom: 10 }}>
                    <TurboStepper
                      label="Countdown Lead-in"
                      value={countdownSeconds}
                      formatValue={v => `${v}s`}
                      decrementFn={() => setCountdownSeconds(prev => prev > 0 ? prev - 1 : 0)}
                      incrementFn={() => setCountdownSeconds(prev => prev < 10 ? prev + 1 : 10)}
                      triggerHaptic={triggerHaptic}
                    />
                  </View>

                  <View style={{ width: '100%', marginBottom: 15 }}>
                    <TurboStepper
                      label="Alert Volume"
                      value={Math.round(alertVolume * 10)}
                      formatValue={v => `${v * 10}%`}
                      decrementFn={() => handleVolumeChange(-0.1)}
                      incrementFn={() => handleVolumeChange(0.1)}
                      triggerHaptic={triggerHaptic}
                    />
                  </View>

                  {[
                    { label: 'START WORK', state: soundStartWork, set: setSoundStartWork },
                    { label: 'REST COUNTDOWN', state: soundRestCountdown, set: setSoundRestCountdown },
                    { label: 'OVERTIME', state: soundOvertime, set: setSoundOvertime },
                    { label: 'END SET', state: soundEndWork, set: setSoundEndWork },
                  ].map((mapItem) => (
                    <View key={mapItem.label} style={{ width: '100%', marginBottom: 15 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={[styles.settingsLabelDark, { fontSize: 13 }]}>{mapItem.label}</Text>
                        <TouchableOpacity onPress={() => playSound(mapItem.state)} style={styles.testBtn}>
                          <Text style={styles.testBtnText}>▶️</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.segmentContainer, { marginTop: 0 }]}>
                        {['Silent', 'Tick', 'Done', 'FinalDone'].map(opt => (
                          <Pressable 
                            key={opt} 
                            onPress={() => mapItem.set(opt)} 
                            style={[styles.segmentBtn, mapItem.state === opt && { backgroundColor: workColor }]}
                          >
                            <Text style={[styles.segmentBtnText, mapItem.state === opt && styles.segmentBtnTextActive]}>{opt}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', width: '100%', marginVertical: 15 }} />

              <View style={[styles.settingsRow, { width: '100%', flexDirection: 'column', alignItems: 'flex-start' }]}>
                <Text style={[styles.settingsLabelDark, { marginBottom: 10 }]}>HAPTIC INTENSITY</Text>
                <View style={[styles.segmentContainer, { marginTop: 0 }]}>
                  {['OFF', 'LOW', 'HIGH'].map((levelStr, index) => (
                    <Pressable
                      key={levelStr}
                      style={[
                        styles.segmentBtn,
                        hapticLevel === index && { backgroundColor: workColor }
                      ]}
                      onPress={() => {
                        setHapticLevel(index);
                        if (index === 0) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        } else if (index === 1) {
                          Haptics.selectionAsync();
                        } else if (index === 2) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        }
                      }}
                    >
                      <Text style={[
                        styles.segmentBtnText,
                        hapticLevel === index && styles.segmentBtnTextActive
                      ]}>
                        {levelStr}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {showConfirmReset ? (
                <View style={styles.confirmResetContainer}>
                  <Text style={styles.confirmResetText}>Are you sure? This will delete all sets.</Text>
                  <View style={styles.confirmResetRow}>
                    <TouchableOpacity 
                      style={[styles.resetWorkoutBtn, styles.cancelResetBtn]}
                      onPress={() => setShowConfirmReset(false)}
                    >
                      <Text style={styles.cancelResetBtnText}>CANCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.resetWorkoutBtn, styles.confirmResetBtn]}
                      onPress={() => {
                        handleResetSet();
                        setIsWorkMode(true);
                        setTimeLeft(workIsTimed ? workDuration : 0);
                        setSettingsVisible(false);
                        setShowConfirmReset(false);
                      }}
                    >
                      <Text style={styles.resetWorkoutBtnText}>YES, RESET</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.resetWorkoutBtn}
                  onPress={() => setShowConfirmReset(true)}
                >
                  <Text style={styles.resetWorkoutBtnText}>RESET WORKOUT</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Background press area */}
      <Pressable style={StyleSheet.absoluteFillObject} onPress={handlePress} />

      {showSummary ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 20, backgroundColor: workColor }}>
          <Text style={[styles.timerText, { fontSize: 40, color: '#000', marginBottom: 10, textAlign: 'center' }]}>WORKOUT COMPLETE</Text>
          <Text style={{ color: 'white', fontSize: 20, marginBottom: 30, fontFamily: 'monospace' }}>{targetSets} Sets Logged</Text>
          
          <ScrollView style={{ width: '100%', maxHeight: 250, marginBottom: 30, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 5 }}>
              <Text style={[styles.historyTitle, { flex: 0.8, textAlign: 'center', marginBottom: 0, fontSize: 14 }]}>SET</Text>
              <Text style={[styles.historyTitle, { flex: 1, textAlign: 'center', marginBottom: 0, fontSize: 14 }]}>WORK</Text>
              <Text style={[styles.historyTitle, { flex: 1, textAlign: 'center', marginBottom: 0, fontSize: 14 }]}>REPS</Text>
              <Text style={[styles.historyTitle, { flex: 1, textAlign: 'right', marginBottom: 0, fontSize: 14 }]}>REST</Text>
            </View>
            {setHistory.map((item, index) => (
              <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 8, paddingHorizontal: 5 }}>
                <Text style={[styles.historyText, { flex: 0.8, textAlign: 'center', fontSize: 16, marginBottom: 0, fontWeight: 'bold' }]}>{item.setNum}</Text>
                <Text style={[styles.historyText, { flex: 1, textAlign: 'center', fontSize: 16, marginBottom: 0 }]}>{item.workDesc}</Text>
                <Text style={[styles.historyText, { flex: 1, textAlign: 'center', fontSize: 16, marginBottom: 0 }]}>{item.repsDesc}</Text>
                <Text style={[styles.historyText, { flex: 1, textAlign: 'right', fontSize: 16, marginBottom: 0, color: 'rgba(255,255,255,0.6)' }]}>{item.restDesc ? item.restDesc : '---'}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity onPress={handleResetSet} style={[styles.resetWorkoutBtn, { width: '100%', marginBottom: 15, padding: 20 }]}>
            <Text style={styles.resetWorkoutBtnText}>FINISH WORKOUT</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => {
              triggerHaptic();
              setShowSummary(false);
              setTargetSets(prev => prev + 1);
              setIsWorkMode(false);
              setTimeLeft(restDuration);
            }} 
            style={[styles.resetWorkoutBtn, { width: '100%', backgroundColor: workColor, padding: 20 }]}
          >
            <Text style={[styles.resetWorkoutBtnText, { color: '#000' }]}>ADD SET TO CONTINUE</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
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

      <View style={styles.hudDivider} />

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.repsContainer}>
          <Text style={styles.repsLabel}>Reps completed:</Text>
          <TextInput
            style={styles.repsInput}
            value={repsCompleted}
            onChangeText={setRepsCompleted}
            placeholder={lastReps}
            placeholderTextColor="rgba(255,255,255,0.5)"
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        <View style={styles.bottomControls}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setIsWorkExpanded(!isWorkExpanded)} style={styles.sectionHeader} hitSlop={{top: 2, bottom: 2}}>
            <Text style={styles.sectionHeaderText}>SESSION SETTINGS</Text>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionHeaderIcon}>{isWorkExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {isWorkExpanded && (
            <View>
              <TurboStepper
                label="Target Sets"
                value={targetSets}
                decrementFn={() => handleTargetSetsChange(-1)}
                incrementFn={() => handleTargetSetsChange(1)}
                triggerHaptic={triggerHaptic}
              />
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
                <>
                  <View style={styles.settingsDivider} />
                  <TurboStepper
                    label="Work Duration"
                    value={workDuration}
                    formatValue={v => `${v}s`}
                    decrementFn={() => handleDurationChange(true, -5)}
                    incrementFn={() => handleDurationChange(true, 5)}
                    triggerHaptic={triggerHaptic}
                  />
                </>
              )}
            </View>
          )}

          <TouchableOpacity activeOpacity={0.7} onPress={() => setIsRestExpanded(!isRestExpanded)} style={styles.sectionHeader} hitSlop={{top: 2, bottom: 2}}>
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
                triggerHaptic={triggerHaptic}
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



          {setHistory.length > 0 && (
            <View style={styles.historyContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 10 }}>
                <Text style={[styles.historyTitle, { flex: 0.8, textAlign: 'center', marginBottom: 0 }]}>SET</Text>
                <Text style={[styles.historyTitle, { flex: 1, textAlign: 'center', marginBottom: 0 }]}>WORK</Text>
                <Text style={[styles.historyTitle, { flex: 1, textAlign: 'center', marginBottom: 0 }]}>REPS</Text>
                <Text style={[styles.historyTitle, { flex: 1, textAlign: 'right', marginBottom: 0 }]}>REST</Text>
              </View>
              {setHistory.map((entry, index) => (
                <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, paddingHorizontal: 10 }}>
                  <Text style={[styles.historyText, { flex: 0.8, textAlign: 'center', marginBottom: 0, fontWeight: 'bold' }]}>{entry.setNum}</Text>
                  <Text style={[styles.historyText, { flex: 1, textAlign: 'center', marginBottom: 0 }]}>{entry.workDesc}</Text>
                  <Text style={[styles.historyText, { flex: 1, textAlign: 'center', marginBottom: 0 }]}>{entry.repsDesc}</Text>
                  <Text style={[styles.historyText, { flex: 1, textAlign: 'right', marginBottom: 0, color: 'rgba(255,255,255,0.6)' }]}>{entry.restDesc ? entry.restDesc : '---'}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      </>
      )}

      {keyboardHeight > 0 && (
        <TouchableOpacity
          style={[styles.doneButton, { bottom: keyboardHeight + 15 }]}
          onPress={() => {
            triggerHaptic();
            Keyboard.dismiss();
          }}
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
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 40,
    zIndex: 1,
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    marginTop: 0,
    paddingVertical: 10,
  },
  hudDivider: {
    height: 2,
    width: '90%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignSelf: 'center',
    marginVertical: 0,
  },
  sectionHeaderText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginRight: 10,
    flexShrink: 0,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    maxWidth: '25%',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    marginTop: 4,
  },
  scrollContent: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  repsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 0,
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
  settingsTrigger: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 22,
  },
  settingsTriggerText: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#1E1E1E',
    padding: 25, // Updated default padding 20 -> 25 to give volume modal components some breathing space
    borderRadius: 20,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  testBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testBtnText: {
    fontSize: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 2,
  },
  modalCloseText: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 'bold',
  },
  settingsLabelDark: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resetWorkoutBtn: {
    marginTop: 20,
    backgroundColor: '#F44336',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
  },
  resetWorkoutBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  confirmResetContainer: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  confirmResetText: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  confirmResetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelResetBtn: {
    backgroundColor: '#555',
    flex: 1,
    marginRight: 10,
    marginTop: 0,
  },
  confirmResetBtn: {
    flex: 1,
    marginLeft: 10,
    marginTop: 0,
  },
  cancelResetBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
});
