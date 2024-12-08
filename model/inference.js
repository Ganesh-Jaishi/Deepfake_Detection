const ort = require('onnxruntime');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

// Main function
async function runInference(videoPath) {
  try {
    // Load the ONNX model - Replace with model path
    const session = await ort.InferenceSession.create('C:\\Users\\Ganesh\\my-node-project\\deepfake_model.onnx');

    // Extract frames from the video
    const frames = await extractFramesFromVideo(videoPath, 60); // 60 frames
    console.log(`Extracted ${frames.length} frames`);

    // Preprocess the frames
    const preprocessedFrames = await preprocessFrames(frames);
    console.log('Frames preprocessed successfully');

    // Prepare ONNX input tensor
    const inputTensor = new ort.Tensor(
      'float32',
      Float32Array.from(preprocessedFrames.flat()),
      [1, 60, 3, 224, 224] // Batch size: 1, Frames: 60, Channels: 3, Height/Width: 224
    );

    // Run inference
    const results = await session.run({ input: inputTensor });
    const logits = results.output.data;

    // Process the results
    const prediction = logits.indexOf(Math.max(...logits));
    const confidence = Math.max(...logits) * 100;

    console.log('Prediction:', prediction === 0 ? 'Fake' : 'Real');
    console.log('Confidence:', confidence.toFixed(2), '%');
  } catch (error) {
    console.error('Error during inference:', error);
  }
}

// Function to extract frames from a video
async function extractFramesFromVideo(videoPath, numFrames) {
  return new Promise((resolve, reject) => {
    const frames = [];
    ffmpeg(videoPath)
      .on('start', () => console.log('Starting frame extraction...'))
      .on('error', (err) => reject(`Error extracting frames: ${err.message}`))
      .on('end', () => resolve(frames))
      .fps(1) // Capture 1 frame per second (adjust as needed)
      .outputOptions('-vf', `select=not(mod(n\\,${Math.floor(30 / numFrames)}))`)
      .outputOptions('-vsync', 'vfr')
      .output('%04d.jpg') // Output frame images
      .run();

    ffmpeg(videoPath).on('frame', (frame) => frames.push(frame));
  });
}

// Function to preprocess frames
async function preprocessFrames(frames) {
  const preprocessed = [];
  for (const frame of frames) {
    const tensor = await preprocessFrame(frame);
    preprocessed.push(tensor);
  }
  return preprocessed;
}

// Function to preprocess a single frame
async function preprocessFrame(framePath) {
  const buffer = await sharp(framePath)
    .resize(224, 224) // Resize to 224x224
    .raw() // Get raw pixel data
    .toBuffer();

  const normalized = Array.from(buffer).map((pixel) => pixel / 255.0); // Normalize to [0, 1]
  return normalized;
}

// Run the main function - Update with directory of file
runInference('C:/Users/Ganesh/Downloads/Documents/Desktop/website/real1.mp4');
