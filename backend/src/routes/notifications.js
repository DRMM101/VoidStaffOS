/**
 * VoidStaffOS - Notification Routes
 * API routes for system notifications.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 * Created: 24/01/2026
 *
 * PROPRIETARY AND CONFIDENTIAL
 * This software is proprietary and confidential.
 * Used and distributed under licence only.
 * Unauthorized copying, modification, distribution, or use
 * is strictly prohibited without prior written consent.
 *
 * Author: D.R.M. Manthorpe
 * Module: Core
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  checkAndNotifyOverdueSnapshots
} = require('../controllers/notificationController');

// All routes require authentication
router.use(authenticate);

// GET /api/notifications - Get user's notifications
router.get('/', getNotifications);

// GET /api/notifications/unread-count - Get unread count for badge
router.get('/unread-count', getUnreadCount);

// POST /api/notifications/check-overdue - Trigger overdue snapshot check
router.post('/check-overdue', async (req, res) => {
  try {
    await checkAndNotifyOverdueSnapshots(req.user.id);
    res.json({ message: 'Checked for overdue snapshots' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check overdue snapshots' });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', validateIdParam, markAsRead);

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', markAllAsRead);

// DELETE /api/notifications/:id - Delete/dismiss notification
router.delete('/:id', validateIdParam, deleteNotification);

module.exports = router;
