const { Notification, Car, Brand, Model } = require('../models');
const { AppError } = require('../utils/errorHandler');

exports.getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Car,
          as: 'car',
          attributes: ['id', 'year', 'price', 'brand_id', 'model_id'],
          include: [
            { model: Brand, as: 'brand', attributes: ['name'] },
            { model: Model, as: 'carModel', attributes: ['name'] }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const unreadCount = await Notification.count({
      where: {
        user_id: req.user.id,
        is_read: false
      }
    });

    res.status(200).json({
      success: true,
      data: notifications,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        unreadCount
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    notification.is_read = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.update(
      { is_read: true },
      {
        where: {
          user_id: req.user.id,
          is_read: false
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
};
