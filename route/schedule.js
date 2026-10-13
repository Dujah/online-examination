const express = require('express');
const router = express.Router();
const scheduleController = require('../controller/scheduleController');
const { protect, restrictTo } = require('../middleware/auth.js');

router.get('/mine', protect, restrictTo('STUDENT'), scheduleController.getMySchedules);
router.get('/', protect, restrictTo('TEACHER', 'ADMIN'), scheduleController.getAllSchedules);
router.get('/:id', protect, restrictTo('TEACHER', 'ADMIN'), scheduleController.getScheduleById);
router.post('/', protect, restrictTo('TEACHER', 'ADMIN'), scheduleController.createSchedule);
router.put('/:id', protect, restrictTo('TEACHER', 'ADMIN'), scheduleController.updateSchedule);
router.patch('/:id/cancel', protect, restrictTo('TEACHER', 'ADMIN'), scheduleController.cancelSchedule);
router.delete('/:id', protect, restrictTo('TEACHER', 'ADMIN'), scheduleController.deleteSchedule);

module.exports = router;
