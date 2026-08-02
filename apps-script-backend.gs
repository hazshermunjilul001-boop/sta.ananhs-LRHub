/**
 * SANHS Learning Resource Hub — Upload Portal backend.
 *
 * WHAT THIS DOES
 * Receives submissions from upload.html and appends them as a new row
 * in a Google Sheet, so the STWG can review and approve them before
 * adding the resource to the site. No server, no database — just a
 * Sheet and this script, both inside your existing Google account.
 *
 * SETUP (one-time, ~5 minutes)
 * 1. Create a new Google Sheet. Rename the first tab "Submissions".
 *    In row 1, add these headers across columns A–G:
 *    Timestamp | Submitted By | Title | Subject | Grade | Category | Drive Link | Status
 * 2. In the Sheet, go to Extensions > Apps Script.
 * 3. Delete the placeholder code and paste this entire file in.
 * 4. Click Deploy > New deployment > select type "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    (This only lets people POST a submission — it does not expose your Sheet.)
 * 5. Click Deploy, authorize the permissions Google asks for.
 * 6. Copy the Web app URL it gives you.
 * 7. Paste that URL into upload.html as the value of SUBMIT_ENDPOINT.
 *
 * REVIEWING SUBMISSIONS
 * New rows land in the Sheet with Status = "Pending". The STWG reviews,
 * changes Status to "Approved" or "Rejected", and — once approved —
 * manually adds the resource to the relevant HTML page and re-runs
 * extract_resources.py so it shows up in search.html. (Auto-publishing
 * straight to the live site is intentionally left out — a human check
 * before anything goes live to students is worth keeping.)
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Submissions");

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.submittedBy || "",
      data.title || "",
      data.subject || "",
      data.grade || "",
      data.category || "",
      data.link || "",
      "Pending"
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
