const stage = document.querySelector("#simulationStage");
const canvas = document.querySelector("#waveCanvas");
const context = canvas.getContext("2d");
const irradiateButton = document.querySelector("#irradiateButton");
const simulationStatus = document.querySelector("#simulationStatus");
const photonEnergySlider = document.querySelector("#photonEnergySlider");
const photonEnergyValue = document.querySelector("#photonEnergyValue");
const spectrumContent = document.querySelector(".spectrum-content");
const playButton = document.querySelector("#playButton");
const pauseButton = document.querySelector("#pauseButton");
const stepBackwardButton = document.querySelector("#stepBackwardButton");
const stepForwardButton = document.querySelector("#stepForwardButton");
const spectrumMarker = document.querySelector("#spectrumMarker");
const spectrumFrame = document.querySelector(".spectrum-frame");
const interactionZone = document.querySelector(".interaction-zone");
const lShell = document.querySelector(".l-shell");
const mShell = document.querySelector(".m-shell");
const nShell = document.querySelector(".n-shell");
const kElectrons = [...document.querySelectorAll(".k-electron")];
const lElectrons = [...document.querySelectorAll(".l-electron")];
const allElectrons = [...kElectrons, ...lElectrons];

const ELECTRON_VOLT = 1.602_176_634e-19;
const PLANCK_CONSTANT = 6.626_070_15e-34;
const SPECTRUM_MIN_FREQUENCY = 3;
const SPECTRUM_MAX_FREQUENCY = 3e24;
const RADIO_REFERENCE_FREQUENCY = 100e6;
const XRAY_REFERENCE_FREQUENCY = (60_000 * ELECTRON_VOLT) / PLANCK_CONSTANT;
const RADIO_WAVE_PROFILE = {
  amplitude: 32,
  wavelength: 44,
  packetHalfWidth: 72,
  lineWidth: 2.7,
};
const XRAY_WAVE_PROFILE = {
  amplitude: 3.5,
  wavelength: 2.8,
  packetHalfWidth: 12,
  lineWidth: 0.475,
};

const radiationBands = [
  { type: "radio", label: "Ραδιοκύματα", maxFrequency: 3e8 },
  { type: "microwave", label: "Μικροκύματα", maxFrequency: 3e11 },
  { type: "infrared", label: "Υπέρυθρη", maxFrequency: 4e14 },
  { type: "visible", label: "Ορατό", maxFrequency: 8e14 },
  { type: "uva", label: "Υπεριώδης UVA", maxFrequency: 1.2e15 },
  { type: "uvc", label: "Υπεριώδης UVC", maxFrequency: 3e16 },
  { type: "xray", label: "Ακτίνες Χ", maxFrequency: 3e19 },
  { type: "gamma", label: "Ακτίνες γ", maxFrequency: Infinity },
];

const energyNumberFormat = new Intl.NumberFormat("el-GR", {
  maximumSignificantDigits: 3,
});
const transitionEnergyNumberFormat = new Intl.NumberFormat("el-GR", {
  maximumFractionDigits: 3,
});
const superscriptCharacters = {
  "-": "⁻",
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹",
};

// Κοινή ταχύτητα διάδοσης για όλα τα μήκη κύματος (100% ταχύτερη).
const PHOTON_SPEED_PX_PER_MS = 1.04;
const WAVE_PACKET_EXTENT = 1.15;
const ATOM_PHOTON_VERTICAL_SPREAD_PX = 70;
const K_SHELL_RADIUS_PX = 35;
const L_SHELL_RADIUS_PX = 67;
const M_SHELL_RADIUS_PX = 92;
const N_SHELL_RADIUS_PX = 116;
const K_ORBIT_DURATION_MS = 8_500;
const L_ORBIT_DURATION_MS = 13_000;
const K_ORBIT_ANGULAR_SPEED = -(Math.PI * 2) / K_ORBIT_DURATION_MS;
const L_ORBIT_ANGULAR_SPEED = -(Math.PI * 2) / L_ORBIT_DURATION_MS;
const FIRST_EXCITATION_ENERGY_EV = 9.52;
const SECOND_EXCITATION_ENERGY_EV = 11.93;
const IONIZATION_ENERGY_EV = 13.618;
const K_IONIZATION_ENERGY_EV = 542;
const EXCITATION_RISE_MS = 220;
const EXCITED_STATE_HOLD_MS = 240;
const EXCITATION_RETURN_MS = 180;
const K_VACANCY_HOLD_MS = 260;
const L_TO_K_TRANSITION_MS = 320;
const COLLISION_FLASH_MS = 130;
const FRAME_STEP_MS = 1000 / 30;
const STEP_HOLD_DELAY_MS = 260;
let animationFrame = null;
let stepHoldDelay = null;
let stepHoldInterval = null;
let canvasWidth = 0;
let canvasHeight = 0;
let pixelRatio = 1;
let playbackSession = null;
let playbackTime = 0;
let playbackState = "idle";
let lastFrameTimestamp = null;

function resizeCanvas() {
  const bounds = stage.getBoundingClientRect();
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvasWidth = bounds.width;
  canvasHeight = bounds.height;

  canvas.width = Math.max(1, Math.round(canvasWidth * pixelRatio));
  canvas.height = Math.max(1, Math.round(canvasHeight * pixelRatio));
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function getSpectrumPosition(frequency) {
  const spectrumRange = Math.log10(
    SPECTRUM_MAX_FREQUENCY / SPECTRUM_MIN_FREQUENCY,
  );
  const frequencyPosition = Math.log10(
    frequency / SPECTRUM_MIN_FREQUENCY,
  );

  return (frequencyPosition / spectrumRange) * 100;
}

function getSelectedFrequency() {
  const sliderRange = Number(photonEnergySlider.max) - Number(photonEnergySlider.min);
  const sliderPosition = (
    Number(photonEnergySlider.value) - Number(photonEnergySlider.min)
  ) / sliderRange;

  return SPECTRUM_MIN_FREQUENCY * Math.pow(
    SPECTRUM_MAX_FREQUENCY / SPECTRUM_MIN_FREQUENCY,
    sliderPosition,
  );
}

function frequencyToElectronVolts(frequency) {
  return PLANCK_CONSTANT * frequency / ELECTRON_VOLT;
}

function electronVoltsToFrequency(energyInElectronVolts) {
  return energyInElectronVolts * ELECTRON_VOLT / PLANCK_CONSTANT;
}

function getRadiationBand(frequency) {
  return radiationBands.find((band) => frequency < band.maxFrequency)
    || radiationBands[radiationBands.length - 1];
}

function interpolateLogarithmically(start, end, progress) {
  return start * Math.pow(end / start, progress);
}

function getWaveProfile(frequency, radiationType) {
  const referenceRange = Math.log10(
    XRAY_REFERENCE_FREQUENCY / RADIO_REFERENCE_FREQUENCY,
  );
  const progress = Math.max(
    0,
    Math.log10(frequency / RADIO_REFERENCE_FREQUENCY) / referenceRange,
  );

  return {
    amplitude: interpolateLogarithmically(
      RADIO_WAVE_PROFILE.amplitude,
      XRAY_WAVE_PROFILE.amplitude,
      progress,
    ),
    wavelength: interpolateLogarithmically(
      RADIO_WAVE_PROFILE.wavelength,
      XRAY_WAVE_PROFILE.wavelength,
      progress,
    ),
    packetHalfWidth: interpolateLogarithmically(
      RADIO_WAVE_PROFILE.packetHalfWidth,
      XRAY_WAVE_PROFILE.packetHalfWidth,
      progress,
    ),
    lineWidth: interpolateLogarithmically(
      RADIO_WAVE_PROFILE.lineWidth,
      XRAY_WAVE_PROFILE.lineWidth,
      progress,
    ),
    blur: 0,
    color: radiationType === "visible" ? "78, 255, 126" : "255, 255, 255",
  };
}

function formatPhotonEnergy(frequency) {
  const energyInElectronVolts = frequencyToElectronVolts(frequency);

  if (energyInElectronVolts >= 9 && energyInElectronVolts < 20) {
    return `${transitionEnergyNumberFormat.format(energyInElectronVolts)} eV`;
  }

  if (energyInElectronVolts >= 0.01 && energyInElectronVolts < 1000) {
    return `${energyNumberFormat.format(energyInElectronVolts)} eV`;
  }

  const exponent = Math.floor(Math.log10(energyInElectronVolts));
  const mantissa = energyInElectronVolts / Math.pow(10, exponent);
  const superscriptExponent = String(exponent)
    .split("")
    .map((character) => superscriptCharacters[character])
    .join("");

  return `${energyNumberFormat.format(mantissa)} × 10${superscriptExponent} eV`;
}

function updateSpectrumMarker({ reveal = false } = {}) {
  const frequency = getSelectedFrequency();
  const band = getRadiationBand(frequency);
  const position = getSpectrumPosition(frequency);
  const energyText = formatPhotonEnergy(frequency);

  spectrumMarker.style.left = `${position}%`;
  spectrumContent.style.setProperty("--slider-progress", `${position}%`);
  photonEnergySlider.setAttribute("aria-valuetext", `${band.label}, ${energyText}`);
  photonEnergyValue.value = energyText;

  if (reveal && spectrumFrame.scrollWidth > spectrumFrame.clientWidth) {
    const markerX = (position / 100) * spectrumFrame.scrollWidth;
    spectrumFrame.scrollTo({
      left: Math.max(0, markerX - spectrumFrame.clientWidth / 2),
      behavior: "smooth",
    });
  }
}

function getEmissionPoint(waveProfile) {
  const packetMargin = waveProfile.packetHalfWidth * WAVE_PACKET_EXTENT;

  return {
    x: -packetMargin,
    y: canvasHeight / 2,
  };
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothStep(progress) {
  const value = clamp(progress);
  return value * value * (3 - 2 * value);
}

function getAtomGeometry() {
  const stageBounds = stage.getBoundingClientRect();
  const atomBounds = interactionZone.getBoundingClientRect();
  const lShellBounds = lShell.getBoundingClientRect();

  return {
    center: {
      x: atomBounds.left - stageBounds.left + atomBounds.width / 2,
      y: atomBounds.top - stageBounds.top + atomBounds.height / 2,
    },
    scale: lShellBounds.width / (L_SHELL_RADIUS_PX * 2),
  };
}

function getCurrentElectronPosition(electron) {
  const stageBounds = stage.getBoundingClientRect();
  const electronBounds = electron.getBoundingClientRect();

  return {
    x: electronBounds.left - stageBounds.left + electronBounds.width / 2,
    y: electronBounds.top - stageBounds.top + electronBounds.height / 2,
  };
}

function getTargetedCollision(
  originX,
  electron,
  atomGeometry,
  angularSpeed = L_ORBIT_ANGULAR_SPEED,
) {
  const currentPosition = getCurrentElectronPosition(electron);
  const offsetX = currentPosition.x - atomGeometry.center.x;
  const offsetY = currentPosition.y - atomGeometry.center.y;
  const orbitRadius = Math.hypot(offsetX, offsetY);
  const currentAngle = Math.atan2(offsetY, offsetX);
  let collisionTime = Math.max(
    0,
    (atomGeometry.center.x - originX) / PHOTON_SPEED_PX_PER_MS,
  );

  // Η θέση συγκρούσεως συγκλίνει στην κινούμενη θέση του ηλεκτρονίου.
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const angle = currentAngle + angularSpeed * collisionTime;
    const collisionX = atomGeometry.center.x + Math.cos(angle) * orbitRadius;
    collisionTime = Math.max(
      0,
      (collisionX - originX) / PHOTON_SPEED_PX_PER_MS,
    );
  }

  const collisionAngle = currentAngle + angularSpeed * collisionTime;

  return {
    time: collisionTime,
    angle: collisionAngle,
    orbitRadius,
    point: {
      x: atomGeometry.center.x + Math.cos(collisionAngle) * orbitRadius,
      y: atomGeometry.center.y + Math.sin(collisionAngle) * orbitRadius,
    },
  };
}

function getRightSideCollisionSelection(
  electrons,
  originX,
  atomGeometry,
  angularSpeed,
) {
  const collisionCandidates = electrons.map((electron) => ({
    electron,
    collision: getTargetedCollision(
      originX,
      electron,
      atomGeometry,
      angularSpeed,
    ),
  }));
  const rightSideCandidates = collisionCandidates.filter(
    ({ collision }) => collision.point.x >= atomGeometry.center.x,
  );
  const candidates = rightSideCandidates.length > 0
    ? rightSideCandidates
    : collisionCandidates;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function getElectronBaseAngle(electron) {
  return Number.parseFloat(electron.style.getPropertyValue("--angle"))
    * Math.PI / 180;
}

function interpolateAngles(startAngle, endAngle, progress) {
  const shortestDifference = Math.atan2(
    Math.sin(endAngle - startAngle),
    Math.cos(endAngle - startAngle),
  );

  return startAngle + shortestDifference * progress;
}

function getOrbitPoint(session, time) {
  const angle = session.collision.angle
    + L_ORBIT_ANGULAR_SPEED * (time - session.primaryDuration);

  return {
    x: session.atomGeometry.center.x
      + Math.cos(angle) * session.collision.orbitRadius,
    y: session.atomGeometry.center.y
      + Math.sin(angle) * session.collision.orbitRadius,
  };
}

function getKVacancyAngle(session, time) {
  return session.collision.angle
    + K_ORBIT_ANGULAR_SPEED * (time - session.primaryDuration);
}

function getKVacancyPoint(session, time) {
  const angle = getKVacancyAngle(session, time);
  const radius = K_SHELL_RADIUS_PX * session.atomGeometry.scale;

  return {
    x: session.atomGeometry.center.x + Math.cos(angle) * radius,
    y: session.atomGeometry.center.y + Math.sin(angle) * radius,
  };
}

function setShellOpacity(shell, opacity) {
  const visibleOpacity = clamp(opacity);
  shell.style.opacity = String(visibleOpacity);
  shell.style.visibility = visibleOpacity > 0.001 ? "visible" : "hidden";
}

function resetAtomVisualState() {
  setShellOpacity(mShell, 0);
  setShellOpacity(nShell, 0);

  allElectrons.forEach((electron) => {
    const shellRadius = electron.classList.contains("k-electron")
      ? K_SHELL_RADIUS_PX
      : L_SHELL_RADIUS_PX;

    electron.classList.remove("is-ionized");
    electron.style.setProperty("--orbit-turn", "0rad");
    electron.style.setProperty("--radius", `${shellRadius}px`);
    electron.style.setProperty("--escape-x", "0px");
    electron.style.setProperty("--escape-y", "0px");
    electron.style.setProperty("--electron-opacity", "1");
  });
}

function renderElectronOrbits(time) {
  const kOrbitTurn = K_ORBIT_ANGULAR_SPEED * time;
  const lOrbitTurn = L_ORBIT_ANGULAR_SPEED * time;

  kElectrons.forEach((electron) => {
    electron.style.setProperty("--orbit-turn", `${kOrbitTurn}rad`);
  });

  lElectrons.forEach((electron) => {
    electron.style.setProperty("--orbit-turn", `${lOrbitTurn}rad`);
  });
}

function traceWave(centerX, centerY, directionAngle, options) {
  const packetHalfWidth = options.packetHalfWidth;
  const amplitude = options.amplitude;
  const wavelength = options.wavelength;
  const startX = -packetHalfWidth * WAVE_PACKET_EXTENT;
  const endX = packetHalfWidth * WAVE_PACKET_EXTENT;
  const sampleStep = Math.max(0.35, Math.min(1.5, wavelength / 12));

  context.save();
  context.translate(centerX, centerY);
  context.rotate(directionAngle);
  context.beginPath();

  for (let x = startX; x <= endX; x += sampleStep) {
    const distance = x;
    const envelope = Math.exp(-Math.pow(distance / packetHalfWidth, 2) * 2.8);
    const phase = (distance / wavelength) * Math.PI * 2;
    const y = Math.sin(phase) * amplitude * envelope;

    if (x === startX) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.lineWidth = options.lineWidth;
  context.strokeStyle = options.color;
  context.shadowColor = options.glow;
  context.shadowBlur = options.blur;
  context.stroke();
  context.restore();
}

function drawPacket(packet, elapsed) {
  const profile = packet.waveProfile;
  const travelDistance = elapsed * PHOTON_SPEED_PX_PER_MS;
  const centerX = packet.origin.x + Math.cos(packet.directionAngle) * travelDistance;
  const centerY = packet.origin.y + Math.sin(packet.directionAngle) * travelDistance;
  const packetMargin = profile.packetHalfWidth * WAVE_PACKET_EXTENT;
  const edgeOverflow = Math.max(
    -centerX,
    centerX - canvasWidth,
    -centerY,
    centerY - canvasHeight,
    0,
  );
  const fadeIn = Math.min(1, elapsed / 140);
  const fadeOut = Math.max(0, 1 - edgeOverflow / packetMargin);
  const opacity = fadeIn * fadeOut;

  context.save();
  context.globalAlpha = opacity;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (profile.blurOnly) {
    context.save();
    context.filter = `blur(${profile.blur}px)`;
    traceWave(centerX, centerY, packet.directionAngle, {
      ...profile,
      lineWidth: profile.lineWidth + profile.blur * 0.22,
      color: `rgba(${profile.color}, 0.82)`,
      glow: "transparent",
      blur: 0,
    });
    context.restore();
  } else if (profile.blur > 0) {
    traceWave(centerX, centerY, packet.directionAngle, {
      ...profile,
      lineWidth: profile.lineWidth + profile.blur * 0.24,
      color: `rgba(${profile.color}, 0.13)`,
      glow: `rgba(${profile.color}, 0.78)`,
      blur: profile.blur,
    });
  }

  if (!profile.blurOnly) {
    traceWave(centerX, centerY, packet.directionAngle, {
      ...profile,
      color: `rgba(${profile.color}, 0.92)`,
      glow: `rgba(${profile.color}, 0.82)`,
      blur: profile.blur * 0.32,
    });

    traceWave(centerX, centerY, packet.directionAngle, {
      ...profile,
      lineWidth: Math.max(0.35, profile.lineWidth * 0.3),
      color: `rgba(${profile.color}, 1)`,
      glow: "transparent",
      blur: 0,
    });
  }

  context.restore();
  return edgeOverflow >= packetMargin;
}

function drawCollisionFlash(point, elapsed) {
  const progress = clamp(elapsed / COLLISION_FLASH_MS);
  const radius = 5 + progress * 14;

  context.save();
  context.globalAlpha = 1 - progress;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = "rgba(224, 249, 255, 0.32)";
  context.shadowColor = "rgba(165, 243, 252, 0.95)";
  context.shadowBlur = 18;
  context.fill();
  context.restore();
}

function setStatus(text, active = true) {
  simulationStatus.classList.toggle("is-active", active);
  simulationStatus.lastChild.textContent = ` ${text}`;
}

function getPacketDuration(packet) {
  const profile = packet.waveProfile;
  const packetMargin = profile.packetHalfWidth * WAVE_PACKET_EXTENT;
  const directionX = Math.cos(packet.directionAngle);
  const directionY = Math.sin(packet.directionAngle);
  const distanceToVerticalEdge = Math.abs(directionX) < 0.001
    ? Infinity
    : directionX > 0
      ? (canvasWidth + packetMargin - packet.origin.x) / directionX
      : (-packetMargin - packet.origin.x) / directionX;
  const distanceToHorizontalEdge = Math.abs(directionY) < 0.001
    ? Infinity
    : directionY > 0
      ? (canvasHeight + packetMargin - packet.origin.y) / directionY
      : (-packetMargin - packet.origin.y) / directionY;
  const travelDistance = Math.max(
    0,
    Math.min(distanceToVerticalEdge, distanceToHorizontalEdge),
  );

  return travelDistance / PHOTON_SPEED_PX_PER_MS;
}

function getRandomDirection() {
  return Math.random() * Math.PI * 2;
}

function getIonizationElectronSpeed(excessEnergy) {
  // Μονότονη αύξηση με την περίσσεια ενέργειας και άνω όριο κάτω από το φωτόνιο.
  return 0.08 + 0.84 * (excessEnergy / (excessEnergy + 20));
}

function getMovingPointExitDuration(point, directionAngle, speed, margin = 18) {
  const directionX = Math.cos(directionAngle);
  const directionY = Math.sin(directionAngle);
  const distanceToVerticalEdge = Math.abs(directionX) < 0.001
    ? Infinity
    : directionX > 0
      ? (canvasWidth + margin - point.x) / directionX
      : (-margin - point.x) / directionX;
  const distanceToHorizontalEdge = Math.abs(directionY) < 0.001
    ? Infinity
    : directionY > 0
      ? (canvasHeight + margin - point.y) / directionY
      : (-margin - point.y) / directionY;

  return Math.max(
    0,
    Math.min(distanceToVerticalEdge, distanceToHorizontalEdge),
  ) / speed;
}

function createPlaybackSession() {
  const frequency = getSelectedFrequency();
  const energy = frequencyToElectronVolts(frequency);
  const radiationType = getRadiationBand(frequency).type;
  const waveProfile = getWaveProfile(frequency, radiationType);
  const origin = getEmissionPoint(waveProfile);

  if (energy < FIRST_EXCITATION_ENERGY_EV) {
    origin.y = canvasHeight / 2
      + (Math.random() * 2 - 1) * ATOM_PHOTON_VERTICAL_SPREAD_PX;

    const primaryPacket = { origin, waveProfile, directionAngle: 0 };
    const primaryDuration = getPacketDuration(primaryPacket);

    return {
      interaction: "pass",
      energy,
      primaryPacket,
      primaryDuration,
      totalDuration: primaryDuration,
    };
  }

  const atomGeometry = getAtomGeometry();
  if (energy >= K_IONIZATION_ENERGY_EV) {
    const selection = getRightSideCollisionSelection(
      kElectrons,
      origin.x,
      atomGeometry,
      K_ORBIT_ANGULAR_SPEED,
    );
    const selectedElectron = selection.electron;
    const collision = selection.collision;
    origin.y = collision.point.y;

    const primaryPacket = { origin, waveProfile, directionAngle: 0 };
    const excessEnergy = energy - K_IONIZATION_ENERGY_EV;
    const electronSpeed = getIonizationElectronSpeed(excessEnergy);
    const electronDirection = (Math.random() - 0.5) * (Math.PI * 2 / 3);
    const electronExitDuration = getMovingPointExitDuration(
      collision.point,
      electronDirection,
      electronSpeed,
    );
    const fallStart = collision.time + K_VACANCY_HOLD_MS;
    const vacancyAngleAtFall = collision.angle
      + K_ORBIT_ANGULAR_SPEED * (fallStart - collision.time);
    const fallingCandidates = lElectrons.map((electron) => {
      const angle = getElectronBaseAngle(electron)
        + L_ORBIT_ANGULAR_SPEED * fallStart;
      const angularDistance = Math.abs(Math.atan2(
        Math.sin(angle - vacancyAngleAtFall),
        Math.cos(angle - vacancyAngleAtFall),
      ));

      return { electron, angle, angularDistance };
    }).sort((first, second) => first.angularDistance - second.angularDistance);
    const fallingElectron = fallingCandidates[0].electron;
    const fallingStartAngle = fallingCandidates[0].angle;
    const secondaryStart = fallStart + L_TO_K_TRANSITION_MS;
    const session = {
      interaction: "k-ionization",
      energy,
      emittedEnergy: K_IONIZATION_ENERGY_EV,
      selectedElectron,
      selectedShellRadius: K_SHELL_RADIUS_PX,
      fallingElectron,
      fallingStartAngle,
      atomGeometry,
      collision,
      primaryPacket,
      primaryDuration: collision.time,
      excessEnergy,
      electronSpeed,
      electronDirection,
      electronExitDuration,
      fallStart,
      secondaryStart,
    };
    const emittedFrequency = electronVoltsToFrequency(K_IONIZATION_ENERGY_EV);
    const emittedRadiationType = getRadiationBand(emittedFrequency).type;
    const secondaryPacket = {
      origin: getKVacancyPoint(session, secondaryStart),
      waveProfile: getWaveProfile(emittedFrequency, emittedRadiationType),
      directionAngle: getRandomDirection(),
    };
    const secondaryDuration = getPacketDuration(secondaryPacket);
    const secondaryEnd = secondaryStart + secondaryDuration;

    return {
      ...session,
      secondaryPacket,
      secondaryDuration,
      secondaryEnd,
      totalDuration: Math.max(
        collision.time + electronExitDuration,
        secondaryEnd,
      ),
    };
  }

  const selection = getRightSideCollisionSelection(
    lElectrons,
    origin.x,
    atomGeometry,
    L_ORBIT_ANGULAR_SPEED,
  );
  const selectedElectron = selection.electron;
  const collision = selection.collision;
  origin.y = collision.point.y;

  const primaryPacket = { origin, waveProfile, directionAngle: 0 };
  const baseSession = {
    energy,
    selectedElectron,
    selectedShellRadius: L_SHELL_RADIUS_PX,
    atomGeometry,
    collision,
    primaryPacket,
    primaryDuration: collision.time,
  };

  if (energy >= IONIZATION_ENERGY_EV) {
    const excessEnergy = energy - IONIZATION_ENERGY_EV;
    const electronSpeed = getIonizationElectronSpeed(excessEnergy);
    const electronDirection = (Math.random() - 0.5) * (Math.PI * 2 / 3);
    const electronExitDuration = getMovingPointExitDuration(
      collision.point,
      electronDirection,
      electronSpeed,
    );

    return {
      ...baseSession,
      interaction: "ionization",
      excessEnergy,
      electronSpeed,
      electronDirection,
      electronExitDuration,
      totalDuration: collision.time + electronExitDuration,
    };
  }

  const goesToNShell = energy >= SECOND_EXCITATION_ENERGY_EV;
  const targetShell = goesToNShell ? nShell : mShell;
  const targetRadius = goesToNShell ? N_SHELL_RADIUS_PX : M_SHELL_RADIUS_PX;
  const emittedEnergy = goesToNShell
    ? SECOND_EXCITATION_ENERGY_EV
    : FIRST_EXCITATION_ENERGY_EV;
  const returnStart = collision.time + EXCITATION_RISE_MS + EXCITED_STATE_HOLD_MS;
  const secondaryStart = returnStart + EXCITATION_RETURN_MS;
  const session = {
    ...baseSession,
    interaction: "excitation",
    targetShell,
    targetShellName: goesToNShell ? "N" : "M",
    targetRadius,
    emittedEnergy,
    returnStart,
    secondaryStart,
  };
  const emittedFrequency = electronVoltsToFrequency(emittedEnergy);
  const emittedRadiationType = getRadiationBand(emittedFrequency).type;
  const secondaryPacket = {
    origin: getOrbitPoint(session, secondaryStart),
    waveProfile: getWaveProfile(emittedFrequency, emittedRadiationType),
    directionAngle: getRandomDirection(),
  };
  const secondaryDuration = getPacketDuration(secondaryPacket);

  return {
    ...session,
    secondaryPacket,
    secondaryDuration,
    totalDuration: secondaryStart + secondaryDuration,
  };
}

function clearPlaybackVisuals() {
  context.clearRect(0, 0, canvasWidth, canvasHeight);
}

function renderAtomState(session, time) {
  setShellOpacity(mShell, 0);
  setShellOpacity(nShell, 0);

  if (!session.selectedElectron) {
    return;
  }

  const electron = session.selectedElectron;
  electron.classList.remove("is-ionized");
  electron.style.setProperty(
    "--radius",
    `${session.selectedShellRadius}px`,
  );
  electron.style.setProperty("--escape-x", "0px");
  electron.style.setProperty("--escape-y", "0px");
  electron.style.setProperty("--electron-opacity", "1");

  if (session.interaction === "excitation") {
    const timeAfterCollision = time - session.primaryDuration;
    let radius = L_SHELL_RADIUS_PX;
    let shellOpacity = 0;

    if (timeAfterCollision >= 0 && time < session.returnStart) {
      const riseProgress = smoothStep(timeAfterCollision / EXCITATION_RISE_MS);
      radius = L_SHELL_RADIUS_PX
        + (session.targetRadius - L_SHELL_RADIUS_PX) * riseProgress;
      shellOpacity = riseProgress;
    } else if (time >= session.returnStart && time < session.secondaryStart) {
      const returnProgress = smoothStep(
        (time - session.returnStart) / EXCITATION_RETURN_MS,
      );
      radius = session.targetRadius
        + (L_SHELL_RADIUS_PX - session.targetRadius) * returnProgress;
      shellOpacity = 1 - returnProgress;
    }

    electron.style.setProperty("--radius", `${radius}px`);
    setShellOpacity(session.targetShell, shellOpacity);
    if (session.targetShell === nShell) {
      setShellOpacity(mShell, shellOpacity);
    }
    return;
  }

  if (
    ["ionization", "k-ionization"].includes(session.interaction)
    && time >= session.primaryDuration
  ) {
    const elapsed = time - session.primaryDuration;
    const travelDistance = elapsed * session.electronSpeed;
    const atomOffsetX = session.collision.point.x - session.atomGeometry.center.x;
    const atomOffsetY = session.collision.point.y - session.atomGeometry.center.y;
    const escapeX = (
      atomOffsetX + Math.cos(session.electronDirection) * travelDistance
    ) / session.atomGeometry.scale;
    const escapeY = (
      atomOffsetY + Math.sin(session.electronDirection) * travelDistance
    ) / session.atomGeometry.scale;

    electron.classList.add("is-ionized");
    electron.style.setProperty("--radius", "0px");
    electron.style.setProperty("--escape-x", `${escapeX}px`);
    electron.style.setProperty("--escape-y", `${escapeY}px`);
  }

  if (session.interaction === "k-ionization") {
    const fallingElectron = session.fallingElectron;
    fallingElectron.classList.remove("is-ionized");
    fallingElectron.style.setProperty("--radius", `${L_SHELL_RADIUS_PX}px`);
    fallingElectron.style.setProperty("--escape-x", "0px");
    fallingElectron.style.setProperty("--escape-y", "0px");
    fallingElectron.style.setProperty("--electron-opacity", "1");

    if (time >= session.fallStart) {
      const fallProgress = smoothStep(
        (time - session.fallStart) / L_TO_K_TRANSITION_MS,
      );
      const targetAngle = getKVacancyAngle(session, time);
      const currentAngle = interpolateAngles(
        session.fallingStartAngle,
        targetAngle,
        fallProgress,
      );
      const currentRadius = L_SHELL_RADIUS_PX
        + (K_SHELL_RADIUS_PX - L_SHELL_RADIUS_PX) * fallProgress;
      const orbitTurn = currentAngle - getElectronBaseAngle(fallingElectron);

      fallingElectron.style.setProperty("--radius", `${currentRadius}px`);
      fallingElectron.style.setProperty("--orbit-turn", `${orbitTurn}rad`);
    }
  }
}

function updatePlaybackStatus(session, time) {
  let text = session.interaction === "pass"
    ? "Χωρίς αλληλεπίδραση"
    : "Ολοκλήρωση αλληλεπίδρασης";
  let active = time < session.totalDuration;

  if (time < session.primaryDuration) {
    if (session.interaction === "pass") {
      text = "Διέλευση χωρίς αλληλεπίδραση";
    } else if (session.interaction === "k-ionization") {
      text = "Πορεία προς ηλεκτρόνιο K";
    } else {
      text = "Πορεία προς ηλεκτρόνιο L";
    }
  } else if (session.interaction === "excitation") {
    if (time < session.returnStart) {
      text = `Διέγερση στη στιβάδα ${session.targetShellName}`;
    } else if (time < session.secondaryStart) {
      text = "Αποδιέγερση προς τη στιβάδα L";
    } else if (time < session.totalDuration) {
      text = `Επανεκπομπή φωτονίου ${transitionEnergyNumberFormat.format(session.emittedEnergy)} eV`;
    }
  } else if (session.interaction === "ionization") {
    text = "Ιονισμός · απομάκρυνση ηλεκτρονίου";
  } else if (session.interaction === "k-ionization") {
    if (time < session.fallStart) {
      text = "Ιονισμός ηλεκτρονίου K";
    } else if (time < session.secondaryStart) {
      text = "Μετάπτωση ηλεκτρονίου L → K";
    } else if (time < session.secondaryEnd) {
      text = "Εκπομπή φωτονίου 542 eV";
    } else if (time < session.totalDuration) {
      text = "Απομάκρυνση ηλεκτρονίου K";
    }
  }

  if (playbackState === "paused" && time < session.totalDuration) {
    text = `Παύση · ${text}`;
  }

  setStatus(text, active);
}

function renderPlaybackFrame() {
  if (!playbackSession) {
    clearPlaybackVisuals();
    renderElectronOrbits(0);
    return;
  }

  const session = playbackSession;
  const time = Math.min(playbackTime, session.totalDuration);

  context.clearRect(0, 0, canvasWidth, canvasHeight);
  renderElectronOrbits(time);
  renderAtomState(session, time);

  if (time <= session.primaryDuration) {
    drawPacket(session.primaryPacket, time);
  }

  if (
    session.interaction !== "pass"
    && time >= session.primaryDuration
    && time < session.primaryDuration + COLLISION_FLASH_MS
  ) {
    drawCollisionFlash(
      session.collision.point,
      time - session.primaryDuration,
    );
  }

  if (
    session.secondaryPacket
    && time >= session.secondaryStart
    && time < session.secondaryStart + session.secondaryDuration
  ) {
    drawPacket(session.secondaryPacket, time - session.secondaryStart);
  }

  irradiateButton.disabled = time < session.totalDuration;
  updatePlaybackStatus(session, time);
  updatePlaybackControls();
}

function updatePlaybackControls() {
  const hasSession = Boolean(playbackSession);
  const atStart = !hasSession || playbackTime <= 0;
  const atEnd = !hasSession || playbackTime >= playbackSession.totalDuration;
  const isPlaying = playbackState === "playing";
  const isPaused = playbackState === "paused";

  playButton.disabled = !hasSession || isPlaying || atEnd;
  pauseButton.disabled = !hasSession || !isPlaying;
  stepBackwardButton.disabled = !isPaused || atStart;
  stepForwardButton.disabled = !isPaused || atEnd;
}

function setPlaybackState(nextState) {
  if (animationFrame !== null) {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  playbackState = nextState;
  lastFrameTimestamp = null;
  updatePlaybackControls();

  if (nextState === "playing") {
    animationFrame = window.requestAnimationFrame(renderPlayback);
  }
}

function renderPlayback(timestamp) {
  if (playbackState !== "playing" || !playbackSession) {
    animationFrame = null;
    return;
  }

  if (lastFrameTimestamp !== null) {
    playbackTime += timestamp - lastFrameTimestamp;
  }
  lastFrameTimestamp = timestamp;

  if (playbackTime >= playbackSession.totalDuration) {
    playbackTime = playbackSession.totalDuration;
    renderPlaybackFrame();
    setPlaybackState("paused");
    return;
  }

  renderPlaybackFrame();
  animationFrame = window.requestAnimationFrame(renderPlayback);
}

function stepPlayback(direction) {
  if (playbackState !== "paused" || !playbackSession) {
    return;
  }

  playbackTime = Math.min(
    playbackSession.totalDuration,
    Math.max(0, playbackTime + direction * FRAME_STEP_MS),
  );
  renderPlaybackFrame();
}

function stopContinuousStep() {
  if (stepHoldDelay !== null) {
    window.clearTimeout(stepHoldDelay);
    stepHoldDelay = null;
  }

  if (stepHoldInterval !== null) {
    window.clearInterval(stepHoldInterval);
    stepHoldInterval = null;
  }
}

function startContinuousStep(button, direction) {
  stopContinuousStep();
  stepPlayback(direction);

  stepHoldDelay = window.setTimeout(() => {
    stepHoldDelay = null;
    stepHoldInterval = window.setInterval(() => {
      if (button.disabled) {
        stopContinuousStep();
        return;
      }
      stepPlayback(direction);
    }, FRAME_STEP_MS);
  }, STEP_HOLD_DELAY_MS);
}

function bindStepButton(button, direction) {
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || button.disabled) {
      return;
    }

    event.preventDefault();
    button.focus({ preventScroll: true });
    button.setPointerCapture(event.pointerId);
    startContinuousStep(button, direction);
  });

  button.addEventListener("pointerup", stopContinuousStep);
  button.addEventListener("pointercancel", stopContinuousStep);
  button.addEventListener("lostpointercapture", stopContinuousStep);
  button.addEventListener("click", (event) => {
    if (event.detail === 0) {
      stepPlayback(direction);
    }
  });
}

function emitWavePacket() {
  if (irradiateButton.disabled) {
    return;
  }

  setPlaybackState("idle");
  clearPlaybackVisuals();
  resetAtomVisualState();
  playbackSession = createPlaybackSession();
  playbackTime = 0;
  irradiateButton.disabled = true;

  renderPlaybackFrame();
  setPlaybackState("playing");
}

irradiateButton.addEventListener("click", emitWavePacket);
playButton.addEventListener("click", () => {
  if (playbackSession && playbackTime < playbackSession.totalDuration) {
    setPlaybackState("playing");
  }
});
pauseButton.addEventListener("click", () => {
  setPlaybackState("paused");
  renderPlaybackFrame();
});
bindStepButton(stepBackwardButton, -1);
bindStepButton(stepForwardButton, 1);
photonEnergySlider.addEventListener("input", () => {
  updateSpectrumMarker({ reveal: true });
});

const resizeObserver = new ResizeObserver(() => {
  resizeCanvas();
  if (playbackSession) {
    renderPlaybackFrame();
  }
});

resizeObserver.observe(stage);
resizeCanvas();
resetAtomVisualState();
updateSpectrumMarker();
updatePlaybackControls();
