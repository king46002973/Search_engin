// server/routes/admin.js
const express = require('express')
const router = express.Router()
const adminController = require('../controllers/adminController')
const { authenticate, adminOnly } = require('../middlewares/auth')
const { validate } = require('../utils/validator')

// 管理员仪表盘数据
router.get('/dashboard', 
  authenticate, 
  adminOnly,
  adminController.getDashboardStats
)

// 用户管理
router.get('/users',
  authenticate,
  adminOnly,
  validate('listUsers'),
  adminController.listUsers
)

router.put('/users/:userId/status',
  authenticate,
  adminOnly,
  validate('updateUserStatus'),
  adminController.updateUserStatus
)

router.delete('/users/:userId',
  authenticate,
  adminOnly,
  validate('deleteUser'),
  adminController.deleteUser
)

// 企业管理
router.get('/enterprises/pending',
  authenticate,
  adminOnly,
  validate('listPendingEnterprises'),
  adminController.listPendingEnterprises
)

router.post('/enterprises/:enterpriseId/review',
  authenticate,
  adminOnly,
  validate('reviewEnterprise'),
  adminController.reviewEnterprise
)

router.put('/enterprises/:enterpriseId/status',
  authenticate,
  adminOnly,
  validate('updateEnterpriseStatus'),
  adminController.updateEnterpriseStatus
)

// 网站管理
router.get('/websites/unverified',
  authenticate,
  adminOnly,
  validate('listUnverifiedWebsites'),
  adminController.listUnverifiedWebsites
)

router.post('/websites/:websiteId/verify',
  authenticate,
  adminOnly,
  validate('verifyWebsite'),
  adminController.verifyWebsite
)

router.delete('/websites/:websiteId',
  authenticate,
  adminOnly,
  validate('deleteWebsite'),
  adminController.deleteWebsite
)

// 系统设置
router.get('/settings',
  authenticate,
  adminOnly,
  adminController.getSystemSettings
)

router.put('/settings',
  authenticate,
  adminOnly,
  validate('updateSystemSettings'),
  adminController.updateSystemSettings
)

// 管理员操作日志
router.get('/logs',
  authenticate,
  adminOnly,
  validate('listAdminLogs'),
  adminController.listAdminLogs
)

// 批量操作
router.post('/batch/users/delete',
  authenticate,
  adminOnly,
  validate('batchDeleteUsers'),
  adminController.batchDeleteUsers
)

router.post('/batch/enterprises/approve',
  authenticate,
  adminOnly,
  validate('batchApproveEnterprises'),
  adminController.batchApproveEnterprises
)

module.exports = router