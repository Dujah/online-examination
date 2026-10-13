const express = require('express');
const router = express.Router();
const taController = require('../controller/teachingAssignmentController');
const { protect, restrictTo } = require('../middleware/auth.js');

router.get('/mine', protect, restrictTo('TEACHER'), taController.getMyAssignments);
router.get('/', protect, taController.getAllAssignments);
router.get('/:id', protect, taController.getAssignmentById);
router.post('/', protect, restrictTo('ADMIN'), taController.createAssignment);
router.delete('/:id', protect, restrictTo('ADMIN'), taController.deleteAssignment);

module.exports = router;