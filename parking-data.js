// ============================================================
//  PARKING VIOLATION DETECTION SYSTEM — DATA LAYER v3.0
//  Galgotias University Campus — GPS-Based Zone Detection
//  parking-data.js — loaded by parking.html
// ============================================================

'use strict';

// ============================================================
//  CAMPUS PARKING ZONES — Galgotias University, Greater Noida
//  GPS coordinates with radius-based geofencing
// ============================================================
const CAMPUS_ZONES = [
    {
        id:          'Z1',
        name:        'Zone 1 — Faculty Only',
        description: 'Reserved exclusively for Faculty vehicles',
        lat:         28.4610,
        lng:         77.4938,
        radius:      120,         // meters
        color:       '#8b5cf6',  // purple
        icon:        'fa-chalkboard-user',
        allowedUserTypes:    ['FACULTY'],
        allowedVehicleTypes: ['CAR', 'BIKE'],
        fine: 500
    },
    {
        id:          'Z2',
        name:        'Zone 2 — Faculty & Students',
        description: 'Shared parking for Faculty and Students',
        lat:         28.4598,
        lng:         77.4955,
        radius:      180,
        color:       '#3b82f6',  // blue
        icon:        'fa-users',
        allowedUserTypes:    ['FACULTY', 'STUDENT'],
        allowedVehicleTypes: ['CAR', 'BIKE'],
        fine: 300
    },
    {
        id:          'Z3',
        name:        'Zone 3 — Students & Visitors',
        description: 'Open to Students and registered Visitors',
        lat:         28.4585,
        lng:         77.4945,
        radius:      200,
        color:       '#10b981',  // green
        icon:        'fa-graduation-cap',
        allowedUserTypes:    ['STUDENT', 'VISITOR'],
        allowedVehicleTypes: ['CAR', 'BIKE'],
        fine: 200
    },
    {
        id:          'Z4',
        name:        'Zone 4 — Bike Parking Only',
        description: 'Exclusively for two-wheelers / bikes',
        lat:         28.4620,
        lng:         77.4960,
        radius:      100,
        color:       '#f59e0b',  // amber
        icon:        'fa-motorcycle',
        allowedUserTypes:    ['FACULTY', 'STUDENT', 'VISITOR'],
        allowedVehicleTypes: ['BIKE'],
        fine: 200
    }
];

// ============================================================
//  DEFAULT VEHICLE DATABASE — Galgotias University Vehicles
//  These are the built-in demo records. Add real vehicles via Admin panel.
// ============================================================
const DEFAULT_PARKING_DB = [
    {
        vehicle_number:  'UP14AA0001',
        owner_name:      'Dr. Rajesh Sharma',
        phone_number:    '919876543210',
        user_type:       'FACULTY',
        vehicle_type:    'CAR',
        assigned_zone:   'Z1',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    480,
        fine_amount:     500
    },
    {
        vehicle_number:  'UP14BB2345',
        owner_name:      'Prof. Meena Gupta',
        phone_number:    '919812345678',
        user_type:       'FACULTY',
        vehicle_type:    'BIKE',
        assigned_zone:   'Z1',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    480,
        fine_amount:     500
    },
    {
        vehicle_number:  'UP14CC3456',
        owner_name:      'Arjun Singh',
        phone_number:    '919800001111',
        user_type:       'STUDENT',
        vehicle_type:    'BIKE',
        assigned_zone:   'Z3',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    360,
        fine_amount:     300
    },
    {
        vehicle_number:  'UP14DD4567',
        owner_name:      'Priya Verma',
        phone_number:    '919900002222',
        user_type:       'STUDENT',
        vehicle_type:    'BIKE',
        assigned_zone:   'Z4',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    360,
        fine_amount:     200
    },
    {
        vehicle_number:  'DL01AB5678',
        owner_name:      'Rahul Khanna',
        phone_number:    '919711003333',
        user_type:       'STUDENT',
        vehicle_type:    'CAR',
        assigned_zone:   'Z2',
        payment_status:  'UNPAID',
        entry_time:      null,
        allowed_time:    240,
        fine_amount:     500
    },
    {
        vehicle_number:  'UP15EE6789',
        owner_name:      'Sunil Rathi (Visitor)',
        phone_number:    '919811004444',
        user_type:       'VISITOR',
        vehicle_type:    'CAR',
        assigned_zone:   'Z3',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    120,
        fine_amount:     300
    },
    {
        vehicle_number:  'HR26EE7890',
        owner_name:      'Dr. Neha Agarwal',
        phone_number:    '919899005555',
        user_type:       'FACULTY',
        vehicle_type:    'CAR',
        assigned_zone:   'Z2',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    480,
        fine_amount:     500
    },
    {
        vehicle_number:  'UP14FF8901',
        owner_name:      'Ankit Tomar',
        phone_number:    '919712006666',
        user_type:       'STUDENT',
        vehicle_type:    'BIKE',
        assigned_zone:   'Z4',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    360,
        fine_amount:     200
    },
    {
        vehicle_number:  'GJ01XX9999',
        owner_name:      'Vijay Patel (Visitor)',
        phone_number:    '919700007777',
        user_type:       'VISITOR',
        vehicle_type:    'CAR',
        assigned_zone:   'Z3',
        payment_status:  'UNPAID',
        entry_time:      null,
        allowed_time:    60,
        fine_amount:     500
    },
    {
        vehicle_number:  'UP14GG1122',
        owner_name:      'Kavya Reddy',
        phone_number:    '919988008888',
        user_type:       'STUDENT',
        vehicle_type:    'CAR',
        assigned_zone:   'Z2',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    300,
        fine_amount:     300
    },
    // ---- Additional registered vehicles ----
    {
        vehicle_number:  'RJ14CV0002',
        owner_name:      'Ramesh Kumar',
        phone_number:    '919876501234',
        user_type:       'STUDENT',
        vehicle_type:    'CAR',
        assigned_zone:   'Z3',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    360,
        fine_amount:     300
    },
    {
        vehicle_number:  'RJ14CV0001',
        owner_name:      'Suresh Choudhary',
        phone_number:    '919871234567',
        user_type:       'STUDENT',
        vehicle_type:    'CAR',
        assigned_zone:   'Z3',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    360,
        fine_amount:     300
    },
    {
        vehicle_number:  'UP81BT3344',
        owner_name:      'Dr. Amit Saxena',
        phone_number:    '919823456789',
        user_type:       'FACULTY',
        vehicle_type:    'CAR',
        assigned_zone:   'Z1',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    480,
        fine_amount:     500
    },
    {
        vehicle_number:  'UP81AU5566',
        owner_name:      'Sneha Yadav',
        phone_number:    '919934567890',
        user_type:       'STUDENT',
        vehicle_type:    'BIKE',
        assigned_zone:   'Z4',
        payment_status:  'UNPAID',
        entry_time:      null,
        allowed_time:    360,
        fine_amount:     200
    },
    {
        vehicle_number:  'HR51AB1234',
        owner_name:      'Deepak Nair (Visitor)',
        phone_number:    '919845678901',
        user_type:       'VISITOR',
        vehicle_type:    'CAR',
        assigned_zone:   'Z3',
        payment_status:  'PAID',
        entry_time:      null,
        allowed_time:    120,
        fine_amount:     300
    }
];

// ============================================================
//  CRUD — PARKING DATABASE
// ============================================================
function getParkingDB() {
    try {
        const raw = localStorage.getItem('PARKING_DB_V3');
        if (raw) {
            const parsed = JSON.parse(raw);
            // FIX: If stored array is empty, reseed from defaults
            // (happens after admin deletes all, or app data clear)
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) { /* corrupted JSON — fall through to reseed */ }
    // Seed from built-in defaults (always available in APK)
    saveParkingDB(DEFAULT_PARKING_DB);
    return DEFAULT_PARKING_DB.map(r => ({ ...r }));
}

function saveParkingDB(records) {
    localStorage.setItem('PARKING_DB_V3', JSON.stringify(records));
}

// Reset localStorage back to the built-in DEFAULT_PARKING_DB
function resetParkingDB() {
    localStorage.removeItem('PARKING_DB_V3');
    return getParkingDB(); // triggers reseed from DEFAULT_PARKING_DB
}

// FIX: normalizePlate — only substitute genuinely ambiguous OCR chars
// DO NOT replace S/B/G/L — they are valid and common in Indian plates
// Only O→0 and I→1 are true OCR ambiguities for digit/letter confusion
function normalizePlate(text) {
    if (!text) return '';
    return text.toUpperCase()
        .replace(/O/g, '0')   // letter O → digit 0 (OCR ambiguity)
        .replace(/[^A-Z0-9]/g, ''); // strip spaces, dashes, special chars
}

function findParkingRecord(plateNumber) {
    const norm = normalizePlate(plateNumber);
    const db = getParkingDB();
    return db.find(r => normalizePlate(r.vehicle_number) === norm) || null;
}

function saveParkingRecord(record) {
    const db = getParkingDB();
    const idx = db.findIndex(r => normalizePlate(r.vehicle_number) === normalizePlate(record.vehicle_number));
    if (idx !== -1) {
        db[idx] = record;
    } else {
        db.push(record);
    }
    saveParkingDB(db);
}

function deleteParkingRecord(plateNumber) {
    const norm = normalizePlate(plateNumber);
    const db = getParkingDB().filter(r => normalizePlate(r.vehicle_number) !== norm);
    saveParkingDB(db);
}

// ============================================================
//  GPS — HAVERSINE DISTANCE + ZONE DETECTION
// ============================================================
function gpsDistance(lat1, lng1, lat2, lng2) {
    const R    = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2 +
                 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                 Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Returns the closest CAMPUS_ZONES entry whose radius contains (lat, lng),
 * or null if outside all zones.
 */
function detectGPSZone(lat, lng) {
    let best    = null;
    let minDist = Infinity;
    for (const zone of CAMPUS_ZONES) {
        const dist = gpsDistance(lat, lng, zone.lat, zone.lng);
        if (dist <= zone.radius && dist < minDist) {
            minDist = dist;
            best    = zone;
        }
    }
    return best;
}

// ============================================================
//  ZONE PERMISSION LOGIC
// ============================================================
/**
 * Checks if a vehicle record is allowed in a detected GPS zone.
 * @param {object} record   — DB record (user_type, vehicle_type, assigned_zone)
 * @param {object} gpsZone  — detected CAMPUS_ZONES entry (can be null)
 * @returns {object} { isViolation, reasons[], reason_labels[], fine }
 */
function checkZonePermission(record, gpsZone) {
    const violations = [];
    let fine = 0;

    if (!record) {
        return {
            isViolation:   true,
            reasons:       ['NOT_REGISTERED'],
            reason_labels: ['Vehicle not registered in campus system'],
            fine:          1000
        };
    }

    if (!gpsZone) {
        // No GPS zone data — skip zone check, rely on assigned_zone
        return { isViolation: false, reasons: [], reason_labels: [], fine: 0 };
    }

    const userType    = record.user_type    || 'UNKNOWN';
    const vehicleType = record.vehicle_type || 'CAR';

    // Rule 1: Vehicle type not allowed in zone (e.g. CAR in Bike Zone)
    if (!gpsZone.allowedVehicleTypes.includes(vehicleType)) {
        violations.push('WRONG_VEHICLE_TYPE');
        fine = Math.max(fine, gpsZone.fine);
    }

    // Rule 2: User type not allowed in zone (e.g. STUDENT in Faculty Zone)
    if (!gpsZone.allowedUserTypes.includes(userType)) {
        violations.push('UNAUTHORIZED_USER');
        fine = Math.max(fine, gpsZone.fine);
    }

    const labelMap = {
        WRONG_VEHICLE_TYPE: `${vehicleType} not allowed in ${gpsZone.name}`,
        UNAUTHORIZED_USER:  `${userType} is not authorized for ${gpsZone.name}`
    };

    return {
        isViolation:   violations.length > 0,
        reasons:       violations,
        reason_labels: violations.map(v => labelMap[v] || v),
        fine
    };
}

// ============================================================
//  LEGACY VIOLATION LOGIC (time-exceeded / unpaid / no-parking)
// ============================================================
function checkParkingViolation(record, currentTimeMs, gpsZone) {
    const now        = currentTimeMs || Date.now();
    const violations = [];
    let fine         = 0;

    if (!record) {
        return {
            isViolation:      true,
            reasons:          ['NOT_REGISTERED'],
            reason_labels:    ['Vehicle not registered in campus system'],
            remainingMinutes: 0,
            fine:             1000
        };
    }

    // --- Zone-permission check (GPS-based) ---
    const zoneResult = checkZonePermission(record, gpsZone);
    if (zoneResult.isViolation) {
        violations.push(...zoneResult.reasons);
        fine = Math.max(fine, zoneResult.fine);
    }

    // --- Time Exceeded ---
    let remainingMinutes = 0;
    if (record.entry_time) {
        const elapsedMs  = now - new Date(record.entry_time).getTime();
        const elapsedMin = Math.floor(elapsedMs / 60000);
        remainingMinutes = record.allowed_time - elapsedMin;
        if (remainingMinutes < 0) {
            violations.push('TIME_EXCEEDED');
            fine = Math.max(fine, record.fine_amount || 500);
        }
    }

    // --- Unpaid ---
    if (record.payment_status === 'UNPAID') {
        violations.push('UNPAID');
        fine = Math.max(fine, record.fine_amount || 500);
    }

    const labelMap = {
        NOT_REGISTERED:    'Vehicle Not Registered in Campus',
        WRONG_VEHICLE_TYPE:`${record.vehicle_type || 'Vehicle'} not allowed in detected zone`,
        UNAUTHORIZED_USER: `${record.user_type || 'User'} unauthorized for detected zone`,
        TIME_EXCEEDED:     'Parking Time Limit Exceeded',
        UNPAID:            'Parking Fee Unpaid'
    };

    return {
        isViolation:      violations.length > 0,
        reasons:          violations,
        reason_labels:    violations.map(v => labelMap[v] || v),
        remainingMinutes: Math.max(0, remainingMinutes),
        fine:             violations.length > 0 ? fine : 0
    };
}

// ============================================================
//  VIOLATION HISTORY
// ============================================================
function getParkingHistory() {
    try {
        return JSON.parse(localStorage.getItem('PARKING_HISTORY')) || [];
    } catch (e) { return []; }
}

function addParkingHistory(entry) {
    let history = getParkingHistory();
    history.unshift(entry);
    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem('PARKING_HISTORY', JSON.stringify(history));
}

// ============================================================
//  GUARD CAPTURE STORAGE
// ============================================================
function getGuardCaptures() {
    try {
        return JSON.parse(localStorage.getItem('GUARD_CAPTURES')) || [];
    } catch (e) { return []; }
}

function saveGuardCapture(capture) {
    let captures = getGuardCaptures();
    captures.unshift(capture);
    if (captures.length > 30) captures = captures.slice(0, 30);
    localStorage.setItem('GUARD_CAPTURES', JSON.stringify(captures));
}

function deleteGuardCapture(id) {
    const captures = getGuardCaptures().filter(c => c.id !== id);
    localStorage.setItem('GUARD_CAPTURES', JSON.stringify(captures));
}

// ============================================================
//  GUARD ACCOUNT SYSTEM
// ============================================================
const DEFAULT_GUARD_ACCOUNTS = [
    { id:'G001', name:'Ramesh Kumar',  badge:'SEC-01', role:'GUARD',   password:'guard001', active:true, created:new Date('2026-01-01').toISOString() },
    { id:'G002', name:'Sunil Verma',   badge:'SEC-02', role:'GUARD',   password:'guard002', active:true, created:new Date('2026-01-01').toISOString() },
    { id:'G003', name:'Ajay Yadav',    badge:'SEC-03', role:'GUARD',   password:'guard003', active:true, created:new Date('2026-01-15').toISOString() },
    { id:'G004', name:'Pradeep Singh', badge:'SEC-04', role:'GUARD',   password:'guard004', active:true, created:new Date('2026-02-01').toISOString() },
    // Students and Faculty accounts are created by Admin — no pre-seeded data
];

function getGuardAccounts() {
    try {
        const raw = localStorage.getItem('GUARD_ACCOUNTS');
        if (raw) return JSON.parse(raw);
    } catch(e) {}
    localStorage.setItem('GUARD_ACCOUNTS', JSON.stringify(DEFAULT_GUARD_ACCOUNTS));
    return DEFAULT_GUARD_ACCOUNTS.map(g => ({...g}));
}

function saveGuardAccounts(accounts) {
    localStorage.setItem('GUARD_ACCOUNTS', JSON.stringify(accounts));
}

function findGuard(id, password) {
    const accounts = getGuardAccounts();
    return accounts.find(g => g.id === id.trim() && g.password === password.trim() && g.active) || null;
}

function findGuardById(id) {
    return getGuardAccounts().find(g => g.id === id) || null;
}

function addGuardAccount(guard) {
    const accounts = getGuardAccounts();
    if (accounts.find(g => g.id === guard.id)) return false; // duplicate id
    accounts.push({...guard, role: guard.role || 'GUARD', created: new Date().toISOString()});
    saveGuardAccounts(accounts);
    return true;
}

function updateGuardAccount(guard) {
    const accounts = getGuardAccounts();
    const idx = accounts.findIndex(g => g.id === guard.id);
    if (idx === -1) return false;
    accounts[idx] = {...accounts[idx], ...guard};
    saveGuardAccounts(accounts);
    return true;
}

function deleteGuardAccount(id) {
    const accounts = getGuardAccounts().filter(g => g.id !== id);
    saveGuardAccounts(accounts);
}

function toggleGuardActive(id) {
    const accounts = getGuardAccounts();
    const g = accounts.find(a => a.id === id);
    if (g) { g.active = !g.active; saveGuardAccounts(accounts); }
}

// ---- Guard Login History ----
function getGuardLoginHistory() {
    try { return JSON.parse(localStorage.getItem('GUARD_LOGIN_HISTORY')) || []; }
    catch(e) { return []; }
}

function addGuardLoginEvent(entry) {
    let hist = getGuardLoginHistory();
    hist.unshift({...entry, timestamp: new Date().toISOString()});
    if (hist.length > 100) hist = hist.slice(0, 100);
    localStorage.setItem('GUARD_LOGIN_HISTORY', JSON.stringify(hist));
}

// ---- Guard Session (sessionStorage so it clears on tab close) ----
function getGuardSession() {
    try { return JSON.parse(sessionStorage.getItem('GUARD_SESSION')); }
    catch(e) { return null; }
}

function setGuardSession(guard) {
    const session = { guardId: guard.id, guardName: guard.name, guardBadge: guard.badge, guardRole: guard.role || 'GUARD', loginTime: new Date().toISOString() };
    sessionStorage.setItem('GUARD_SESSION', JSON.stringify(session));
    addGuardLoginEvent({ guardId: guard.id, guardName: guard.name, guardBadge: guard.badge, guardRole: guard.role || 'GUARD', action: 'LOGIN' });
    return session;
}

function clearGuardSession() {
    const s = getGuardSession();
    if (s) addGuardLoginEvent({ guardId: s.guardId, guardName: s.guardName, guardBadge: s.guardBadge, action: 'LOGOUT' });
    sessionStorage.removeItem('GUARD_SESSION');
}

