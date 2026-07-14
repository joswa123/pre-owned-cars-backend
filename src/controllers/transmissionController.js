const transmissionService = require('../services/transmissionService');
const { AppError } = require('../utils/errorHandler');

// --- Public GET ---
exports.getAllTransmissions = async (req, res, next) => {
    try {
        const transmissions = await transmissionService.getTransmissions();
        res.status(200).json({ success: true, data: transmissions });
    } catch (error) {
        next(error);
    }
};

exports.getTransmission = async (req, res, next) => {
    try {
        const { transmission_id } = req.params;
        const transmission = await transmissionService.getTransmission(transmission_id);
        res.status(200).json({ success: true, data: transmission });
    } catch (error) {
        next(error);
    }
};

// --- Admin only ---
exports.createTransmission = async (req, res, next) => {
    try {
        const { transmission_name, status } = req.body;
        const user_id = req.user.id; // from auth middleware

        const transmissionData = { user_id, transmission_name, status };
        const newTransmission = await transmissionService.createTransmission(transmissionData);
        res.status(200).json({ success: true, data: newTransmission });
    } catch (error) {
        next(error);
    }
};

exports.updateTransmission = async (req, res, next) => {
    try {
        const { transmission_id } = req.params;
        const { transmission_name, status } = req.body;
        const user_id = req.user.id;

        const transmissionData = { user_id, transmission_name, status };
        await transmissionService.updateTransmission(transmission_id, transmissionData);
        res.status(200).json({ success: true, message: 'Transmission updated' });
    } catch (error) {
        next(error);
    }
};

exports.deleteTransmission = async (req, res, next) => {
    try {
        const { transmission_id } = req.params;
        await transmissionService.deleteTransmission(transmission_id);
        res.status(200).json({ success: true, message: 'Transmission deleted' });
    } catch (error) {
        next(error);
    }
};

exports.updateTransmissionStatus = async (req, res, next) => {
    try {
        const { transmission_id } = req.params;
        const { status } = req.body;
        await transmissionService.updateTransmissionStatus(transmission_id, status);
        res.status(200).json({ success: true, message: 'Status updated' });
    } catch (error) {
        next(error);
    }
};