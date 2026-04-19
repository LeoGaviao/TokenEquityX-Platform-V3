// api/src/middleware/upload.js
// Supabase Storage upload middleware — replaces local disk storage
const multer    = require('multer');
const supabase  = require('../utils/supabase');
const path      = require('path');

// Use memory storage — files go directly to Supabase, not disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/jpg',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}. Accepted: PDF, Word, Excel, JPG, PNG`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files:    10,
  }
});

// Helper function — uploads a single file buffer to Supabase Storage
// Returns { url, path, name, size, type }
async function uploadToSupabase(file, folder = 'general', userId = 'anon') {
  const safeName  = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ts        = Date.now();
  const filePath  = `${folder}/${userId}_${ts}_${safeName}`;

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert:      false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  // Generate a signed URL valid for 1 year
  const { data: signedData, error: signedError } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 365 * 24 * 60 * 60);

  if (signedError) throw new Error(`Signed URL failed: ${signedError.message}`);

  return {
    name:         file.originalname,
    path:         filePath,
    url:          signedData.signedUrl,
    size:         file.size,
    type:         file.mimetype,
    uploadedAt:   new Date().toISOString(),
  };
}

// Helper function — generates a fresh signed URL for an existing file
async function getSignedUrl(filePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, expiresIn);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

// Helper function — deletes a file from Supabase Storage
async function deleteFromSupabase(filePath) {
  const { error } = await supabase.storage
    .from('documents')
    .remove([filePath]);

  if (error) throw new Error(`Delete failed: ${error.message}`);
  return true;
}

module.exports = upload;
module.exports.uploadToSupabase  = uploadToSupabase;
module.exports.getSignedUrl      = getSignedUrl;
module.exports.deleteFromSupabase = deleteFromSupabase;
