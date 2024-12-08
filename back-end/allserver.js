const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffprobe = require('ffprobe-static');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

// Initialize Express app
const app = express();
const port = 3000;

// CORS Middleware
app.use(
  cors({
    origin: '*', // Allows requests from any origin
    methods: 'GET,POST', // Allowed HTTP methods
    allowedHeaders: 'Content-Type',
  })
);

// Middleware for parsing JSON and URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files (like HTML pages for registration/login)
app.use(express.static(path.join(__dirname, 'public')));

// Set ffprobe path for ffmpeg
ffmpeg.setFfprobePath(ffprobe.path);

// Multer configuration for file uploads
const upload = multer({ dest: 'uploads/' });

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Ganesh100@#', // Replace with your actual database password
    database: 'truesight',   // Replace with your actual database name
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to database.');
});

// Password hashing function
const hashPassword = async (password) => await bcrypt.hash(password, 10);

// Function to extract specific video metadata
function extractSpecificMetadata(videoPath, callback) {
  ffmpeg.ffprobe(videoPath, (err, metadata) => {
    if (err) {
      callback(err, null);
    } else {
      // Extract the video stream
      const videoStream = metadata.streams.find((stream) => stream.codec_type === 'video');
      const format = metadata.format;

      if (videoStream) {
        // Get file size using fs.statSync
        const fileStats = fs.statSync(videoPath);
        const fileSizeInBytes = fileStats.size;
        const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);
        const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

        // Build metadata object with required fields
        const extractedMetadata = {
          fileSize: {
            bytes: fileSizeInBytes,
            kb: fileSizeInKB,
            mb: fileSizeInMB,
          },
          resolution: `${videoStream.width}x${videoStream.height}`,
          duration: `${format.duration.toFixed(2)} seconds`,
          bitrate: `${(format.bit_rate / 1000).toFixed(2)} kbps`,
          format: format.format_name,
          frameRate: `${eval(videoStream.r_frame_rate).toFixed(2)} fps`,
          height: videoStream.height,
          width: videoStream.width,
          numberOfFrames: videoStream.nb_frames || 'N/A', // Fallback if nb_frames is unavailable
        };
        callback(null, extractedMetadata);
      } else {
        callback(new Error('No video stream found'), null);
      }
    }
  });
}

// API to handle file uploads and extract metadata
app.post('/getMetadata', upload.single('video'), (req, res) => {
  const videoPath = req.file.path;

  extractSpecificMetadata(videoPath, (err, metadata) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Send the extracted metadata as a response
    res.json({ metadata });

    // Optionally, delete the uploaded file after processing
    fs.unlink(videoPath, (unlinkErr) => {
      if (unlinkErr) console.error('Failed to delete uploaded file:', unlinkErr);
    });
  });
});

// Registration endpoint
app.post("/register", async (req, res) => {
    const { name, mobile_number, email, aadhar_id, profession, create_password, confirm_password, id_no } = req.body;

    if (!name || !mobile_number || !email || !aadhar_id || !profession || !create_password || !confirm_password || !id_no) {
        return res.status(400).send("All fields are required.");
    }

    if (create_password !== confirm_password) {
        return res.status(400).send("Passwords do not match.");
    }

    try {
        const hashedPassword = await hashPassword(create_password);

        const query = `INSERT INTO registration (name, mobile_number, email, aadhar_id, profession, create_password, confirm_password, id_no)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        db.query(query, [name, mobile_number, email, aadhar_id, profession, hashedPassword, hashedPassword, id_no], (err, result) => {
            if (err) {
                console.error("Error during registration: ", err.message);
                return res.status(500).send("Registration failed. Error: " + err.message);
            }
            console.log("Registration successful: ", result);
            res.send("Registration successful!");
        });
    } catch (err) {
        console.error("Error hashing password: ", err.message);
        res.status(500).send("Error processing your request. Error: " + err.message);
    }
});

// Login endpoint
app.post("/login", async (req, res) => {
    const { mobile_number, enter_password } = req.body;

    if (!mobile_number || !enter_password) {
        return res.status(400).send("Mobile number and password are required.");
    }

    try {
        const query = `SELECT create_password FROM registration WHERE mobile_number = ?`;
        db.query(query, [mobile_number], async (err, results) => {
            if (err) {
                console.error("Database query error:", err.stack);
                return res.status(500).send("Login failed due to server error.");
            }

            if (results.length === 0) {
                return res.status(400).send("Invalid mobile number or password.");
            }

            const hashedPassword = results[0].create_password;
            const passwordMatch = await bcrypt.compare(enter_password, hashedPassword);

            if (!passwordMatch) {
                return res.status(400).send("Invalid mobile number or password.");
            }

            res.send("Login successful!");
        });
    } catch (err) {
        console.error("Error during login process:", err);
        res.status(500).send("An unexpected error occurred.");
    }
});

// Serve registration page
app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "register.html"));
});

// Serve login page
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
