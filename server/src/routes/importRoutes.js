const express = require('express');
const {
  getImportHistory,
  getImportById,
  triggerImport,
  triggerBulkImport,
  getStats,
  getJobFeeds,
} = require('../controllers/importController');

const router = express.Router();

router.get('/history', getImportHistory);
router.get('/history/:id', getImportById);
router.post('/trigger', triggerImport);
router.post('/trigger-bulk', triggerBulkImport);
router.get('/stats', getStats);
router.get('/feeds', getJobFeeds);

module.exports = router;
