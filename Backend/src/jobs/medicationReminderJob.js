const MedicationSystem = require("../models/MedicationSystem");

let timer = null;

const startMedicationReminderJob = () => {
  if (timer) return;

  timer = setInterval(async () => {
    try {
      const totalMarked = await MedicationSystem.autoMarkMissed();
      if (totalMarked > 0) {
        console.log(`[medication-job] auto-marked missed: ${totalMarked}`);
      }
    } catch (error) {
      console.error("[medication-job] error:", error.message);
    }
  }, 60 * 1000);
};

module.exports = { startMedicationReminderJob };
