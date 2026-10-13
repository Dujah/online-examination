const express = require('express');
const router = express.Router();
const questionController = require('../controller/questionController');
const { protect, restrictTo } = require('../middleware/auth.js');

// Staff only: questions include the correct MCQ options
router.get('/', protect, restrictTo('TEACHER', 'ADMIN'), questionController.getAllQuestions);
router.get('/:id', protect, restrictTo('TEACHER', 'ADMIN'), questionController.getQuestionById);
router.post('/', protect, restrictTo('TEACHER', 'ADMIN'), questionController.createQuestion);
router.put('/:id', protect, restrictTo('TEACHER', 'ADMIN'), questionController.updateQuestion);
router.delete('/:id', protect, restrictTo('TEACHER', 'ADMIN'), questionController.deleteQuestion);

module.exports = router;
