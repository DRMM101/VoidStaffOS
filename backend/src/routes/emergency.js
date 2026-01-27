/**
 * VoidStaffOS - Emergency Routes
 * Emergency contacts and medical information endpoints.
 *
 * Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getMyEmergencyContacts,
  getEmployeeEmergencyContacts,
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  reorderEmergencyContacts,
  getMyMedicalInfo,
  getEmployeeMedicalInfo,
  saveMedicalInfo,
  getTeamEmergencyQuickView,
  getFullEmergencyData
} = require('../controllers/emergencyController');

// All routes require authentication
router.use(authenticate);

// ===========================================
// EMERGENCY CONTACTS - Employee Routes
// ===========================================

// Get my emergency contacts
router.get('/contacts', getMyEmergencyContacts);

// Create emergency contact
router.post('/contacts', createEmergencyContact);

// Update emergency contact
router.put('/contacts/:id', updateEmergencyContact);

// Delete emergency contact
router.delete('/contacts/:id', deleteEmergencyContact);

// Reorder emergency contacts (drag and drop)
router.put('/contacts/reorder', reorderEmergencyContacts);

// ===========================================
// MEDICAL INFO - Employee Routes
// ===========================================

// Get my medical info
router.get('/medical', getMyMedicalInfo);

// Save medical info (create or update)
router.put('/medical', saveMedicalInfo);

// ===========================================
// TEAM/MANAGER ROUTES (Tier 50+)
// ===========================================

// Get team emergency quick view
router.get('/team', getTeamEmergencyQuickView);

// ===========================================
// HR/ADMIN ROUTES (Tier 60+)
// ===========================================

// Get full emergency data for employee
router.get('/employee/:employeeId/full', getFullEmergencyData);

// Get employee's emergency contacts
router.get('/employee/:employeeId/contacts', getEmployeeEmergencyContacts);

// Get employee's medical info
router.get('/employee/:employeeId/medical', getEmployeeMedicalInfo);

module.exports = router;
