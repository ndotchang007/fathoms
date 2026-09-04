function initSpeak(state) {
  const speakSetting = state.settings?.speakingTimer ?? 300;
  const SPEAK_MAX = speakSetting > 0 ? speakSetting : Infinity;
  const SPEAK_WARN = 60;
  const SPEAK_UNLIMITED = !Number.isFinite(SPEAK_MAX);
  const MAX_TRANSCRIPT_WORDS = 800;
  let mediaRecorder = null;
  let audioChunks = [];
  let audioContext = null;
  let analyser = null;
  let animFrame = null;
  let speakTimer = null;
  let speakElapsed = 0;
  let isRecording = false;
  let stream = null;
  let recognition = null;
  let transcriptFinal = '';
  let transcriptInterim = '';

  const micBtn = document.getElementById('mic-button');
  const micError = document.getElementById('mic-error');
  const restartBtn = document.getElementById('restart-recording');
  const submitBtn = document.getElementById('submit-recording');
  const speakTimerEl = document.getElementById('speak-timer');
  const timerHint = document.getElementById('speak-timer-hint');
  const waveform = document.getElementById('waveform');
  const transcriptStatus = document.getElementById('transcript-status');
  const transcriptBody = document.getElementById('transcript-body');

  const headingEl = document.getElementById('speak-heading');
  if (headingEl && state.topic?.title) {
    headingEl.textContent = `Explain “${state.topic.title}”`;
  }

  const speakNotesPanel = document.getElementById('speak-notes-panel');
  const speakNotesBody = document.getElementById('speak-notes-body');
  if (speakNotesPanel && speakNotesBody) {
    if (state.settings?.showNotesDuringSpeech && state.session?.id) {
      const notesText = localStorage.getItem(`fathoms-notes-${state.session.id}`) || '';
      speakNotesPanel.hidden = false;
      if (notesText.trim()) {
        speakNotesBody.innerHTML = `<p class="speak-notes-text">${escapeHtml(notesText)}</p>`;
      } else {
        speakNotesBody.innerHTML = '<p class="transcript-placeholder">No notes from this session.</p>';
      }
    } else {
      speakNotesPanel.hidden = true;
      speakNotesBody.innerHTML = '';
    }
  }

  waveform.innerHTML = Array(20).fill('<div class="waveform-bar" style="height:8px"></div>').join('');

  function formatSpeakTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function getFullTranscript() {
    return `${transcriptFinal} ${transcriptInterim}`.trim();
  }

  function updateSpeakDisplay() {
    speakTimerEl.textContent = formatSpeakTime(speakElapsed);
    const overOneMinute = speakElapsed >= SPEAK_WARN;
    speakTimerEl.classList.toggle('over-threshold', overOneMinute);

    if (SPEAK_UNLIMITED) {
      timerHint.textContent = overOneMinute
        ? 'Take your time — resurface when ready'
        : 'No time limit — resurface when ready';
      return;
    }

    if (overOneMinute) {
      const remaining = SPEAK_MAX - speakElapsed;
      timerHint.textContent = remaining > 0
        ? `Past 1:00 — ${formatSpeakTime(remaining)} remaining`
        : 'Past 1:00 — resurface when ready';
    } else {
      const remaining = SPEAK_WARN - speakElapsed;
      timerHint.textContent = `1:00 emphasis in ${formatSpeakTime(remaining)}`;
    }
  }

  function renderTranscript() {
    const hasText = transcriptFinal || transcriptInterim;
    if (!hasText) {
      transcriptBody.innerHTML = '<p class="transcript-placeholder">Your words will appear here as you speak...</p>';
      return;
    }
    transcriptBody.innerHTML = `<p class="transcript-final">${escapeHtml(transcriptFinal)}<span class="transcript-interim">${escapeHtml(transcriptInterim)}</span></p>`;
    transcriptBody.scrollTop = transcriptBody.scrollHeight;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      transcriptStatus.textContent = 'Transcript unavailable';
      return null;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcriptFinal += (transcriptFinal ? ' ' : '') + text;
        } else {
          interim += text;
        }
      }
      transcriptInterim = interim;
      renderTranscript();
    };

    rec.onerror = () => {
      transcriptStatus.textContent = 'Transcript paused';
    };

    rec.onend = () => {
      if (isRecording) {
        try { rec.start(); } catch {}
      }
    };

    return rec;
  }

  function startRecognition() {
    recognition = setupSpeechRecognition();
    if (!recognition) return;
    transcriptStatus.textContent = 'Listening...';
    try {
      recognition.start();
    } catch {}
  }

  function stopRecognition() {
    if (recognition) {
      try { recognition.stop(); } catch {}
      recognition = null;
    }
    transcriptStatus.textContent = transcriptFinal ? 'Complete' : 'No speech detected';
  }

  function showRecordingControls() {
    restartBtn.hidden = false;
    submitBtn.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Resurface';
  }

  function hideRecordingControls() {
    restartBtn.hidden = true;
    submitBtn.hidden = true;
  }

  function showError(msg) {
    micError.style.display = 'block';
    micError.textContent = msg;
    submitBtn.hidden = false;
    submitBtn.textContent = 'Resurface anyway';
  }

  async function initMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError('Your browser does not support microphone recording. You can still resurface to submit.');
      return false;
    }
    if (typeof MediaRecorder === 'undefined') {
      showError('MediaRecorder is not supported in your browser. You can still resurface to submit.');
      return false;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        showError('Microphone permission denied. You can still resurface to submit.');
      } else if (err.name === 'NotFoundError') {
        showError('No microphone found. You can still resurface to submit.');
      } else {
        showError('Could not access microphone. You can still resurface to submit.');
      }
      return false;
    }
  }

  function setupWaveform() {
    if (!stream) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const bars = waveform.querySelectorAll('.waveform-bar');

    function draw() {
      if (!isRecording) {
        animFrame = requestAnimationFrame(draw);
        return;
      }
      analyser.getByteFrequencyData(dataArray);
      bars.forEach((bar, i) => {
        const val = dataArray[i % bufferLength];
        bar.style.height = `${Math.max(4, val / 3)}px`;
      });
      animFrame = requestAnimationFrame(draw);
    }
    waveform.classList.add('active');
    draw();
  }

  function startRecording() {
    if (!stream) return;
    audioChunks = [];
    transcriptFinal = '';
    transcriptInterim = '';
    renderTranscript();

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.start(100);
    isRecording = true;
    transcriptStatus.textContent = 'Recording';
    micBtn.classList.add('recording');
    showRecordingControls();
    window.SFX?.record();

    startRecognition();

    speakTimer = setInterval(() => {
      speakElapsed++;
      updateSpeakDisplay();
    }, 1000);

    setupWaveform();
  }

  function stopRecordingTracks() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    clearInterval(speakTimer);
    stopRecognition();
    isRecording = false;
    micBtn.classList.remove('recording');
    if (animFrame) cancelAnimationFrame(animFrame);
  }

  function restartRecording() {
    stopRecordingTracks();
    audioChunks = [];
    speakElapsed = 0;
    transcriptFinal = '';
    transcriptInterim = '';
    updateSpeakDisplay();
    renderTranscript();
    speakTimerEl.classList.remove('over-threshold');
    timerHint.textContent = 'Tap the mic to begin';
    transcriptStatus.textContent = 'Tap mic to start';
    micError.style.display = 'none';
    barsReset();
    waveform.classList.remove('active');
    hideRecordingControls();
  }

  function barsReset() {
    waveform.querySelectorAll('.waveform-bar').forEach((bar) => {
      bar.style.height = '8px';
    });
  }

  async function resurface() {
    if (submitBtn.disabled) return;

    const fullTranscript = getFullTranscript();
    const wordCount = countWords(fullTranscript);
    if (wordCount > MAX_TRANSCRIPT_WORDS) {
      micError.style.display = 'block';
      micError.textContent = `Your transcript is ${wordCount} words (limit: ${MAX_TRANSCRIPT_WORDS}). Please restart with a shorter response.`;
      return;
    }

    submitBtn.disabled = true;
    stopRecordingTracks();
    hideRecordingControls();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (audioContext) audioContext.close();
    state.speakingDuration = speakElapsed || 30;
    state.transcript = transcriptFinal || fullTranscript || '';
    initResults(state);
    goToStep(4);
  }

  restartBtn.addEventListener('click', restartRecording);
  submitBtn.addEventListener('click', resurface);
  micBtn.addEventListener('click', async () => {
    if (isRecording) return;
    if (!stream) {
      const ok = await initMic();
      if (!ok) return;
    }
    startRecording();
  });

  updateSpeakDisplay();
  renderTranscript();
  hideRecordingControls();
  transcriptStatus.textContent = 'Tap mic to start';
}
