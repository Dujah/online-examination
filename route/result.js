const express = require('express');
const router = express.Router();
const resultController = require('../controller/resultController');
const { protect, restrictTo } = require('../middleware/auth.js');

// Student: published results only
router.get('/mine', protect, restrictTo('STUDENT'), resultController.getMyResults);
router.get('/mine/:id', protect, restrictTo('STUDENT'), resultController.getMyResultById);

// Staff: grading and publishing
router.get('/exams/:examId', protect, restrictTo('TEACHER', 'ADMIN'), resultController.getExamResults);
router.post('/exams/:examId/publish', protect, restrictTo('TEACHER', 'ADMIN'), resultController.publishExamResults);
router.get('/attempts/:id', protect, restrictTo('TEACHER', 'ADMIN'), resultController.getAttemptForGrading);
router.put('/attempts/:id/marks', protect, restrictTo('TEACHER', 'ADMIN'), resultController.gradeAttempt);

module.exports = router;
