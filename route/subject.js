const express = require('express');
const router = express.Router();
const subjectcontroller=require('../controller/subjectController.js')
const { protect, restrictTo } = require('../middleware/auth.js');
router.get('/', subjectcontroller.getAllSubjects);
router.get('/:id', subjectcontroller.getSubjectById);
router.post('/', protect, restrictTo('ADMIN'), subjectcontroller.createSubject );
router.put('/:id', protect, restrictTo('ADMIN'), subjectcontroller.updateSubject);
router.delete('/:id', protect, restrictTo('ADMIN'), subjectcontroller.deleteSubject);

module.exports = router;