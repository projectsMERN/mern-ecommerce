const express = require('express');
const { fetchUserById, updateUser, fetchAllUsers, deleteUser } = require('../controller/User');

const router = express.Router();
//  /users is already added in base path
router.get('/own', fetchUserById)
      .patch('/:id', updateUser)
      .get('/allUsers', fetchAllUsers)
      .delete('/:id', deleteUser)

exports.router = router;
