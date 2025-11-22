import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

const HOLD_DURATION = 5000;
const TICK_INTERVAL = 100;

const SOSButton = ({ onTrigger, disabled = false, style }) => {
  const [holdTime, setHoldTime] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const intervalRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const triggerAlert = useCallback(async () => {
    if (!onTrigger) return;
    setIsProcessing(true);
    try {
      await onTrigger();
    } catch (error) {
      console.error('SOS trigger failed:', error);
    } finally {
      setHoldTime(0);
      setIsProcessing(false);
    }
  }, [onTrigger]);

  const startHold = () => {
    if (disabled || isProcessing || isHolding) return;
    setHoldTime(0);
    setIsHolding(true);

    intervalRef.current = setInterval(() => {
      setHoldTime((prev) => {
        const next = prev + TICK_INTERVAL;
        if (next >= HOLD_DURATION) {
          clearTimer();
          setIsHolding(false);
          triggerAlert();
          return HOLD_DURATION;
        }
        return next;
      });
    }, TICK_INTERVAL);
  };

  const cancelHold = () => {
    clearTimer();
    setIsHolding(false);
    setHoldTime(0);
  };

  const progress = Math.min(1, holdTime / HOLD_DURATION);
  const remainingSeconds = Math.max(0, (HOLD_DURATION - holdTime) / 1000).toFixed(1);
  const caption = isProcessing
    ? 'Đang gửi SOS...'
    : isHolding
      ? `Giữ thêm ${remainingSeconds}s`
      : 'Nhấn giữ 5 giây để gửi SOS';

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.pulse, isProcessing && styles.pulseActive]} />
      <Pressable
        onPressIn={startHold}
        onPressOut={cancelHold}
        disabled={disabled || isProcessing}
        style={({ pressed }) => [
          styles.button,
          (disabled || isProcessing) && styles.buttonDisabled,
          pressed && !disabled && !isProcessing && styles.buttonPressed,
        ]}
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>SOS</Text>
        )}
      </Pressable>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(244,67,54,0.15)',
  },
  pulseActive: {
    backgroundColor: 'rgba(76,175,80,0.15)',
  },
  button: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    backgroundColor: '#f5a5a5',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: 1,
  },
  progressTrack: {
    width: 110,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#EF4444',
  },
  caption: {
    marginTop: 6,
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default SOSButton;
