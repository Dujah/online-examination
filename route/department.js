const express = require('express');
const router = express.Router();
const departmentController = require('../controller/departmentController.js');
const { protect, restrictTo } = require('../middleware/auth.js');

router.get('/', departmentController.getAllDepartments);
router.get('/:id', departmentController.getDepartmentById);
router.post('/', protect, restrictTo('ADMIN'), departmentController.createDepartment);
router.put('/:id', protect, restrictTo('ADMIN'), departmentController.updateDepartment);
router.delete('/:id', protect, restrictTo('ADMIN'), departmentController.deleteDepartment);

module.exports = router;