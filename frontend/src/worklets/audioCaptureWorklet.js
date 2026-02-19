class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const cfg = options?.processorOptions || {};
    this.rmsThreshold = typeof cfg.rmsThreshold === 'number' ? cfg.rmsThreshold : 0.012;
    this.speechStartMs = typeof cfg.speechStartMs === 'number' ? cfg.speechStartMs : 100;
    this.speechEndMs = typeof cfg.speechEndMs === 'number' ? cfg.speechEndMs : 320;
    this.preRollMs = typeof cfg.preRollMs === 'number' ? cfg.preRollMs : 120;
    this.silenceHeartbeatMs = typeof cfg.silenceHeartbeatMs === 'number' ? cfg.silenceHeartbeatMs : 2500;

    this.isSpeaking = false;
    this.speechMs = 0;
    this.silenceMs = 0;
    this.preRollFrames = [];
    this.preRollDurationMs = 0;
    this.lastHeartbeatAtMs = 0;
  }

  computeRms(frame) {
    if (!frame || frame.length === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < frame.length; i += 1) {
      const sample = frame[i];
      sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / frame.length);
  }

  frameDurationMs(frameLength) {
    return (frameLength / sampleRate) * 1000;
  }

  addPreRollFrame(frame, frameMs) {
    this.preRollFrames.push(frame);
    this.preRollDurationMs += frameMs;
    while (this.preRollDurationMs > this.preRollMs && this.preRollFrames.length > 1) {
      const removed = this.preRollFrames.shift();
      this.preRollDurationMs -= this.frameDurationMs(removed.length);
    }
  }

  emitAudioFrame(frame) {
    this.port.postMessage({
      type: 'audio-frame',
      frame,
    });
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const channelData = input && input.length > 0 ? input[0] : null;

    if (channelData && channelData.length > 0) {
      const frame = new Float32Array(channelData);
      const frameMs = this.frameDurationMs(frame.length);
      const rms = this.computeRms(frame);
      const isSpeechFrame = rms >= this.rmsThreshold;

      this.addPreRollFrame(frame, frameMs);

      if (isSpeechFrame) {
        this.speechMs += frameMs;
        this.silenceMs = 0;
      } else {
        this.silenceMs += frameMs;
        if (!this.isSpeaking) {
          this.speechMs = 0;
        }
      }

      let activatedNow = false;
      if (!this.isSpeaking && this.speechMs >= this.speechStartMs) {
        this.isSpeaking = true;
        activatedNow = true;
        this.port.postMessage({
          type: 'vad-state',
          speaking: true,
          rms,
        });
        for (let i = 0; i < this.preRollFrames.length; i += 1) {
          this.emitAudioFrame(this.preRollFrames[i]);
        }
        this.preRollFrames = [];
        this.preRollDurationMs = 0;
      }

      if (this.isSpeaking) {
        const keepStreaming = isSpeechFrame || this.silenceMs < this.speechEndMs;
        if (!activatedNow && keepStreaming) {
          this.emitAudioFrame(frame);
        }

        if (!isSpeechFrame && this.silenceMs >= this.speechEndMs) {
          this.isSpeaking = false;
          this.speechMs = 0;
          this.silenceMs = 0;
          this.port.postMessage({
            type: 'vad-state',
            speaking: false,
            flush: true,
            rms,
          });
        }
      } else {
        const nowMs = currentTime * 1000;
        if ((nowMs - this.lastHeartbeatAtMs) >= this.silenceHeartbeatMs) {
          this.lastHeartbeatAtMs = nowMs;
          this.port.postMessage({
            type: 'silence-heartbeat',
            rms,
          });
        }
      }
    }

    // Emit silence so connecting to destination does not cause feedback.
    const output = outputs[0];
    if (output) {
      for (let channel = 0; channel < output.length; channel += 1) {
        output[channel].fill(0);
      }
    }

    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
