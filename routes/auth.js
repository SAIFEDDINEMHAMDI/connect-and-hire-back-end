const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");


router.post('/register', async (req, res) => {
    const { firstName, lastName, email, password, role } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if email exists
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error.' });

        if (results.length > 0) {
            return res.status(409).json({ message: 'Email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = {
            nom: lastName,
            prenom: firstName,
            email,
            mot_de_passe: hashedPassword,
            role, // optional, if you have a 'role' column
        };

        db.query('INSERT INTO users SET ?', user, (err, result) => {
            if (err) return res.status(500).json({ message: 'Insert failed.' });

            res.status(201).json({ message: 'User registered successfully.' });
        });
    });
});


// LOGIN route
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Check if fields are missing
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Find user by email
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error.' });

        if (results.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = results[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.mot_de_passe);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // Respond with user info (excluding password)
        res.status(200).json({
            id: user.id,
            name: `${user.prenom} ${user.nom}`,
            email: user.email,
            role: user.role,
        });
    });
});

// Add Job
router.post("/jobs", (req, res) => {
    const {
        title,
        company,
        location,
        type,
        minSalary,
        maxSalary,
        experience,
        description,
        skills,
        userId,
        remote,
    } = req.body;

    db.query(
        `INSERT INTO jobs (title, company, location, type, minSalary, maxSalary, experience, description, skills, userId, remote)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, company, location, type, minSalary, maxSalary, experience, description, skills, userId, remote],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "Job added successfully" });
        }
    );

});

// Get All Jobs for the current user
router.get("/jobs", (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: "Missing userId parameter" });
    }

    db.query("SELECT * FROM jobs WHERE userId = ?", [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Update Job
router.put("/jobs/:id", (req, res) => {
    const { id } = req.params;
    const {
        title,
        company,
        location,
        type,
        minSalary,
        maxSalary,
        experience,
        description,
        skills,
        remote,
    } = req.body;

    db.query(
        `UPDATE jobs SET title=?, company=?, location=?, type=?, minSalary=?, maxSalary=?, experience=?, description=?, skills=?, remote=? WHERE id=?`,
        [title, company, location, type, minSalary, maxSalary, experience, description, skills, remote, id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Job updated successfully" });
        }
    );
});

router.get("/jobs/all", (req, res) => {
    const { id } = req.params;

    db.query(`SELECT * FROM jobs`, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.length === 0) return res.status(404).json({ error: "Job not found" });

        res.json(result);
    });
});

router.get("/jobs/search", (req, res) => {
    const { searchQuery,location,type } = req.query;
    const title = searchQuery;
    console.log(title + " " + location + " " + type);
    let sql = "SELECT * FROM jobs WHERE 1=1";
    const params = [];

    if (title) {
        sql += " AND title LIKE ?";
        params.push(`%${title}%`);
    }

    if (location) {
        sql += " AND location LIKE ?";
        params.push(`%${location}%`);
    }

    if (type) {
        sql += " AND type = ?";
        params.push(type);
    }

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// File Upload Config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, "cv");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, uniqueName);
    },
});

const upload = multer({ storage });

// Apply to Job (upload CV)
router.post("/jobs/apply", upload.single("file"), (req, res) => {
    const { id_job, id_user } = req.body;
    const file = req.file;
    const status = false;
    const postedDate = new Date();

    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const fileId = file.filename;

    db.query(
        `INSERT INTO jobs_seekers (id_job, id_user, status, postedDate, fileId) VALUES (?, ?, ?, ?, ?)`,
        [id_job, id_user, status, postedDate, fileId],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "Application submitted successfully" });
        }
    );
});



router.get("/jobs/:id", (req, res) => {
    const { id } = req.params;

    db.query(`SELECT * FROM jobs WHERE id = ?`, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.length === 0) return res.status(404).json({ error: "Job not found" });

        res.json(result[0]); // Return the job object directly
    });
});

router.get("/jobs/:id/applicants", (req, res) => {
    const jobId = req.params.id;

    const sql = `
    SELECT js.id_user, js.status, js.postedDate, js.fileId, u.nom, u.prenom, u.email
    FROM jobs_seekers js
    JOIN users u ON js.id_user = u.id
    WHERE js.id_job = ?
  `;

    db.query(sql, [jobId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.put("/jobs/:jobId/applicants/:userId/status", (req, res) => {
    const { jobId, userId } = req.params;
    const { status } = req.body;  // expected boolean true (accepted) or false (rejected)

    if (typeof status !== "boolean") {
        return res.status(400).json({ error: "Status must be boolean." });
    }

    const sql = `UPDATE jobs_seekers SET status = ? WHERE id_job = ? AND id_user = ?`;

    db.query(sql, [status, jobId, userId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: "Application not found" });

        res.json({ message: "Status updated successfully" });
    });
});

router.get("/jobs/applicants/:fileId/download", (req, res) => {
    const fileId = req.params.fileId;
    const filePath = path.join(__dirname, "cv", fileId);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath);
});

// GET /api/users/:userId/applications
router.get("/users/:userId/applications", (req, res) => {
    const { userId } = req.params;

    const query = `
    SELECT j.title, j.company, j.location, js.status, js.postedDate, js.fileId
    FROM jobs_seekers js
    JOIN jobs j ON js.id_job = j.id
    WHERE js.id_user = ?
  `;

    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});




module.exports = router;
