const express = require('express');
const router = express.Router();
const coursecontroller=require('../controller/courseController')
const { protect, restrictTo } = require('../middleware/auth.js');
router.get('/', coursecontroller.getAllCourses);
router.get('/:id', coursecontroller.getCourseById);
router.post('/', protect, restrictTo('ADMIN'), coursecontroller.createCourse);
router.put('/:id', protect, restrictTo('ADMIN'), coursecontroller.updateCourse);
router.delete('/:id', protect, restrictTo('ADMIN'), coursecontroller.deleteCourse);

module.exports = router;