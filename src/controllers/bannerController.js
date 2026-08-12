const bannerService = require('../services/bannerService');
const { catchAsync } = require('../utils/errorHandler');

exports.getActiveBanners = catchAsync(async (req, res) => {
  const banners = await bannerService.getActiveBanners();
  res.status(200).json({
    status: 'success',
    data: banners,
  });
});

exports.getAllBanners = catchAsync(async (req, res) => {
  const banners = await bannerService.getAllBanners();
  res.status(200).json({
    status: 'success',
    data: banners,
  });
});

exports.createBanner = catchAsync(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'Image file is required.' });
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) {
    return res.status(400).json({ status: 'error', message: 'Only JPEG, PNG, or WEBP images are allowed.' });
  }

  const imageUrl = req.file.path; // Cloudinary URL
  const banner = await bannerService.createBanner(req.body, imageUrl);

  res.status(201).json({
    status: 'success',
    data: { banner },
  });
});

exports.updateBanner = catchAsync(async (req, res) => {
  let imageUrl = null;
  if (req.file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) {
      return res.status(400).json({ status: 'error', message: 'Only JPEG, PNG, or WEBP images are allowed.' });
    }
    imageUrl = req.file.path;
  }

  try {
    const banner = await bannerService.updateBanner(req.params.id, req.body, imageUrl);
    res.status(200).json({
      status: 'success',
      data: { banner },
    });
  } catch (err) {
    if (err.message === 'Banner not found') {
      return res.status(404).json({ status: 'error', message: err.message });
    }
    throw err;
  }
});

exports.deleteBanner = catchAsync(async (req, res) => {
  try {
    await bannerService.deleteBanner(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (err) {
    if (err.message === 'Banner not found') {
      return res.status(404).json({ status: 'error', message: err.message });
    }
    throw err;
  }
});

exports.reorderBanners = catchAsync(async (req, res) => {
  try {
    await bannerService.reorderBanners(req.body.orders);
    res.status(200).json({
      status: 'success',
      message: 'Banners reordered successfully',
    });
  } catch (err) {
    if (err.message === 'Some banner IDs are invalid.') {
      return res.status(400).json({ status: 'error', message: err.message });
    }
    throw err;
  }
});
