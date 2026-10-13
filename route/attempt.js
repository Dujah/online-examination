const express = require('express');
const router = express.Router();
const attemptController = require('../controller/attemptController');
const { protect, restrictTo } = require('../middleware/auth.js');

// Exam taking is student-only. Staff-side viewing/grading of attempts belongs to the grading step.
router.use(protect, restrictTo('STUDENT'));

router.get('/', attemptController.getMyAttempts);
router.post('/', attemptController.startAttempt);
router.get('/:id', attemptController.getAttempt);
router.put('/:id/answers', attemptController.saveAnswers);
router.post('/:id/submit', attemptController.submitAttempt);

module.exports = router;
