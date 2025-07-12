// passwordIntelligenceController.js - All app logic for Password Intelligence
export default class PasswordIntelligenceController {
  constructor() {
    const $ = (id) => document.getElementById(id);

    // DOM elements
    this.passwordInput = $('passwordInput');
    this.strengthBadge = $('strengthBadge');
    this.scoreValueElem = $('scoreValue');
    this.timeFastElem = $('timeFast');
    this.timeArgonElem = $('timeArgon');
    this.weaknessListElem = $('weaknessList');
    this.suggestionListElem = $('suggestionList');
    this.timeArgonSingleElem = $('timeArgonSingle');

    // Strength badge text and color mappings for scores 0-4
    this.strengthTexts = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
    this.strengthClasses = ["bg-danger", "bg-danger", "bg-warning", "bg-info", "bg-success"];

    // Bind event
    this.passwordInput.addEventListener('input', () => this.analyzePassword());
    // Initialize default state
    this.resetOutput();

    this.isCalculating = false;
  }

  resetOutput() {
    this.scoreValueElem.innerText = "—";
    this.timeFastElem.innerText = "—";
    this.timeArgonElem.innerText = "—";
    // Reset strength badge
    this.strengthBadge.innerText = "Unknown";
    this.strengthBadge.className = "badge rounded-pill bg-secondary px-3 py-2";
    // Clear lists
    this.weaknessListElem.innerHTML = "";
    this.suggestionListElem.innerHTML = "";
  }

  analyzePassword() {
    
    if(this.isCalculating) return;
    this.isCalculating = true;

    const pwd = this.passwordInput.value;
    if (!pwd) {
      // If input is empty, clear outputs
      this.resetOutput();
      this.isCalculating = false;
      return;
    }
    const result = zxcvbn(pwd);

    const score = result.score;
    this.scoreValueElem.innerText = score.toString();
    this.strengthBadge.innerText = this.strengthTexts[score];
    this.strengthBadge.className = `badge rounded-pill ${this.strengthClasses[score]} px-3 py-2`;

    const guesses = result.guesses;  // estimated number of guesses needed
    // Scenario A: Offline fast hash (10^10 guesses/sec)
    const timeFastSec = guesses / 1e10;
    // Scenario B: Argon2id slow hashing with massive GPU cluster (~1.5e6 guesses/sec)
    const timeArgonSec = guesses / 1500000;  // 1.5 million guesses/sec

    const timeArgonSingleSec = guesses / 45000;

    // Format times to human-readable + scientific notation
    this.timeFastElem.innerText = this.formatTime(timeFastSec);
    this.timeArgonElem.innerText = this.formatTime(timeArgonSec);
    this.timeArgonSingleElem.innerText = this.formatTime(timeArgonSingleSec);

    // Generate weaknesses and suggestions lists
    this.updateFeedback(result);
    this.isCalculating = false;
  }

  // Format seconds into human-readable time plus scientific notation (seconds)
  formatTime(seconds) {
    let humanStr;
    // Determine human-friendly time unit
    if (seconds < 1) {
      humanStr = "less than 1 second";
    } else if (seconds < 60) {
      const sec = Math.round(seconds);
      humanStr = `${sec} second${sec !== 1 ? 's' : ''}`;
    } else if (seconds < 3600) {
      const min = Math.round(seconds / 60);
      humanStr = `${min} minute${min !== 1 ? 's' : ''}`;
    } else if (seconds < 86400) {
      const hrs = Math.round(seconds / 3600);
      humanStr = `${hrs} hour${hrs !== 1 ? 's' : ''}`;
    } else if (seconds < 31557600) {  // under 1 year
      const days = Math.round(seconds / 86400);
      if (days < 60) {
        humanStr = `${days} day${days !== 1 ? 's' : ''}`;
      } else {
        const months = Math.round(days / 30);
        humanStr = `${months} month${months !== 1 ? 's' : ''}`;
      }
    } else {
      const years = seconds / 31557600;
      if (years < 1e3) {
        const yrsRounded = Math.round(years);
        humanStr = `${yrsRounded} year${yrsRounded !== 1 ? 's' : ''}`;
      } else {
        // If extremely large, use scientific notation for years as well
        humanStr = `${years.toExponential(2)} years`;
      }
    }
    return humanStr;
  }

  // Update weaknesses and suggestions based on zxcvbn feedback and pattern matches
  updateFeedback(result) {
    // Clear existing lists
    this.weaknessListElem.innerHTML = "";
    this.suggestionListElem.innerHTML = "";

    const feedback = result.feedback;
    const seq = result.sequence || [];

    // Weaknesses detected (patterns)
    let weaknessesFound = 0;
    // Include zxcvbn's warning as a weakness if present
    if (feedback.warning) {
      const warnItem = document.createElement('li');
      warnItem.innerHTML = `<strong>Warning:</strong> ${feedback.warning}`;
      this.weaknessListElem.appendChild(warnItem);
      weaknessesFound++;
    }
    // Check each pattern match for weaknesses
    for (const match of seq) {
      const pattern = match.pattern;
      // Skip matches that aren't weaknesses (e.g. brute-force filler)
      if (!pattern || pattern === 'bruteforce') continue;
      let description = "";
      const token = match.token || "";
      switch (pattern) {
        case 'dictionary':
          description = `Contains a common word: “${token}”`;
          break;
        case 'spatial':
          description = `Contains a keyboard pattern: “${token}”`;
          break;
        case 'repeat':
          description = `Contains a repeated sequence: “${token}”`;
          break;
        case 'sequence':
          description = `Contains an alphabetical or numerical sequence: “${token}”`;
          break;
        case 'regex':
          // Regex matches (like recent years or common patterns)
          description = `Contains a common pattern: “${token}”`;
          break;
        case 'date':
          if (match.year) {
            // Format the date found
            const day = match.day || 0;
            const month = match.month || 0;
            const year = match.year;
            if (day && month) {
              description = `Contains a date: ${day}/${month}/${year}`;
            } else {
              description = `Contains a year: ${year}`;
            }
          } else {
            description = `Contains a date or year: “${token}”`;
          }
          break;
        default:
          // Other pattern types (e.g. 'email', 'password' etc. if any)
          description = `Contains a ${pattern}: “${token}”`;
      }
      if (description) {
        const li = document.createElement('li');
        li.innerText = description;
        this.weaknessListElem.appendChild(li);
        weaknessesFound++;
      }
    }
    // If no weaknesses found, state that explicitly
    if (weaknessesFound === 0) {
      const li = document.createElement('li');
      li.innerText = "No major weaknesses detected in the password's composition.";
      this.weaknessListElem.appendChild(li);
    }

    const suggestions = feedback.suggestions || [];
    if (suggestions.length > 0) {
      for (const suggestion of suggestions) {
        const li = document.createElement('li');
        li.innerText = suggestion;
        this.suggestionListElem.appendChild(li);
      }
    } else {
      const li = document.createElement('li');
      li.innerText = "No suggestions available.";
      this.suggestionListElem.appendChild(li);
    }
  }
}