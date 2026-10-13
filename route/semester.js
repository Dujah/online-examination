const express = require('express');
const router = express.Router();
const semstercontroller=require('../controller/semesterController.js')
const { protect, restrictTo } = require('../middleware/auth.js');
router.get('/', semstercontroller.getAllSemesters);
router.get('/:id', semstercontroller.getSemesterById);
router.post('/', protect, restrictTo('ADMIN'), semstercontroller.createSemester );
router.put('/:id', protect, restrictTo('ADMIN'), semstercontroller.updateSemester);
router.delete('/:id', protect, restrictTo('ADMIN'), semstercontroller.deleteSemester);

module.exports = router;