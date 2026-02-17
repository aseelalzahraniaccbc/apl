// ══════════════════════════════════════════════════════════════
// SALES PORTAL — Google Apps Script API
// 
// This script sits inside your Google Sheet and serves as a
// smart API that only returns the rows each user needs.
//
// HOW TO INSTALL:
// 1. Open your Google Sheet
// 2. Go to Extensions → Apps Script
// 3. Delete any existing code
// 4. Paste this entire script
// 5. Click Save (name it "Portal API")
// 6. Click Deploy → New deployment
// 7. Type: Web app
// 8. Execute as: Me
// 9. Who has access: Anyone
// 10. Click Deploy → Copy the URL
// 11. Paste that URL in all your HTML files as APPS_SCRIPT_URL
// ══════════════════════════════════════════════════════════════

function doGet(e) {
  try {
    var action = (e.parameter.action || '').toLowerCase();
    var role = (e.parameter.role || '').toLowerCase();
    var code = e.parameter.code || '';
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = {};
    
    // ── ACTION: login ──
    // Returns user info + their specific sales data
    if (action === 'login') {
      var usersSheet = ss.getSheetByName('Users');
      var users = sheetToArray(usersSheet);
      var user = null;
      for (var i = 0; i < users.length; i++) {
        if (String(users[i].UserID) === String(code)) {
          user = users[i];
          break;
        }
      }
      if (!user) {
        return jsonResponse({ error: 'User not found', code: code });
      }
      result.user = user;
      
      // Based on role, return only relevant data
      var userRole = (user.Role || '').toLowerCase();
      
      if (userRole === 'salesman') {
        // Get this salesman's sales record
        var smSheet = ss.getSheetByName('SalesmanSales');
        var smData = sheetToArray(smSheet);
        result.salesmanSales = smData.filter(function(r) {
          return String(r.SalesmanCode) === String(code);
        });
        // Get this salesman's master data (customers)
        var mdSheet = ss.getSheetByName('MasterData');
        var mdData = sheetToArray(mdSheet);
        result.masterData = mdData.filter(function(r) {
          return String(r.SalesmanCode) === String(code);
        });
      }
      
      else if (userRole === 'supervisor') {
        // Get salesmen assigned to this supervisor
        var smSheet = ss.getSheetByName('SalesmanSales');
        var smData = sheetToArray(smSheet);
        result.salesmanSales = smData.filter(function(r) {
          return String(r.AssignedSPV) === String(code);
        });
        // Get salesman codes for this supervisor
        var smCodes = result.salesmanSales.map(function(r) { return String(r.SalesmanCode); });
        // Get master data for those salesmen
        var mdSheet = ss.getSheetByName('MasterData');
        var mdData = sheetToArray(mdSheet);
        result.masterData = mdData.filter(function(r) {
          return smCodes.indexOf(String(r.SalesmanCode)) !== -1;
        });
      }
      
      else if (userRole === 'bsm') {
        // Get supervisors assigned to this BSM
        var supSheet = ss.getSheetByName('SUPsales');
        var supData = sheetToArray(supSheet);
        result.supSales = supData.filter(function(r) {
          return String(r.AssignedBSM) === String(code);
        });
        // Get BSM's own sales
        var bsmSheet = ss.getSheetByName('BSMsales');
        var bsmData = sheetToArray(bsmSheet);
        result.bsmSales = bsmData.filter(function(r) {
          return String(r.BSMCode) === String(code);
        });
        // Get supervisor codes under this BSM
        var spvCodes = result.supSales.map(function(r) { return String(r.SupervisorCode); });
        // Get all salesmen under those supervisors
        var smSheet = ss.getSheetByName('SalesmanSales');
        var smData = sheetToArray(smSheet);
        result.salesmanSales = smData.filter(function(r) {
          return spvCodes.indexOf(String(r.AssignedSPV)) !== -1;
        });
        // Get salesman codes
        var smCodes = result.salesmanSales.map(function(r) { return String(r.SalesmanCode); });
        // Get master data for those salesmen
        var mdSheet = ss.getSheetByName('MasterData');
        var mdData = sheetToArray(mdSheet);
        result.masterData = mdData.filter(function(r) {
          return smCodes.indexOf(String(r.SalesmanCode)) !== -1;
        });
      }
      
      else if (userRole === 'management') {
        // Management gets user list only (they manage users, not sales data)
        result.allUsers = users;
      }
      
      return jsonResponse(result);
    }
    
    // ── ACTION: getUsers ──
    // Returns all users (for login validation)
    if (action === 'getusers') {
      var usersSheet = ss.getSheetByName('Users');
      result.users = sheetToArray(usersSheet);
      return jsonResponse(result);
    }
    
    // ── ACTION: getMasterData ──
    // Returns filtered master data
    if (action === 'getmasterdata') {
      var filterType = (e.parameter.filterType || '').toLowerCase();
      var filterValue = e.parameter.filterValue || '';
      var mdSheet = ss.getSheetByName('MasterData');
      var mdData = sheetToArray(mdSheet);
      
      if (filterType === 'salesman') {
        result.masterData = mdData.filter(function(r) {
          return String(r.SalesmanCode) === String(filterValue);
        });
      } else if (filterType === 'spv') {
        // First get salesman codes for this supervisor
        var smSheet = ss.getSheetByName('SalesmanSales');
        var smData = sheetToArray(smSheet);
        var smCodes = smData.filter(function(r) {
          return String(r.AssignedSPV) === String(filterValue);
        }).map(function(r) { return String(r.SalesmanCode); });
        result.masterData = mdData.filter(function(r) {
          return smCodes.indexOf(String(r.SalesmanCode)) !== -1;
        });
      } else if (filterType === 'customer') {
        result.masterData = mdData.filter(function(r) {
          return String(r.CustomerCode) === String(filterValue);
        });
      } else {
        result.masterData = mdData; // Return all if no filter
      }
      return jsonResponse(result);
    }
    
    // ── Default: return help ──
    return jsonResponse({
      help: 'Available actions: login, getUsers, getMasterData',
      examples: [
        '?action=login&code=75241',
        '?action=getUsers',
        '?action=getMasterData&filterType=salesman&filterValue=75241'
      ]
    });
    
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ══ HELPER: Convert sheet to array of objects ══
function sheetToArray(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    var hasData = false;
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      // Convert dates to string format
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[headers[j]] = val;
      if (val !== '' && val !== null && val !== undefined) hasData = true;
    }
    if (hasData) rows.push(obj);
  }
  return rows;
}

// ══ HELPER: Return JSON response with CORS headers ══
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
