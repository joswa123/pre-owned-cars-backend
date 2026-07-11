const { User } = require('../models');
const { AppError } = require('../utils/errorHandler');

exports.updateProfile = async (userId, updateData) => {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('User not found.', 404);

  
  // Map frontend field names to DB column names
  const fieldMap = {
    name: 'full_name',
    company_name: 'company_name',
    license_no: 'license_no',
    gst_no: 'gst_no',
    contact_person: 'contact_person',
  };

  // Build update object
  const allowedFields = [
    'seller_type', 'full_name', 'phone', 'email', 'address',
    'city', 'state', 'pincode', 'company_name', 'license_no',
    'gst_no', 'contact_person',
  ];

  const updateObj = {};
  for (const [key, value] of Object.entries(updateData)) {
    const dbKey = fieldMap[key] || key;
    if (allowedFields.includes(dbKey) && value !== undefined && value !== null && value !== '') {
      updateObj[dbKey] = value;
    }
  }

  // If seller_type is provided, update it
  if (updateData.seller_type) {
    updateObj.seller_type = updateData.seller_type;
  }
if (user.role === 'seller' || user.role === 'company_seller') {
    updateObj.status = 'approved';
  }
  await user.update(updateObj);

  // Remove sensitive fields before returning
  const userData = user.toJSON();
  delete userData.password_hash;

  return userData;
};