/**
 * VoidStaffOS - Recruitment Test Data Generator
 * Generates test data for recruitment and onboarding.
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

require('dotenv').config();
const pool = require('../src/config/database');

// Test data configuration
const RECRUITMENT_REQUESTS = [
  {
    role_title: 'Software Developer',
    role_tier: 4,
    department: 'Technology',
    role_description: 'Full-stack developer to join our product team. Experience with React and Node.js required.',
    justification: 'Expanding the development team to meet growing product demands. Current team is at capacity.',
    proposed_salary_min: 45000,
    proposed_salary_max: 55000,
    proposed_hours: 'full-time',
    status: 'approved',
    requested_by_email: 'test3@test.com', // Carol Davis
    approver_email: 'admin@test.com'
  },
  {
    role_title: 'Senior Analyst',
    role_tier: 3,
    department: 'Operations',
    role_description: 'Senior analyst to lead data analysis initiatives and mentor junior team members.',
    justification: 'Critical role to strengthen our analytics capability.',
    proposed_salary_min: 55000,
    proposed_salary_max: 65000,
    proposed_hours: 'full-time',
    status: 'pending_approval',
    requested_by_email: 'test5@test.com', // Emma Wilson
    approver_email: 'admin@test.com'
  },
  {
    role_title: 'Care Assistant',
    role_tier: 5,
    department: 'Care Services',
    role_description: 'Providing direct care and support to service users in residential settings.',
    justification: 'Replacing staff member who has retired. Essential frontline role.',
    proposed_salary_min: 22000,
    proposed_salary_max: 25000,
    proposed_hours: 'full-time',
    status: 'approved',
    requested_by_email: 'manager2@test.com', // Frank Martinez
    approver_email: 'admin@test.com'
  },
  {
    role_title: 'Team Lead',
    role_tier: 3,
    department: 'Technology',
    role_description: 'Technical team lead to manage a squad of 5 developers.',
    justification: 'Need experienced leadership for the new mobile team.',
    proposed_salary_min: 60000,
    proposed_salary_max: 70000,
    proposed_hours: 'full-time',
    status: 'rejected',
    rejection_reason: 'Budget constraints - resubmit in Q2 when budget is confirmed.',
    requested_by_email: 'test3@test.com', // Carol Davis
    approver_email: 'admin@test.com'
  },
  {
    role_title: 'Admin Support',
    role_tier: 5,
    department: 'Administration',
    role_description: 'General administrative support for the head office team.',
    justification: 'Additional support needed to handle increased workload.',
    proposed_salary_min: 24000,
    proposed_salary_max: 28000,
    proposed_hours: 'full-time',
    status: 'draft',
    requested_by_email: 'test5@test.com', // Emma Wilson
    approver_email: null
  }
];

const CANDIDATES = [
  // Software Developer candidates
  {
    full_name: 'Sarah Mitchell',
    email: 'sarah.mitchell@email.com',
    phone: '07700 900123',
    address_line1: '45 Oak Avenue',
    city: 'Manchester',
    postcode: 'M1 2AB',
    dob: '1992-03-15',
    skills_experience: '5 years React/Node.js experience. Previously at TechCorp. Strong problem solver.',
    recruitment_stage: 'final_shortlist',
    request_title: 'Software Developer',
    proposed_tier: 4,
    proposed_salary: 52000
  },
  {
    full_name: 'James Cooper',
    email: 'james.cooper@email.com',
    phone: '07700 900456',
    address_line1: '12 High Street',
    city: 'Leeds',
    postcode: 'LS1 4BT',
    dob: '1988-07-22',
    skills_experience: '7 years full-stack development. Led team of 3 at previous company.',
    recruitment_stage: 'offer_made',
    request_title: 'Software Developer',
    proposed_tier: 4,
    proposed_salary: 54000,
    offer_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    offer_expiry_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
    offer_salary: 54000,
    offer_start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  },
  {
    full_name: 'Emily Watson',
    email: 'emily.watson@email.com',
    phone: '07700 900789',
    address_line1: '78 Mill Lane',
    city: 'Birmingham',
    postcode: 'B2 5XY',
    dob: '1995-11-08',
    skills_experience: '2 years experience. Bootcamp graduate. Eager to learn.',
    recruitment_stage: 'rejected',
    rejection_reason: 'Did not meet technical requirements in first interview. Score 4/10.',
    request_title: 'Software Developer',
    proposed_tier: 4,
    proposed_salary: 45000
  },
  // Care Assistant candidates
  {
    full_name: 'Mohammed Khan',
    email: 'mohammed.khan@email.com',
    phone: '07700 900111',
    address_line1: '23 Park Road',
    city: 'Bradford',
    postcode: 'BD1 3PQ',
    dob: '1990-05-20',
    skills_experience: '4 years care experience in residential settings. NVQ Level 3 in Health & Social Care.',
    recruitment_stage: 'offer_accepted',
    stage: 'pre_colleague',
    request_title: 'Care Assistant',
    proposed_tier: 5,
    proposed_salary: 24000,
    proposed_start_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
    offer_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    offer_salary: 24000,
    offer_start_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  },
  {
    full_name: 'Lisa Thompson',
    email: 'lisa.thompson@email.com',
    phone: '07700 900222',
    address_line1: '56 Church Street',
    city: 'Sheffield',
    postcode: 'S1 2GH',
    dob: '1985-09-12',
    skills_experience: '6 years experience in domiciliary care. First aid certified.',
    recruitment_stage: 'interview_scheduled',
    request_title: 'Care Assistant',
    proposed_tier: 5,
    proposed_salary: 23500
  },
  {
    full_name: 'David Chen',
    email: 'david.chen@email.com',
    phone: '07700 900333',
    address_line1: '89 Station Road',
    city: 'Nottingham',
    postcode: 'NG1 5FD',
    dob: '1993-02-28',
    skills_experience: '2 years healthcare assistant experience. Compassionate and reliable.',
    recruitment_stage: 'shortlisted',
    request_title: 'Care Assistant',
    proposed_tier: 5,
    proposed_salary: 23000
  },
  // Senior Analyst candidate
  {
    full_name: 'Rachel Green',
    email: 'rachel.green@email.com',
    phone: '07700 900444',
    address_line1: '34 Victoria Street',
    city: 'Liverpool',
    postcode: 'L1 6BN',
    dob: '1987-12-03',
    skills_experience: '8 years data analysis experience. Expert in SQL and Python. MBA qualified.',
    recruitment_stage: 'application',
    request_title: 'Senior Analyst',
    proposed_tier: 3,
    proposed_salary: 58000
  },
  // Speculative candidate (no request)
  {
    full_name: 'Tom Wilson',
    email: 'tom.wilson@email.com',
    phone: '07700 900555',
    address_line1: '67 Queens Road',
    city: 'Bristol',
    postcode: 'BS1 4JK',
    dob: '1991-08-17',
    skills_experience: 'Speculative application. Marketing background looking to transition into operations.',
    recruitment_stage: 'application',
    request_title: null,
    proposed_tier: null,
    proposed_salary: null
  }
];

const INTERVIEWS = [
  // Sarah Mitchell interviews
  { candidate_email: 'sarah.mitchell@email.com', type: 'phone_screen', days_ago: 14, status: 'completed', score: 7, notes: 'Good communication skills. Technical knowledge solid. Recommended for next stage.', recommend: true },
  { candidate_email: 'sarah.mitchell@email.com', type: 'first_interview', days_ago: 7, status: 'completed', score: 9, notes: 'Excellent technical interview. Strong problem-solving. Cultural fit is great.', recommend: true },
  // James Cooper interviews
  { candidate_email: 'james.cooper@email.com', type: 'phone_screen', days_ago: 21, status: 'completed', score: 8, notes: 'Experienced candidate. Clear communicator. Strong background.', recommend: true },
  { candidate_email: 'james.cooper@email.com', type: 'first_interview', days_ago: 14, status: 'completed', score: 8, notes: 'Technical skills match requirements. Good leadership potential.', recommend: true },
  { candidate_email: 'james.cooper@email.com', type: 'final', days_ago: 7, status: 'completed', score: 9, notes: 'Final panel impressed. Unanimous decision to make offer.', recommend: true },
  // Emily Watson interviews
  { candidate_email: 'emily.watson@email.com', type: 'phone_screen', days_ago: 10, status: 'completed', score: 6, notes: 'Enthusiastic but limited experience. Worth progressing to see technical ability.', recommend: true },
  { candidate_email: 'emily.watson@email.com', type: 'first_interview', days_ago: 5, status: 'completed', score: 4, notes: 'Struggled with technical questions. Not ready for this level. Consider for junior role.', recommend: false },
  // Lisa Thompson interviews
  { candidate_email: 'lisa.thompson@email.com', type: 'phone_screen', days_ago: 5, status: 'completed', score: 7, notes: 'Good experience. Values align well with our care approach.', recommend: true },
  { candidate_email: 'lisa.thompson@email.com', type: 'first_interview', days_from_now: 3, status: 'scheduled', score: null, notes: null, recommend: null }
];

const NOTES = [
  { candidate_email: 'sarah.mitchell@email.com', note: 'CV screening passed. Strong React portfolio.', is_private: false, days_ago: 20 },
  { candidate_email: 'sarah.mitchell@email.com', note: 'Reference check initiated - waiting on TechCorp.', is_private: true, days_ago: 5 },
  { candidate_email: 'james.cooper@email.com', note: 'Excellent phone manner. Salary expectations within range.', is_private: false, days_ago: 22 },
  { candidate_email: 'james.cooper@email.com', note: 'Background check submitted. DBS pending.', is_private: true, days_ago: 3 },
  { candidate_email: 'james.cooper@email.com', note: 'Offer letter sent via email. Awaiting response by Friday.', is_private: false, days_ago: 2 },
  { candidate_email: 'emily.watson@email.com', note: 'Promising attitude but technical skills need development.', is_private: false, days_ago: 6 },
  { candidate_email: 'mohammed.khan@email.com', note: 'All checks cleared. Ready for onboarding.', is_private: false, days_ago: 5 },
  { candidate_email: 'mohammed.khan@email.com', note: 'Confirmed start date. IT equipment ordered.', is_private: true, days_ago: 2 },
  { candidate_email: 'lisa.thompson@email.com', note: 'Phone screen went well. First aid cert verified.', is_private: false, days_ago: 4 },
  { candidate_email: 'david.chen@email.com', note: 'Passed initial screening. Schedule for phone interview next week.', is_private: false, days_ago: 3 }
];

async function generateTestData() {
  const client = await pool.connect();

  try {
    console.log('Starting test data generation...\n');

    await client.query('BEGIN');

    // Get user IDs by email
    const usersResult = await client.query('SELECT id, email FROM users');
    const usersByEmail = {};
    for (const u of usersResult.rows) {
      usersByEmail[u.email] = u.id;
    }

    // Get role IDs
    const rolesResult = await client.query('SELECT id, role_name FROM roles');
    const rolesByName = {};
    for (const r of rolesResult.rows) {
      rolesByName[r.role_name] = r.id;
    }

    // ===== RECRUITMENT REQUESTS =====
    console.log('Creating recruitment requests...');
    const requestsByTitle = {};

    for (const req of RECRUITMENT_REQUESTS) {
      const requestedById = usersByEmail[req.requested_by_email];
      const approverId = req.approver_email ? usersByEmail[req.approver_email] : null;

      // Check if already exists
      const existing = await client.query(
        'SELECT id FROM recruitment_requests WHERE role_title = $1 AND requested_by = $2',
        [req.role_title, requestedById]
      );

      if (existing.rows.length > 0) {
        requestsByTitle[req.role_title] = existing.rows[0].id;
        console.log(`  - ${req.role_title}: Already exists (ID: ${existing.rows[0].id})`);
        continue;
      }

      const result = await client.query(
        `INSERT INTO recruitment_requests
         (requested_by, approver_id, role_title, role_tier, department, role_description,
          justification, proposed_salary_min, proposed_salary_max, proposed_hours, status,
          submitted_at, approved_at, approved_by, rejection_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id`,
        [
          requestedById,
          approverId,
          req.role_title,
          req.role_tier,
          req.department,
          req.role_description,
          req.justification,
          req.proposed_salary_min,
          req.proposed_salary_max,
          req.proposed_hours,
          req.status,
          req.status !== 'draft' ? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) : null,
          req.status === 'approved' || req.status === 'rejected' ? new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) : null,
          req.status === 'approved' || req.status === 'rejected' ? approverId : null,
          req.rejection_reason || null
        ]
      );

      requestsByTitle[req.role_title] = result.rows[0].id;
      console.log(`  - ${req.role_title}: Created (ID: ${result.rows[0].id})`);
    }

    // ===== CANDIDATES =====
    console.log('\nCreating candidates...');
    const candidatesByEmail = {};

    for (const cand of CANDIDATES) {
      // Check if already exists
      const existing = await client.query(
        'SELECT id FROM candidates WHERE email = $1',
        [cand.email]
      );

      if (existing.rows.length > 0) {
        candidatesByEmail[cand.email] = existing.rows[0].id;
        console.log(`  - ${cand.full_name}: Already exists (ID: ${existing.rows[0].id})`);
        continue;
      }

      const requestId = cand.request_title ? requestsByTitle[cand.request_title] : null;
      const roleId = rolesByName['Employee'];

      const result = await client.query(
        `INSERT INTO candidates
         (full_name, email, phone, address_line1, city, postcode, dob, skills_experience,
          recruitment_stage, stage, recruitment_request_id, proposed_role_id, proposed_tier,
          proposed_salary, proposed_start_date, offer_date, offer_expiry_date, offer_salary,
          offer_start_date, rejection_reason, created_by, recruitment_stage_updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
         RETURNING id`,
        [
          cand.full_name,
          cand.email,
          cand.phone,
          cand.address_line1,
          cand.city,
          cand.postcode,
          cand.dob,
          cand.skills_experience,
          cand.recruitment_stage,
          cand.stage || 'candidate',
          requestId,
          roleId,
          cand.proposed_tier,
          cand.proposed_salary,
          cand.proposed_start_date || null,
          cand.offer_date || null,
          cand.offer_expiry_date || null,
          cand.offer_salary || null,
          cand.offer_start_date || null,
          cand.rejection_reason || null,
          usersByEmail['admin@test.com']
        ]
      );

      candidatesByEmail[cand.email] = result.rows[0].id;
      console.log(`  - ${cand.full_name}: Created (ID: ${result.rows[0].id}) - Stage: ${cand.recruitment_stage}`);
    }

    // ===== INTERVIEWS =====
    console.log('\nCreating interviews...');

    for (const int of INTERVIEWS) {
      const candidateId = candidatesByEmail[int.candidate_email];
      if (!candidateId) continue;

      // Check if already exists
      const existing = await client.query(
        'SELECT id FROM candidate_interviews WHERE candidate_id = $1 AND interview_type = $2',
        [candidateId, int.type]
      );

      if (existing.rows.length > 0) {
        console.log(`  - Interview for ${int.candidate_email} (${int.type}): Already exists`);
        continue;
      }

      const scheduledDate = int.days_ago
        ? new Date(Date.now() - int.days_ago * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + int.days_from_now * 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO candidate_interviews
         (candidate_id, interview_type, scheduled_date, scheduled_time, duration_minutes,
          location, status, score, notes, recommend_next_stage, scheduled_by, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          candidateId,
          int.type,
          scheduledDate,
          '10:00:00',
          60,
          int.type === 'phone_screen' ? 'Phone/Video Call' : 'Head Office - Meeting Room 2',
          int.status,
          int.score,
          int.notes,
          int.recommend,
          usersByEmail['admin@test.com'],
          int.status === 'completed' ? scheduledDate : null
        ]
      );

      console.log(`  - ${int.candidate_email} - ${int.type}: Created (${int.status})`);
    }

    // ===== CANDIDATE NOTES =====
    console.log('\nCreating candidate notes...');

    for (const note of NOTES) {
      const candidateId = candidatesByEmail[note.candidate_email];
      if (!candidateId) continue;

      // Check for duplicate (same candidate, same note text)
      const existing = await client.query(
        'SELECT id FROM candidate_notes WHERE candidate_id = $1 AND content = $2',
        [candidateId, note.note]
      );

      if (existing.rows.length > 0) {
        continue;
      }

      const createdAt = new Date(Date.now() - note.days_ago * 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO candidate_notes (candidate_id, content, is_private, user_id, note_type, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [candidateId, note.note, note.is_private, usersByEmail['admin@test.com'], 'general', createdAt]
      );
    }
    console.log(`  - Created ${NOTES.length} notes`);

    // ===== BACKGROUND CHECKS =====
    console.log('\nCreating background checks...');

    const backgroundChecks = [
      { email: 'mohammed.khan@email.com', dbs: 'cleared', rtw: 'cleared' },
      { email: 'james.cooper@email.com', dbs: 'submitted', rtw: 'not_started' }
    ];

    for (const bg of backgroundChecks) {
      const candidateId = candidatesByEmail[bg.email];
      if (!candidateId) continue;

      const existing = await client.query(
        'SELECT id FROM background_checks WHERE candidate_id = $1',
        [candidateId]
      );

      if (existing.rows.length > 0) {
        console.log(`  - ${bg.email}: Background checks already exist`);
        continue;
      }

      // DBS check (enhanced for care roles)
      await client.query(
        `INSERT INTO background_checks (candidate_id, check_type, status, notes, submitted_date, completed_date)
         VALUES ($1, 'dbs_enhanced', $2, $3, $4, $5)`,
        [
          candidateId,
          bg.dbs,
          bg.dbs === 'cleared' ? 'DBS check completed - no issues' : 'Awaiting DBS certificate',
          new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          bg.dbs === 'cleared' ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) : null
        ]
      );

      // Right to work
      await client.query(
        `INSERT INTO background_checks (candidate_id, check_type, status, notes, submitted_date, completed_date)
         VALUES ($1, 'right_to_work', $2, $3, $4, $5)`,
        [
          candidateId,
          bg.rtw,
          bg.rtw === 'cleared' ? 'UK passport verified' : 'Awaiting documentation',
          new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          bg.rtw === 'cleared' ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) : null
        ]
      );

      console.log(`  - ${bg.email}: DBS=${bg.dbs}, RTW=${bg.rtw}`);
    }

    // ===== REFERENCES =====
    console.log('\nCreating references...');

    const references = [
      { email: 'mohammed.khan@email.com', refs: [
        { name: 'John Smith', company: 'Care Home Ltd', status: 'verified', response: 'Excellent employee. Highly recommended.' },
        { name: 'Mary Jones', company: 'NHS Trust', status: 'verified', response: 'Mohammed was reliable and compassionate.' }
      ]},
      { email: 'james.cooper@email.com', refs: [
        { name: 'Robert Brown', company: 'TechStart Inc', status: 'verified', response: 'Strong developer, good team player.' },
        { name: 'Susan White', company: 'Digital Agency', status: 'received', response: 'Generally positive feedback received.' }
      ]},
      { email: 'sarah.mitchell@email.com', refs: [
        { name: 'Michael Taylor', company: 'TechCorp', status: 'requested', response: null },
        { name: 'Emma Davis', company: 'Startup XYZ', status: 'requested', response: null }
      ]}
    ];

    for (const ref of references) {
      const candidateId = candidatesByEmail[ref.email];
      if (!candidateId) continue;

      for (const r of ref.refs) {
        const existing = await client.query(
          'SELECT id FROM candidate_references WHERE candidate_id = $1 AND reference_name = $2',
          [candidateId, r.name]
        );

        if (existing.rows.length > 0) continue;

        await client.query(
          `INSERT INTO candidate_references
           (candidate_id, reference_name, reference_email, reference_phone, reference_company,
            relationship, status, reference_notes, received_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            candidateId,
            r.name,
            `${r.name.toLowerCase().replace(' ', '.')}@${r.company.toLowerCase().replace(/\s+/g, '')}.com`,
            '01onal 234567',
            r.company,
            'Line Manager',
            r.status,
            r.response,
            r.status !== 'requested' && r.status !== 'pending' ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : null
          ]
        );
      }
      console.log(`  - ${ref.email}: ${ref.refs.length} references`);
    }

    // ===== ONBOARDING FOR MOHAMMED KHAN =====
    console.log('\nCreating onboarding data for Mohammed Khan...');

    const mohammedId = candidatesByEmail['mohammed.khan@email.com'];
    if (mohammedId) {
      // Onboarding tasks
      const tasks = [
        { name: 'Complete Health Declaration Form', type: 'form_submit', status: 'completed', required: true },
        { name: 'Read Employee Handbook', type: 'document_read', status: 'pending', required: true },
        { name: 'Complete Bank Details Form', type: 'form_submit', status: 'pending', required: true }
      ];

      for (const task of tasks) {
        const existing = await client.query(
          'SELECT id FROM onboarding_tasks WHERE candidate_id = $1 AND task_name = $2',
          [mohammedId, task.name]
        );

        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO onboarding_tasks
             (candidate_id, task_name, task_type, status, required_before_start,
              due_date, completed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              mohammedId,
              task.name,
              task.type,
              task.status,
              task.required,
              new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
              task.status === 'completed' ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) : null
            ]
          );
        }
      }
      console.log('  - 3 onboarding tasks created');

      // Policy acknowledgments
      const policiesResult = await client.query('SELECT id FROM policies WHERE is_active = true LIMIT 2');

      for (let i = 0; i < policiesResult.rows.length; i++) {
        const policyId = policiesResult.rows[i].id;

        const existing = await client.query(
          'SELECT id FROM policy_acknowledgments WHERE candidate_id = $1 AND policy_id = $2',
          [mohammedId, policyId]
        );

        if (existing.rows.length === 0) {
          // For first policy, set acknowledged_at (completed), for second leave NULL (pending)
          if (i === 0) {
            await client.query(
              `INSERT INTO policy_acknowledgments (candidate_id, policy_id, acknowledged_at)
               VALUES ($1, $2, $3)`,
              [mohammedId, policyId, new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)]
            );
          } else {
            await client.query(
              `INSERT INTO policy_acknowledgments (candidate_id, policy_id, acknowledged_at)
               VALUES ($1, $2, NULL)`,
              [mohammedId, policyId]
            );
          }
        }
      }
      console.log('  - 2 policy acknowledgments created (1 done, 1 pending)');

      // Day one items (schedule for first day)
      const dayOneItems = [
        { time: '09:00', activity: 'Welcome and IT Setup', location: 'IT Office', meeting_with: 'IT Support' },
        { time: '10:00', activity: 'HR Orientation', location: 'Meeting Room 1', meeting_with: 'HR Manager' },
        { time: '11:30', activity: 'Team Introductions', location: 'Care Wing', meeting_with: 'Frank Martinez' },
        { time: '13:00', activity: 'Lunch with Team', location: 'Staff Canteen', meeting_with: 'Team Members' }
      ];

      for (let i = 0; i < dayOneItems.length; i++) {
        const item = dayOneItems[i];
        const existing = await client.query(
          'SELECT id FROM day_one_items WHERE candidate_id = $1 AND activity = $2',
          [mohammedId, item.activity]
        );

        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO day_one_items (candidate_id, time_slot, activity, location, meeting_with, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [mohammedId, item.time, item.activity, item.location, item.meeting_with, i]
          );
        }
      }
      console.log('  - 4 day one items created');
    }

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('Test data generation complete!');
    console.log('========================================\n');

    // Summary
    console.log('Summary:');
    console.log(`  - Recruitment Requests: ${RECRUITMENT_REQUESTS.length}`);
    console.log(`  - Candidates: ${CANDIDATES.length}`);
    console.log(`  - Interviews: ${INTERVIEWS.length}`);
    console.log(`  - Notes: ${NOTES.length}`);
    console.log(`  - Background Checks: ${backgroundChecks.length * 2}`);
    console.log(`  - References: ${references.reduce((a, r) => a + r.refs.length, 0)}`);
    console.log(`  - Onboarding Items: 9 (for Mohammed Khan)`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error generating test data:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

generateTestData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
