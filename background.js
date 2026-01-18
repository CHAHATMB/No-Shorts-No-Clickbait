// background.js

console.log("Background script started.");

const PLATFORM_BONUS_MINUTES = 15; // 15 minutes per solved problem

let codingProfiles = {
  leetcodeUsername: null,
  codechefUsername: null,
  codeforcesUsername: null,
  codingBonusEnabled: false,
};

let solvedProblemsHistory = {}; // Use a map to store daily solved problems with date as key

// Load coding profiles and daily solved problems from storage
async function loadCodingSettings() {
  const result = await browser.storage.local.get([
    "leetcodeUsername",
    "codechefUsername",
    "codeforcesUsername",
    "codingBonusEnabled",
    "solvedProblemsHistory",
  ]);

  codingProfiles.leetcodeUsername = result.leetcodeUsername || null;
  codingProfiles.codechefUsername = result.codechefUsername || null;
  codingProfiles.codeforcesUsername = result.codeforcesUsername || null;
  codingProfiles.codingBonusEnabled =
    result.codingBonusEnabled !== undefined ? result.codingBonusEnabled : true;

  solvedProblemsHistory = result.solvedProblemsHistory || {};

  const today = new Date().toDateString();
  if (!solvedProblemsHistory[today]) {
    solvedProblemsHistory[today] = { leetcode: 0, codechef: 0, codeforces: 0 };
  }

  console.log("Coding settings loaded:", codingProfiles);
  console.log("Solved problems history:", solvedProblemsHistory);
}

// Function to fetch LeetCode solved problems
async function fetchLeetCodeSolved(username) {
  if (!username) return 0;
  console.log(`Fetching LeetCode problems for ${username}`);
  // LeetCode uses GraphQL. A simple public endpoint for total solved is available but might change.
  // For simplicity, we'll use a basic fetch, but a full GraphQL client would be more robust.
  try {
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query getUserProfile($username: String!) {
            allQuestionsCount {
              difficulty
              count
            }
            matchedUser(username: $username) {
              problemsSolvedBeatsStats {
                difficulty
                percentage
              }
              submitStats {
                acSubmissionNum {
                  difficulty
                  count
                  submissions
                }
              }
            }
          }
        `,
        variables: { username: username },
      }),
    });
    const data = await response.json();
    if (
      data.data.matchedUser &&
      data.data.matchedUser.submitStats.acSubmissionNum
    ) {
      const allSolved = data.data.matchedUser.submitStats.acSubmissionNum.find(
        (s) => s.difficulty === "All"
      );
      return allSolved ? allSolved.count : 0;
    }
    return 0;
  } catch (error) {
    console.error("Error fetching LeetCode data:", error);
    return 0;
  }
}

// Function to fetch CodeChef solved problems
async function fetchCodeChefSolved(username) {
  if (!username) return 0;
  console.log(`Fetching CodeChef problems for ${username}`);
  // CodeChef API is a bit more complex. This is a simplified approach.
  // A direct public endpoint for solved count per day is not readily available.
  // This would typically involve scraping or a more advanced API interaction.
  // For now, returning a placeholder.
  return 0; // Placeholder
}

// Function to fetch Codeforces solved problems
async function fetchCodeforcesSolved(username) {
  if (!username) return 0;
  console.log(`Fetching Codeforces problems for ${username}`);
  // Codeforces API: https://codeforces.com/api/user.status
  try {
    const response = await fetch(
      `https://codeforces.com/api/user.status?handle=${username}&from=1&count=1000`
    );
    const data = await response.json();
    if (data.status === "OK") {
      const today = new Date().toDateString();
      const solvedToday = new Set();
      data.result.forEach((submission) => {
        const submissionDate = new Date(
          submission.creationTimeSeconds * 1000
        ).toDateString();
        if (submission.verdict === "OK" && submissionDate === today) {
          // Uniquely identify problems by problem.contestId and problem.index
          solvedToday.add(
            `${submission.problem.contestId}-${submission.problem.index}`
          );
        }
      });
      return solvedToday.size;
    }
    return 0;
  } catch (error) {
    console.error("Error fetching Codeforces data:", error);
    return 0;
  }
}

// Main function to update solved problems
async function updateSolvedProblems() {
  await loadCodingSettings();

  if (!codingProfiles.codingBonusEnabled) {
    console.log("Coding bonus is disabled.");
    // dailySolvedProblems.leetcode = 0; // This line is no longer needed
    // dailySolvedProblems.codechef = 0; // This line is no longer needed
    // dailySolvedProblems.codeforces = 0; // This line is no longer needed
    // await browser.storage.local.set({ dailySolvedProblems }); // This line is no longer needed
    return;
  }

  const leetcodeSolved = await fetchLeetCodeSolved(
    codingProfiles.leetcodeUsername
  );
  const codeforcesSolved = await fetchCodeforcesSolved(
    codingProfiles.codeforcesUsername
  );
  // const codechefSolved = await fetchCodeChefSolved(codingProfiles.codechefUsername); // CodeChef is a placeholder for now

  const today = new Date().toDateString();

  solvedProblemsHistory[today] = solvedProblemsHistory[today] || {
    leetcode: 0,
    codechef: 0,
    codeforces: 0,
  };

  solvedProblemsHistory[today].leetcode = leetcodeSolved;
  solvedProblemsHistory[today].codeforces = codeforcesSolved;
  // solvedProblemsHistory[today].codechef = codechefSolved;

  await browser.storage.local.set({ solvedProblemsHistory });
  console.log("Updated solved problems history:", solvedProblemsHistory);

  // Send updated bonus time to content scripts
  const totalBonusMinutes =
    (solvedProblemsHistory[today].leetcode +
      solvedProblemsHistory[today].codechef +
      solvedProblemsHistory[today].codeforces) *
    PLATFORM_BONUS_MINUTES;
  browser.runtime.sendMessage({
    action: "updateBonusTime",
    bonusMinutes: totalBonusMinutes,
    dailySolvedProblems: solvedProblemsHistory[today],
  });
}

// Listen for messages from popup.js to trigger updates
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateCodingProfiles") {
    console.log("Received updateCodingProfiles message:", message);
    codingProfiles.leetcodeUsername = message.leetcodeUsername;
    codingProfiles.codechefUsername = message.codechefUsername;
    codingProfiles.codeforcesUsername = message.codeforcesUsername;
    codingProfiles.codingBonusEnabled = message.codingBonusEnabled;

    // Save immediately and then update solved problems
    browser.storage.local
      .set({
        leetcodeUsername: message.leetcodeUsername,
        codechefUsername: message.codechefUsername,
        codeforcesUsername: message.codeforcesUsername,
        codingBonusEnabled: message.codingBonusEnabled,
      })
      .then(() => {
        updateSolvedProblems();
      });
  }
  sendResponse({ status: "Profile update initiated" });
});

// Initial load and periodic update
loadCodingSettings().then(() => {
  updateSolvedProblems();
  // Update every hour for daily tracking
  setInterval(updateSolvedProblems, 60 * 60 * 1000);
});
