let observationMode = false;
let webgazerInitialized = false;
let gazeInterval = null;
let lastGazeData = null;

function initializeWebGazer() {
  if (webgazerInitialized) return;

  webgazer
    .setGazeListener(function (data) {
      if (!observationMode) return;
      if (!data) {
        console.log("No gaze data received");
        return;
      }
      lastGazeData = data;
      console.log(`Raw gaze data: x=${data.x}, y=${data.y}`);
    })
    .begin();

  // Show preview and prediction points for calibration
  webgazer.showVideoPreview(true);
  webgazer.showPredictionPoints(true);

  webgazerInitialized = true;
  console.log("WebGazer initialized - CALIBRATION MODE: Click around the screen to calibrate");
  console.log("Look at different parts of the screen and click to train the model");
}

function checkGazeDirection(x, y) {
  // Check if we're getting valid coordinates
  if (x === null || y === null || x === undefined || y === undefined) {
    console.log("Invalid gaze coordinates:", x, y);
    return;
  }

  // Define the main content viewing area (where text appears)
  // Based on your gaze data, you're looking around x=600, y=570
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Camera is at top, so main content area is below camera
  const contentArea = {
    left: 0,
    right: viewportWidth,
    top: viewportHeight * 0.1, // Start below camera area (top 10%)
    bottom: viewportHeight,
  };

  const isLookingAtContent =
    x >= contentArea.left &&
    x <= contentArea.right &&
    y >= contentArea.top &&
    y <= contentArea.bottom;

  console.log(
    `Gaze: (${Math.round(x)}, ${Math.round(
      y
    )}), Content area: 0-${viewportWidth} x 0-${Math.round(contentArea.bottom)}`
  );
  console.log(`Looking at content: ${isLookingAtContent}`);

  const elements = document.querySelectorAll(".text-replaced");

  elements.forEach((element) => {
    if (isLookingAtContent) {
      element.classList.add("hidden");
    } else {
      element.classList.remove("hidden");
    }
  });
}

function toggleObservationMode() {
  if (!observationMode) {
    observationMode = true;
    console.log("=== ENTERING OBSERVATION MODE ===");

    const elements = document.querySelectorAll(".text-replaced");

    initializeWebGazer();

    // Start continuous gaze checking
    gazeInterval = setInterval(() => {
      if (lastGazeData && observationMode) {
        checkGazeDirection(lastGazeData.x, lastGazeData.y);
      }
    }, 100); // Check every 100ms
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
      console.log("WebGazer paused");
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
