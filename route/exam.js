const express = require('express');
const router = express.Router();
const examController = require('../controller/examController');
const { protect, restrictTo } = require('../middleware/auth.js');

// Exam assembly is staff-only: the detail view includes correct answers
router.use(protect, restrictTo('TEACHER', 'ADMIN'));

router.get('/', examController.getAllExams);
router.get('/:id', examController.getExamById);
router.post('/', examController.createExam);
router.put('/:id', examController.updateExam);
router.delete('/:id', examController.deleteExam);
router.put('/:id/questions', examController.setExamQuestions);
router.patch('/:id/publish', examController.publishExam);
router.patch('/:id/unpublish', examController.unpublishExam);

module.exports = router;
