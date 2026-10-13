const path = require('path');
const express = require('express')
const cors = require('cors');
const db=require('./db/db.js')
const authRoutes = require('./route/auth');
const cookieParser = require('cookie-parser');
const departmentRoutes = require('./route/department');
const courseRoutes = require('./route/course');
const subjectRoutes = require('./route/subject');
const semesterRoutes = require('./route/semester');
const teachingAssignmentRoutes = require('./route/teachingAssignment');
const questionRoutes = require('./route/question');
const examRoutes = require('./route/exam');
const scheduleRoutes = require('./route/schedule');
const attemptRoutes = require('./route/attempt');
const resultRoutes = require('./route/result');
const { finalizeExpiredAttempts } = require('./controller/attemptController');
const userRoutes = require('./route/user');



const isProduction = process.env.NODE_ENV === 'production';

const app = express();
// The host terminates HTTPS in front of Express; trust its headers so req.secure is correct
app.set('trust proxy', 1);
app.use(express.json());
// In production Express serves the React build itself (same origin), so CORS is only needed in development.
// Only the React dev server (Vite) may call the API cross-origin, with cookies.
// A wildcard origin can't be combined with credentials, so the login cookie would be rejected.
if (!isProduction) {
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
  }));
}
app.use(cookieParser());

const PORT = process.env.PORT || 3000;


app.use('/api/auth', authRoutes)
app.use('/api/departments', departmentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/semesters', semesterRoutes);
app.use('/api/teaching-assignments', teachingAssignmentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/users', userRoutes);

// Unknown API paths get a JSON 404 instead of falling through to the React app
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app (client/dist, created by `npm run build`)
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
// React Router handles paths like /teacher/exams/5 in the browser, so a refresh must still return index.html
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err, req, res, next) => {
  // Fallback for database constraint errors a controller didn't handle itself,
  // so the client gets a readable 4xx instead of a raw MySQL message
  const dbErrors = {
    ER_DUP_ENTRY: [409, 'That record already exists'],
    ER_ROW_IS_REFERENCED_2: [409, 'This record is still in use by other records'],
    ER_NO_REFERENCED_ROW_2: [400, 'A referenced record does not exist'],
    ER_CHECK_CONSTRAINT_VIOLATED: [400, 'A value is out of the allowed range']
  };
  if (dbErrors[err.code]) {
    const [status, error] = dbErrors[err.code];
    return res.status(status).json({ error });
  }
  // The schema's triggers raise SQLSTATE 45000 with a message written for users (business rules)
  if (err.sqlState === '45000') {
    return res.status(400).json({ error: err.sqlMessage });
  }
  // Log the details server-side only; internal error messages can reveal table and column names
  console.error(err);
  res.status(500).json({ error: 'Server error' });
})



db.query('SELECT 1')
  .then(() => {
    console.log(' Connected to MySQL');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Close exam attempts whose time ran out without the student submitting
    setInterval(() => {
      finalizeExpiredAttempts().catch(err => console.error('Expired attempt sweep failed:', err.message));
    }, 60 * 1000);
  })
  .catch((err) => {
    console.error(' Failed to connect to MySQL:', err.message);
    process.exit(1); 
  });