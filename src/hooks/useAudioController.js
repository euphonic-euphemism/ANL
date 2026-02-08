import { useState, useRef, useEffect, useCallback } from 'react';

export const useAudioController = (speechUrl, noiseUrl, initialNoiseOffset = 0) => {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [swapChannels, setSwapChannels] = useState(false);
  const audioContextRef = useRef(null);
  const speechSourceRef = useRef(null);
  const noiseSourceRef = useRef(null);
  const speechGainNodeRef = useRef(null);
  const noiseGainNodeRef = useRef(null);
  const speechBufferRef = useRef(null);
  const noiseBufferRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);

  // Store offset in ref
  const noiseOffsetRef = useRef(initialNoiseOffset);

  // Initialize Audio Context and Nodes
  const initAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }

    try {
      setIsReady(false); // Reset ready state while loading
      console.log(`[Audio] Loading: ${speechUrl} and ${noiseUrl}`);

      const loadBuffer = async (url) => {
        if (!url) return null; // Handle single file cases (calibration)
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioContextRef.current.decodeAudioData(arrayBuffer);
      };

      const [sBuffer, nBuffer] = await Promise.all([
        loadBuffer(speechUrl),
        loadBuffer(noiseUrl)
      ]);

      speechBufferRef.current = sBuffer;
      noiseBufferRef.current = nBuffer;

      console.log(`[Audio] Loaded buffers.`);
      setIsReady(true);
    } catch (error) {
      console.error("Error loading audio:", error);
    }
  }, [speechUrl, noiseUrl]);

  useEffect(() => {
    initAudio();
  }, [initAudio]);

  const play = useCallback(() => {
    if (!audioContextRef.current || !speechBufferRef.current) {
      console.warn("[Audio] Play aborted: No context or buffer");
      return;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (isPlaying) return;

    // Create Sources
    const speechSource = audioContextRef.current.createBufferSource();
    speechSource.buffer = speechBufferRef.current;
    speechSource.loop = true;

    let noiseSource = null;
    if (noiseBufferRef.current) {
      noiseSource = audioContextRef.current.createBufferSource();
      noiseSource.buffer = noiseBufferRef.current;
      noiseSource.loop = true;
    }

    // Gain Nodes
    const speechGain = audioContextRef.current.createGain();
    const noiseGain = audioContextRef.current.createGain();

    // Initialize to silence to prevent "blast" at start
    speechGain.gain.value = 0;
    noiseGain.gain.value = 0;

    speechGainNodeRef.current = speechGain;
    noiseGainNodeRef.current = noiseGain;

    // Routing Logic
    // Standard: Speech -> Left/SpeechGain, Noise -> Right/NoiseGain
    // Swapped: Speech -> Right/NoiseGain, Noise -> Left/SpeechGain (Conceptually swapped output)

    // Actually, simpler logic:
    // We have Speech Source and Noise Source.
    // We have active Speaker L and active Speaker R.
    // If Swap=False: SpeechSource -> L, NoiseSource -> R
    // If Swap=True:  SpeechSource -> R, NoiseSource -> L

    // Implementation with Gain Nodes handling volume:
    // SpeechSource -> SpeechGain -> Merger(0 or 1)

    // Let's stick to the previous mental model which worked:
    // SpeechGain controls the volume of the "Speech Signal"
    // NoiseGain controls the volume of the "Noise Signal"
    // We physically route them to Left (ch0) or Right (ch1) speakers.

    const merger = audioContextRef.current.createChannelMerger(2);

    if (swapChannels) {
      // Swapped: Speech -> Left (0)
      // Noise -> Right (1)
      speechGain.connect(merger, 0, 0);
      if (noiseSource) noiseGain.connect(merger, 0, 1);
    } else {
      // Normal: Speech -> Right (1)
      // Noise -> Left (0)
      speechGain.connect(merger, 0, 1);
      if (noiseSource) noiseGain.connect(merger, 0, 0);
    }

    merger.connect(audioContextRef.current.destination);

    // Apply connections
    speechSource.connect(speechGain);
    if (noiseSource) noiseSource.connect(noiseGain);

    // Sync Start
    const offset = (pauseTimeRef.current || 0) % speechBufferRef.current.duration;
    const now = audioContextRef.current.currentTime;

    speechSource.start(now, offset);
    if (noiseSource) noiseSource.start(now, offset);

    startTimeRef.current = now - offset;

    speechSourceRef.current = speechSource;
    noiseSourceRef.current = noiseSource;
    setIsPlaying(true);
  }, [isPlaying, swapChannels]);

  const stop = useCallback(() => {
    if (speechSourceRef.current) {
      speechSourceRef.current.stop();
      speechSourceRef.current.disconnect();
    }
    if (noiseSourceRef.current) {
      noiseSourceRef.current.stop();
      noiseSourceRef.current.disconnect();
    }

    pauseTimeRef.current = 0;
    setIsPlaying(false);
  }, []);

  const setSpeechVolume = useCallback((db) => {
    if (speechGainNodeRef.current) {
      let gain = db <= -100 ? 0 : Math.pow(10, db / 20);
      if (gain > 1.0) gain = 1.0;
      speechGainNodeRef.current.gain.setTargetAtTime(gain, audioContextRef.current.currentTime, 0.1);
    }
  }, []);

  const setNoiseVolume = useCallback((db) => {
    if (noiseGainNodeRef.current) {
      const offset = noiseOffsetRef.current;
      const targetDb = db <= -100 ? -200 : (db + offset);
      let gain = targetDb <= -100 ? 0 : Math.pow(10, targetDb / 20);
      if (gain > 1.0) gain = 1.0;
      noiseGainNodeRef.current.gain.setTargetAtTime(gain, audioContextRef.current.currentTime, 0.1);
    }
  }, []);

  const toggleSwapChannels = useCallback(() => {
    setSwapChannels(prev => !prev);
    // Note: Live swapping while playing is complex with this new routing. 
    // It's safer to stop and restart or the user won't hear the swap until re-play.
    // For now, we will let React's state update trigger a re-render/logic effect if needed,
    // but typically users stop -> swap -> play.
  }, []);

  // Re-connect on swap if playing (Hot Swap Support)
  useEffect(() => {
    if (isPlaying) {
      stop();
      setTimeout(() => play(), 50); // Brief pause to reset nodes
    }
  }, [swapChannels]);

  return { isReady, isPlaying, play, stop, setSpeechVolume, setNoiseVolume, toggleSwapChannels, swapChannels };
};
