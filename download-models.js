// download-models.js
const https = require('https');
const fs = require('fs');
const path = require('path');

const models = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
];

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const modelDir = path.join(__dirname, 'public', 'models');

// Create models directory if it doesn't exist
if (!fs.existsSync(modelDir)) {
  fs.mkdirSync(modelDir, { recursive: true });
}

// Download each model file
models.forEach(model => {
  const url = baseUrl + model;
  const filePath = path.join(modelDir, model);
  
  console.log(`Downloading ${model}...`);
  
  https.get(url, (response) => {
    if (response.statusCode === 200) {
      const file = fs.createWriteStream(filePath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${model}`);
      });
    } else {
      console.error(`Failed to download ${model}: ${response.statusCode}`);
    }
  }).on('error', (err) => {
    console.error(`Error downloading ${model}:`, err.message);
  });
});