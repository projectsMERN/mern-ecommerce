const { Category } = require('../model/Category');
const { User } = require('../model/User');

exports.fetchUserById = async (req, res) => {
  const { id } = req.user;
  console.log(id)
  try {
    const user = await User.findById(id);
    res.status(200).json({id:user.id,addresses:user.addresses,email:user.email,role:user.role,verified:user.verified, jobRole:user.jobRole});
  } catch (err) {
    res.status(400).json(err);
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  console.log("Inside this method: updateUser")
  try {
    const user = await User.findByIdAndUpdate(id, req.body, { new: true });
    res.status(200).json(user);
  } catch (err) {
    res.status(400).json(err);
  }
};

exports.fetchAllUsers = async (req, res) => {
      User.find()
      .then(users=>res.json(users))
      .catch(err=>res.json(err));
};

// New
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const delUser = await User.findByIdAndDelete(id);
    res.status(200).json(delUser);
  } catch (err) {
    res.status(400).json(err);
  }
};