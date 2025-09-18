let observationMode = false;
let webgazerInitialized = false;
let gazeInterval = null;
let lastGazeData = null;
let faceDetected = true;

function initializeWebGazer() {
  if (webgazerInitialized) return;

  webgazer
    .setGazeListener((data) => {
      if (!observationMode) return;
      lastGazeData = data; // Store null/undefined when face not detected
    })
    .begin();

  webgazer.showVideoPreview(false);
  webgazer.showPredictionPoints(false);

  webgazerInitialized = true;
}

function checkGazeDirection(x, y) {
  const elements = document.querySelectorAll(".text-replaced");

  // If coordinates are invalid, face is not detected (black bounding box)
  if (x === null || y === null || x === undefined || y === undefined) {
    if (faceDetected) {
      faceDetected = false;
    }
    // Show content when face is not detected
    elements.forEach((element) => {
      element.classList.remove("hidden");
    });
    return;
  }

  if (!faceDetected) {
    faceDetected = true;
  }

  // Hide content when face is detected
  elements.forEach((element) => {
    element.classList.add("hidden");
  });
}

function toggleObservationMode() {
  if (!observationMode) {
    observationMode = true;
    console.log("=== ENTERING OBSERVATION MODE ===");

    // Keep text hidden initially
    const elements = document.querySelectorAll(".text-replaced");
    elements.forEach((element) => {
      element.classList.add("hidden");
    });

    initializeWebGazer();

    // Clear any stale gaze data
    lastGazeData = null;

    setTimeout(() => {
      gazeInterval = setInterval(() => {
        if (observationMode) {
          if (lastGazeData) {
            checkGazeDirection(lastGazeData.x, lastGazeData.y);
          } else {
            // No face detected
            checkGazeDirection(null, null);
          }
        }
      }, 100);
    }, 2000); // 2 second delay before starting gaze checks
  } else {
    observationMode = false;
    console.log("=== EXITING OBSERVATION MODE ===");

    // Stop continuous checking
    if (gazeInterval) {
      clearInterval(gazeInterval);
      gazeInterval = null;
    }

    const elements = document.querySelectorAll(".text-replaced");

    elements.forEach((element) => {
      element.classList.add("hidden");
    });

    if (webgazerInitialized) {
      webgazer.pause();
    }
  }
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    toggleObservationMode();
  }
}

window.addEventListener("DOMContentLoaded", applyNews);
window.addEventListener("orientationchange", applyNews);
window.addEventListener("keydown", handleKeydown);
