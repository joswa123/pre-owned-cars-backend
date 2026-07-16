const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { AppError } = require("../utils/errorHandler");

const uploadPath = path.join(__dirname, "../../uploads/dealer");

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, uploadPath);
    },
    filename(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {

    const allowed = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp"
    ];

    if (!allowed.includes(file.mimetype)) {
        return cb(new AppError("Only image files allowed.",400));
    }

    cb(null,true);
};

const upload = multer({
    storage,
    fileFilter,
    limits:{
        fileSize: 5 * 1024 * 1024
    }
});

const uploadDealerLogo = upload.single("company_logo");

module.exports = { uploadDealerLogo };
