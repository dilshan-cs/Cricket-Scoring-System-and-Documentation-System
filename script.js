// Initial data template
const initialInningData = () => ({
  teamName: 'Team-Name',
  totalOvers: 0,
  totalRuns: 0,
  extraRuns: 0,
  wickets: 0,
  overs: 0.0,
  runRate: 0.0,
  remainingRuns: 0,
  remainingBalls: 0,
  remainingOvers: 0,
  rrr: 0.0,
  batsmen: [
    { name: 'Batsman-1-', runs: 0, balls: 0, fours: 0, sixes: 0, isStriker: true, isOut: false },
    { name: 'Batsman-2-', runs: 0, balls: 0, fours: 0, sixes: 0, isStriker: false, isOut: false }
  ],
  availableBatsmen: [],
  dismissedBatsmen: [],
  bowler: [{ name: 'Bowler-1-', overs: 0, runs: 0, wickets: 0, economy: 0, isBowler: true }],
  currentOver: [],
  pastOver: [],
  commentary: [],
  fallOfWickets: [],
  history: []
});

let inning1Data = initialInningData();
let inning2Data = initialInningData();
let currentInning = 1;
let addBatsmen = true

// Global reference that points to the data of the active inning
let matchData = inning1Data;
const syncChannel = new BroadcastChannel('cricket_scoring_sync');

// Listen for requests for current match data (e.g. from a newly opened window)
syncChannel.onmessage = (event) => {
  if (event.data.type === 'REQUEST_DATA') {
    broadcastUpdate();
  }
};

function broadcastUpdate() {
  syncChannel.postMessage({
    type: 'UPDATE_DATA',
    matchData: matchData,
    currentInning: currentInning,
    inning1Data: inning1Data,
    inning2Data: inning2Data
  });
}

function openPopOutScoreboard() {
  window.open('scoreboard.html', 'Cricket Scoreboard', 'width=1000,height=1000,scrollbars=yes');
}


let undoStack = [];
let playersStoredToastTimer = null;
function saveStateForUndo() {
  undoStack.push(JSON.parse(JSON.stringify(matchData)));

}
function handleUndo() {
  if (undoStack.length === 0) return;
  const prev = undoStack.pop();
  Object.keys(prev).forEach(k => {
    matchData[k] = prev[k];
  });
  updateDisplay();
}


function addRuns(runs) {
  saveStateForUndo();
  const striker = matchData.batsmen.find(b => b.isStriker);

  // Update striker stats
  striker.runs += runs;
  striker.balls += 1;
  if (runs === 4) striker.fours += 1;
  if (runs === 6) striker.sixes += 1;

  // Description for commentary
  let desc;
  if (runs === 0) desc = 'no run';
  else if (runs === 4) desc = 'FOUR';
  else if (runs === 6) desc = 'SIX';
  else desc = `${runs} run${runs > 1 ? 's' : ''}`;

  recordBall(runs, desc, true); // Legal ball
}


function addExtraRuns(runs) {
  // This seems to be a generic extra adder, but the UI uses addCustomExtra
  // Let's keep it simple or deprecate if unused.
  saveStateForUndo();
  matchData.totalRuns += runs;
  const bowlerIs = matchData.bowler.find(b => b.isBowler);
  bowlerIs.runs += runs;
  matchData.extraRuns += runs;
  updateDisplay();
}

function isInningDone() {
  document.getElementById('second-inning-modal').classList.add('show');
}

function recordBall(ballValue, description, isLegalBall) {
  const bowlerIs = matchData.bowler.find(bo => bo.isBowler);
  const striker = matchData.batsmen.find(b => b.isStriker);

  // Add to current over display array
  matchData.currentOver.push(ballValue);

  // Update team and bowler runs (extras usually count as bowler runs in this app's logic)
  if (typeof ballValue === 'number') {
    matchData.totalRuns += ballValue;
    bowlerIs.runs += ballValue;
  } else if (ballValue === 'w' || ballValue === 'nb' || ballValue === 'b' || ballValue === 'lb') {
    // Handled in addExtraRuns/addCustomExtra before calling recordBall if needed


  }

  if (isLegalBall) {
    matchData.overs = incrementOvers(matchData.overs);
    bowlerIs.overs = incrementOvers(bowlerIs.overs);
  }

  // Add ball-by-ball commentary entry
  const overText = matchData.overs;
  const bowlerName = bowlerIs.name || 'Bowler';
  const batsmanName = striker.name || 'Batsman';
  matchData.commentary.push(`${overText} ${bowlerName} to ${batsmanName}: ${description}. Score ${matchData.totalRuns}/${matchData.wickets}`);

  // Check for over end (6 legal balls)
  // const legalBallsInOver = matchData.currentOver.filter(b => b !== 'w' && b !== 'nb').length;
  const ov = matchData.bowler[0].overs;
  const whole = Math.floor(ov);
  const decimal = ov - whole;
  const balls = Math.round(decimal * 10);

  if (balls === 0 && whole > 0) {
    document.getElementById("add-bowler-btn").classList.add("show");
    // updateDisplay();
    // handleOverEnd();
    // swapStriker();
  }


  updateDisplay(typeof ballValue === 'number' ? ballValue : 0);
  if (matchData.overs === matchData.totalOvers) {
    if (currentInning === 1) {
      addBatsmen = false;
      document.getElementById('new-inning-modal').classList.add('show');
      swapCurrentInning();
    }
  }
  updateDisplay()
  checkWinCondition();
  if ((inning1Data.overs === inning1Data.totalOvers || inning1Data.wickets === 10) && currentInning === 1) {
    isInningDone();
  }
}

function incrementOvers(overs) {
  let whole = Math.floor(overs);
  let balls = Math.round((overs - whole) * 10);
  balls += 1;
  if (balls >= 6) {
    whole += 1;
    balls = 0;
  }
  return parseFloat(`${whole}.${balls}`);
}

function handleOverEnd() {
  // Clear current over balls
  matchData.currentOver = [];
  // Show the modal
  // onNewBowlerClick();
}

function onNewBowlerClick() {
  const list = document.getElementById('bowler-options-list');
  list.innerHTML = '';

  const allPlayers = new Set();

  // Get opposite team's data
  const fieldingTeamData = currentInning === 1 ? inning2Data : inning1Data;

  // Add all batsmen from the fielding team (because batsmen on fielding team are ALL potential bowlers)
  fieldingTeamData.batsmen.forEach(b => { if (b.name && b.name.trim() !== '' && !b.name.startsWith('Batsman-')) allPlayers.add(b.name) });
  fieldingTeamData.availableBatsmen.forEach(bName => { if (bName && bName.trim() !== '') allPlayers.add(bName) });
  fieldingTeamData.dismissedBatsmen.forEach(b => { if (b.name && b.name.trim() !== '') allPlayers.add(b.name) });

  // Add all past bowlers from the CURRENT matchData (since matchData's past bowlers belong to the fielding team)
  matchData.pastOver.forEach(boArr => {
    if (boArr[0].name && boArr[0].name.trim() !== '' && !boArr[0].name.startsWith('Bowler-')) allPlayers.add(boArr[0].name);
  });

  // Current bowler cannot bowl again immediately
  const currentBowlerName = matchData.bowler[0]?.name;
  if (currentBowlerName) {
    allPlayers.delete(currentBowlerName);
  }

  if (allPlayers.size === 0) {
    list.innerHTML = '<p style="color:#aaa; text-align:center;"> No players available </p>';
  } else {
    Array.from(allPlayers).forEach(pName => {
      const btn = document.createElement('button');
      btn.className = 'batsman-option-btn';
      btn.textContent = pName;
      btn.onclick = () => confirmNewBowler(pName);
      list.appendChild(btn);
    });
  }

  document.getElementById('new-bowler-modal').classList.add('show');
  document.getElementById('add-bowler-btn').classList.remove('show');
}

function confirmNewBowler(newName) {
  if (!newName) return;

  const ov = matchData.bowler[0].overs;
  const whole = Math.floor(ov);
  const decimal = ov - whole;
  const balls = Math.round(decimal * 10);

  if (balls === 0 && whole > 0) {
    // updateDisplay();
    handleOverEnd();
    swapStriker();
  }

  // Save current bowler's stats to history before replacing
  const currentBowler = matchData.bowler[0];
  if (currentBowler && (currentBowler.overs > 0 || currentBowler.runs > 0 || currentBowler.wickets > 0)) {
    matchData.pastOver.push(JSON.parse(JSON.stringify(matchData.bowler)));
  }


  let existingBowlerIndex = -1;
  let pastStats = null;
  for (let i = 0; i < matchData.pastOver.length; i++) {
    if (matchData.pastOver[i][0].name.toLowerCase() === newName.toLowerCase()) {
      existingBowlerIndex = i;
      pastStats = matchData.pastOver[i][0];
      break;
    }
  }

  if (existingBowlerIndex !== -1) {
    matchData.pastOver.splice(existingBowlerIndex, 1);
    matchData.bowler = [{
      name: pastStats.name,
      overs: pastStats.overs || 0,
      runs: pastStats.runs || 0,
      wickets: pastStats.wickets || 0,
      economy: pastStats.economy || 0,
      isBowler: true
    }];
  } else {
    matchData.bowler = [{
      name: newName,
      overs: 0,
      runs: 0,
      wickets: 0,
      economy: 0,
      isBowler: true
    }];
  }


  document.getElementById('new-bowler-modal').classList.remove('show');
  updateDisplay();
}

function doNothingBowler() {
  document.getElementById('new-bowler-modal').classList.remove('show');
}


function fallWickets(type) {
  saveStateForUndo();
  const bowlerIs = matchData.bowler.find(bo => bo.isBowler);
  const strikerIndex = matchData.batsmen.findIndex(b => b.isStriker);
  if (strikerIndex === -1) return;

  pendingStrikerIndex = strikerIndex;

  const currentBatsman = matchData.batsmen[strikerIndex];

  // Record wicket ball
  if (type === 'run-out') {
    const runs = parseInt(document.getElementById('custom-runs-input-runout').value);
    const invalidBallCheckBox = document.getElementById('invalid-ball-radio');
    const invalidBall = invalidBallCheckBox.checked ? true : false;
    if (invalidBall === true) {
      matchData.totalRuns += runs;
      bowlerIs.runs += runs;
      // currentBatsman.runs += runs;
      // currentBatsman.balls += 1;
      document.getElementById('custom-runs-input-runout').value = '';
      invalidBallCheckBox.checked = false;
      // if (runs === 1 || runs === 3 || runs === 5) swapStriker();
      matchData.extraRuns += runs;
      matchData.wickets+=1;
      recordBall(`WR${runs}`, `WICKET! ${currentBatsman.name} is RUN OUT with ${runs} runs`, false);
    }
    else {
      matchData.totalRuns += runs;
      currentBatsman.runs += runs;
      bowlerIs.runs += runs;
      currentBatsman.balls += 1;
      document.getElementById('custom-runs-input-runout').value = '';
      // if (runs === 1 || runs === 3 || runs === 5) swapStriker();
      matchData.wickets+=1;
      recordBall(`WR${runs}`, `WICKET! ${currentBatsman.name} is RUN OUT with ${runs} runs`, true);
    }
  }
  else {
    bowlerIs.wickets += 1;
    currentBatsman.balls += 1;
    matchData.wickets+=1;
    recordBall('W', `WICKET! ${currentBatsman.name} is OUT`, true);
  }

  const outBatsman = matchData.batsmen[strikerIndex];
  matchData.dismissedBatsmen.push(outBatsman);
  // matchData.wickets += 1;

  // Record Fall of Wicket (Wickets-Runs format)
  // matchData.fallOfWickets.push(`${matchData.wickets}-${matchData.totalRuns} (${outBatsman.name}, ${matchData.overs})`);
  matchData.fallOfWickets.push(`${matchData.totalRuns}`);

  outBatsman.isOut = true;
  if(addBatsmen === true){
    openNewBatsmanModal();
  }
  updateDisplay();
  checkWinCondition();
}


// ✅ Called when user clicks Confirm in the modal
function openNewBatsmanModal() {
  const list = document.getElementById('batsman-options-list');
  const sub = document.getElementById('modal-subtitle');
  list.innerHTML = '';
  if (matchData.availableBatsmen.length === 0) {
    list.innerHTML = '<p style="color:#aaa"> No batsman available </p>';
    sub.textContent = 'No batsman available';
  }
  else {
    matchData.availableBatsmen.forEach(bName => {
      const btn = document.createElement('button');
      btn.className = 'batsman-option-btn';
      btn.textContent = bName;
      btn.onclick = () => confirmNewBatsman(bName);
      list.appendChild(btn);
    });
  }
  document.getElementById('new-batsman-modal').classList.add('show');
}

function confirmNewBatsman(Bname) {

  if (!Bname) return; // don't close until a name is entered

  const newBatsman = {
    name: Bname,
    runs: 0, balls: 0, fours: 0, sixes: 0,
    isStriker: true
  };

  matchData.batsmen[pendingStrikerIndex] = newBatsman;
  matchData.availableBatsmen = matchData.availableBatsmen.filter(b => b !== Bname);
  pendingStrikerIndex = -1;

  document.getElementById('new-batsman-modal').classList.remove('show');
  updateDisplay();
}

function addCustomExtra() {
  saveStateForUndo();
  const xRunsTypeInput = document.getElementById('custom-extra-type');
  const xRunsInput = document.getElementById('custom-extra-runs-input');
  const xRunsType = xRunsTypeInput.value;
  const xRuns = parseInt(xRunsInput.value) || 0;
  const bowlerIs = matchData.bowler.find(b => b.isBowler);

  if (xRunsType === 'wide') {
    matchData.totalRuns += (xRuns + 1); // 1 for wide + runs
    bowlerIs.runs += (xRuns + 1);
    if (xRuns > 0) {
      recordBall(`WD${xRuns}`, `WIDE (${xRuns + 1} runs)`, false); // Not a legal ball
      matchData.extraRuns += (xRuns + 1);
    }
    else {
      recordBall('WD', `WIDE (${xRuns + 1} runs)`, false); // Not a legal ball      
      matchData.extraRuns += (xRuns + 1);
    }
  }
  else if (xRunsType === 'noball') {
    const byeRunsForNoballCheckBox = document.getElementById('bye-runs-for-noball');
    if (byeRunsForNoballCheckBox.checked) {
      matchData.totalRuns += (xRuns + 1); // 1 for nb + runs
      bowlerIs.runs += (xRuns + 1);
      if (xRuns > 0) {
        matchData.extraRuns += xRuns + 1;
        recordBall(`nb${xRuns}`, `NO BALL (${xRuns + 1} runs)`, false); // Not a legal ball
      }
      else {
        matchData.extraRuns += 1;
        recordBall('nb', `NO BALL (${xRuns + 1} runs)`, false); // Not a legal ball
      }
      byeRunsForNoballCheckBox.checked = false;
    }
    else {
      matchData.totalRuns += (xRuns + 1); // 1 for nb + runs
      bowlerIs.runs += (xRuns + 1);
      const striker = matchData.batsmen.find(b => b.isStriker);
      striker.runs += xRuns; // Runs from shot on No Ball count for batsman
      if (xRuns > 0) {
        recordBall(`nb${xRuns}`, `NO BALL (${xRuns + 1} runs)`, false); // Not a legal ball
        // matchData.extraRuns += 1;
      }
      else {
        recordBall('nb', `NO BALL (${xRuns + 1} runs)`, false); // Not a legal ball
        // matchData.extraRuns += 1;
      }
    }
  }
  else if (xRunsType === 'bye') {
    matchData.totalRuns += xRuns;
    // Byes don't count for bowler runs, but they count for team runs
    if (xRuns > 0) {
      matchData.extraRuns += xRuns;
      const striker = matchData.batsmen.find(b => b.isStriker);
      striker.balls += 1;
      recordBall(`b${xRuns}`, `BYE (${xRuns} runs)`, true); // Legal ball
    }
    else {
      matchData.extraRuns += xRuns;
      const striker = matchData.batsmen.find(b => b.isStriker);
      striker.balls += 1;
      recordBall('b', `BYE (${xRuns} runs)`, true); // Legal ball
    }
  }
  else if (xRunsType === 'legbye') {
    matchData.totalRuns += xRuns;
    // Leg byes don't count for bowler runs, but they count for team runs
    if (xRuns > 0) {
      const striker = matchData.batsmen.find(b => b.isStriker);
      striker.balls += 1;
      matchData.extraRuns += xRuns;
      recordBall(`lb${xRuns}`, `LEG BYE (${xRuns} runs)`, true); // Legal ball
    }
    else {
      const striker = matchData.batsmen.find(b => b.isStriker);
      striker.balls += 1;
      matchData.extraRuns += xRuns;
      recordBall('lb', `LEG BYE (${xRuns} runs)`, true); // Legal ball
    }
  }

  xRunsInput.value = '';
}

function resetMatch() {
  // Clear the current inning's data but keep the reference
  const freshData1 = initialInningData();
  const freshData2 = initialInningData();
  Object.keys(freshData1).forEach(key => {
    inning1Data[key] = freshData1[key];
  });
  Object.keys(freshData2).forEach(key => {
    inning2Data[key] = freshData2[key];
  });


  const modalOverlay = document.getElementById('new-match-modal');
  if (modalOverlay) modalOverlay.classList.remove('show');

  updateDisplay();
}

function showPlayersStoredConfirmation(inningNumber) {
  const confirmationOverlay = document.getElementById("confirmation-players-stored");
  const message = document.getElementById("success-message");

  if (!confirmationOverlay) return;

  if (message) {
    message.textContent = `Inning ${inningNumber} Data Stored Successfully`;
  }

  if (playersStoredToastTimer) {
    clearTimeout(playersStoredToastTimer);
  }

  confirmationOverlay.classList.add("show");
  requestAnimationFrame(() => {
    confirmationOverlay.classList.add("is-visible");
  });

  playersStoredToastTimer = setTimeout(() => {
    confirmationOverlay.classList.remove("is-visible");
    setTimeout(() => {
      confirmationOverlay.classList.remove("show");
    }, 240);
  }, 2600);
}

function handleNewPlayer() {
  // Read inning selection first
  const selectedInning = document.querySelector('input[name="inning-radio"]:checked').value;
  currentInning = parseInt(selectedInning, 10);
  matchData = currentInning === 1 ? inning1Data : inning2Data;
  document.getElementById("add-bowler-btn").classList.add("show");

  // Now apply inputs to the selected inning's data
  handleSetTeamName();
  handleSetOpeningBatsmen();
  // handleSetBowler();
  handleSetTotalOvers();

  const modalOverlay = document.getElementById("new-players-modal");
  modalOverlay.classList.remove("show");

  showPlayersStoredConfirmation(currentInning);
  if (currentInning === 2) {
    swapCurrentInning();
  }
}


function handleSetTotalOvers() {
  const totalOversInput = document.getElementById('total-overs-input').value.trim();
  if (totalOversInput) {
    matchData.totalOvers = parseInt(totalOversInput);
  }
  updateDisplay();
  document.getElementById('total-overs-input').value = '';
}

function handleSetTeamName() {
  const teamNameInput = document.getElementById('team-name-input').value.trim();
  if (teamNameInput) {
    matchData.teamName = teamNameInput;
  }
  updateDisplay();
  document.getElementById('team-name-input').value = '';
}

function handleSetOpeningBatsmen() {
  const b1 = document.getElementById('batsman-input-1-').value.trim();
  const b2 = document.getElementById('batsman-input-2-').value.trim();
  const b3 = document.getElementById('batsman-input-3-').value.trim();
  const b4 = document.getElementById('batsman-input-4-').value.trim();
  const b5 = document.getElementById('batsman-input-5-').value.trim();
  const b6 = document.getElementById('batsman-input-6-').value.trim();
  const b7 = document.getElementById('batsman-input-7-').value.trim();
  const b8 = document.getElementById('batsman-input-8-').value.trim();
  const b9 = document.getElementById('batsman-input-9-').value.trim();
  const b10 = document.getElementById('batsman-input-10-').value.trim();
  const b11 = document.getElementById('batsman-input-11-').value.trim();
  // const s = document.getElementById('striker-input').value.trim();
  // const ns = document.getElementById('non-striker-input').value.trim();
  if (b1 && b2) {
    matchData.batsmen = [
      { name: b1, runs: 0, balls: 0, fours: 0, sixes: 0, isStriker: true },
      { name: b2, runs: 0, balls: 0, fours: 0, sixes: 0, isStriker: false }
    ];
  }
  matchData.availableBatsmen.push(b3);
  matchData.availableBatsmen.push(b4);
  matchData.availableBatsmen.push(b5);
  matchData.availableBatsmen.push(b6);
  matchData.availableBatsmen.push(b7);
  matchData.availableBatsmen.push(b8);
  matchData.availableBatsmen.push(b9);
  matchData.availableBatsmen.push(b10);
  matchData.availableBatsmen.push(b11);
  updateDisplay();
  document.getElementById('batsman-input-1-').value = '';
  document.getElementById('batsman-input-2-').value = '';
  document.getElementById('batsman-input-3-').value = '';
  document.getElementById('batsman-input-4-').value = '';
  document.getElementById('batsman-input-5-').value = '';
  document.getElementById('batsman-input-6-').value = '';
  document.getElementById('batsman-input-7-').value = '';
  document.getElementById('batsman-input-8-').value = '';
  document.getElementById('batsman-input-9-').value = '';
  document.getElementById('batsman-input-10-').value = '';
  document.getElementById('batsman-input-11-').value = '';
}


function handleSetBowler() {
  const bowlerNameInput = document.getElementById('bowler-input').value.trim();
  // if (bowlerNameInput){
  // } 
  matchData.bowler = [
    {
      name: bowlerNameInput,
      overs: 0,
      runs: 0,
      wickets: 0,
      economy: 0,
      isBowler: true
    }
  ]
  updateDisplay();
  document.getElementById('bowler-input').value = '';
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function updateDisplay(runs) {
  updateTeamScoreCard();
  updateBatsmen(runs);
  updateBowler();
  updateThisOver();
  updateCommentary();
  updateProjectedScore();
  showRequirementSection();
  updateInningBadge();
  updateFallOfWickets();
  broadcastUpdate();
}

function updateFallOfWickets() {
  const list = document.getElementById('fow-list');
  if (!list) return;
  if (matchData.fallOfWickets.length === 0) {
    list.innerHTML = '<span style="color:#999; font-size:0.85em;">No wickets have fallen yet</span>';
    return;
  }
  let W = 1;
  list.innerHTML = matchData.fallOfWickets.map((fow, index) => {
    // Determine the wicket number (1-indexed)
    const wNum = index + 1;

    // Calculate the correct ordinal suffix
    let suffix = 'th';
    if (wNum === 1) suffix = 'st';
    else if (wNum === 2) suffix = 'nd';
    else if (wNum === 3) suffix = 'rd';
    // Return the correctly formatted HTML string
    return `<div class="fow-item">
      <div class="fow-wickets">${wNum}${suffix}</div>
      <div class="fow-runs">${fow}</div>
    </div>`;
  }).join('');
}

function showRequirementSection() {
  if (currentInning === 2) {
    document.getElementById('requirement__section').classList.add('show');
    updateRequiredScore();
  }
  else {
    document.getElementById('requirement__section').classList.remove('show');
  }
}

function updateInningBadge() {
  const badge = document.getElementById('inning-badge');
  if (badge) badge.textContent = `Inning ${currentInning} `;
}
function swapCurrentInning() {
  // document.getElementById()
  currentInning = currentInning === 1 ? 2 : 1;
  matchData = currentInning === 1 ? inning1Data : inning2Data;
  const el = document.getElementById('this-over-content');
  el.value = '';
  const list = document.getElementById('commentary-card-list');
  list.value = '';
  updateDisplay();
}

function updateTeamScoreCard() {
  const nameEl = document.getElementById('team-name');
  const scoreEl = document.getElementById('team-score');
  const oversEl = document.getElementById('team-overs');

  if (nameEl) nameEl.textContent = matchData.teamName;
  if (scoreEl) scoreEl.textContent = `${matchData.totalRuns}/${matchData.wickets}`;
  if (oversEl) oversEl.textContent = matchData.overs;
}


function updateBatsmen(runs) {
  // After an odd run, the strike changes for the next ball
  if (runs === 1 || runs === 3 || runs === 5) swapStriker();

  const b1 = matchData.batsmen[0];
  const b2 = matchData.batsmen[1];

  // Update card styles
  const b1Card = document.getElementById('batsman-1-card');
  const b2Card = document.getElementById('batsman-2-card');

  if (b1Card && b2Card) {
    if (b1?.isStriker) {
      b1Card.className = 'batsman-card-active';
      b2Card.className = 'batsman-card';
    } else {
      b1Card.className = 'batsman-card';
      b2Card.className = 'batsman-card-active';
    }
  }

  // Always render BOTH batsmen.
  const b1Name = document.getElementById('batsman-1-name');
  const b1Score = document.getElementById('batsman-1-score');
  const b1Balls = document.getElementById('batsman-1-ball');
  const b1Fours = document.getElementById('batsman-1-fours');
  const b1Sixes = document.getElementById('batsman-1-sixes');
  const b1SR = document.getElementById('batsman-1-sr');

  const b2Name = document.getElementById('batsman-2-name');
  const b2Score = document.getElementById('batsman-2-score');
  const b2Balls = document.getElementById('batsman-2-ball');
  const b2Fours = document.getElementById('batsman-2-fours');
  const b2Sixes = document.getElementById('batsman-2-sixes');
  const b2SR = document.getElementById('batsman-2-sr');

  if (b1Name) b1Name.textContent = b1?.name ?? 'Batsman-1-';
  if (b1Score) b1Score.textContent = `${b1?.runs ?? 0}`;
  if (b1Balls) b1Balls.textContent = `${b1?.balls ?? 0}`;
  if (b1Fours) b1Fours.textContent = `${b1?.fours ?? 0}`;
  if (b1Sixes) b1Sixes.textContent = `${b1?.sixes ?? 0}`;
  if (b1SR) b1SR.textContent = `${calStrikeRate(b1?.runs ?? 0, b1?.balls ?? 0)}`;

  if (b2Name) b2Name.textContent = b2?.name ?? 'Batsman-2-';
  if (b2Score) b2Score.textContent = `${b2?.runs ?? 0}`;
  if (b2Balls) b2Balls.textContent = `${b2?.balls ?? 0}`;
  if (b2Fours) b2Fours.textContent = `${b2?.fours ?? 0}`;
  if (b2Sixes) b2Sixes.textContent = `${b2?.sixes ?? 0}`;
  if (b2SR) b2SR.textContent = `${calStrikeRate(b2?.runs ?? 0, b2?.balls ?? 0)}`;

  // Update striker indicator - show dot on whoever will face next ball
  const strikerIdicator1 = document.getElementById('striker-indicator1');
  const strikerIdicator2 = document.getElementById('striker-indicator2');
  if (strikerIdicator1 && strikerIdicator2) {
    if (b1?.isStriker) {
      strikerIdicator1.classList.add('show');
      strikerIdicator2.classList.remove('show');
    } else if (b2?.isStriker) {
      strikerIdicator1.classList.remove('show');
      strikerIdicator2.classList.add('show');
    } else {
      strikerIdicator1.classList.remove('show');
      strikerIdicator2.classList.remove('show');
    }
  }
}

function updateBowler() {
  // const bowlerOnActive = matchData.bowler.find(bow => bow.isBowler);
  const bo1 = matchData.bowler[0];
  const bowlerName = document.getElementById('bowler-id');
  bowlerName.textContent = `${bo1.name}`;
  const bowlerRuns = document.getElementById('bowler-score');
  bowlerRuns.textContent = `${bo1.wickets}-${bo1.runs}`;
  const bowlerOvers = document.getElementById('bowler-overs');
  bowlerOvers.textContent = `${bo1.overs}`;
  const bowlerEconomy = document.getElementById('bowler-economy');
  bowlerEconomy.textContent = `${calEconomy(bo1.overs)}`;
}

function updateThisOver() {
  const el = document.getElementById('this-over-content');
  if (!el) return;
  if (matchData.currentOver.length === 0) {
    el.innerHTML = '<span class="ball-empty">No balls this over yet</span>';
    return;
  }

  el.value = '';

  el.innerHTML = matchData.currentOver.map(b => {
    const span = document.createElement('span');
    if (b === 'W' || b === 'W1' || b === 'W2' || b === 'W3' || b === 'W4' || b === 'W6') span.className = 'ball ball-W';
    else if (b === 'WD' || b === 'WD1' || b === 'WD2' || b === 'WD3' || b === 'WD4' || b === 'WD6') span.className = 'ball ball-w';
    else if (b === 'nb' || b === 'nb1' || b === 'nb2' || b === 'nb3' || b === 'nb4' || b === 'nb6') span.className = 'ball ball-nb';
    else if (b === 'b' || b === 'b1' || b === 'b2' || b === 'b3' || b === 'b4' || b === 'b6') span.className = 'ball ball-b';
    else if (b === 'lb' || b === 'lb1' || b === 'lb2' || b === 'lb3' || b === 'lb4' || b === 'lb6') span.className = 'ball ball-lb';
    else span.className = `ball ball-${b}`;

    span.textContent = b;
    return span.outerHTML;
  }).join('');
}

function updateProjectedScore() {
  const el = document.getElementById('projected-score');
  const el1 = document.getElementById('current-run-rate');
  const el2 = document.getElementById('projected-score-label');
  if (!el) return;
  const totalOvers = matchData.totalOvers;
  const overs = matchData.overs;
  if (overs <= 0) {
    el.textContent = '--';
    if (el1) el1.textContent = '0.00';
    if (el2) el2.textContent = `at ${matchData.totalOvers} overs`;
    return;
  }
  if (el2) el2.textContent = `at ${matchData.totalOvers} overs`;
  const whole = Math.floor(overs);
  const balls = Math.round((overs - whole) * 10);
  const totalBalls = whole * 6 + balls;
  const runRate = matchData.totalRuns / (totalBalls / 6);
  const runRate1 = (matchData.totalRuns / (totalBalls / 6)).toFixed(2);
  matchData.runRate = runRate1;
  const projected = Math.round(runRate * totalOvers);
  matchData.projectedScore = projected;
  el.textContent = projected;
  el1.textContent = matchData.runRate;
}
function convertsBalls(overs) {
  const whole = Math.floor(overs)
  const balls = Math.round((overs - whole) * 10)
  const totalB = whole * 6 + balls;
  return totalB;
}

function updateRequiredScore() {
  const inning1Run = inning1Data.totalRuns;
  const inning2Run = inning2Data.totalRuns;
  const totalO = matchData.totalOvers;
  const currentO = matchData.overs;
  const remainingBalls = convertsBalls(totalO) - convertsBalls(currentO);
  const remainingOvers = ((convertsBalls(totalO) - convertsBalls(currentO)) / 6).toFixed(2);
  const Rrr = (((inning1Run - inning2Run) + 1) / remainingOvers).toFixed(2);
  matchData.remainingRuns = inning1Run - inning2Run + 1;
  matchData.remainingBalls = remainingBalls;
  matchData.rrr = Rrr;

  const runs = document.querySelector('.requirement__runs-value');
  const balls = document.querySelector('.requirement__balls-value');
  const rrr = document.querySelector('.requirement__run-rate');
  const rrrLabel = document.querySelector('.requirement__rrr-label');
  if (runs) runs.textContent = matchData.remainingRuns;
  if (balls) balls.textContent = matchData.remainingBalls;
  if (rrr) rrr.textContent = matchData.rrr;
  // if (rrrLabel) rrrLabel.textContent = 'Requird Run Rate';
}

function updateCommentary() {
  const list = document.getElementById('commentary-card-list');
  if (!list) return;
  if (matchData.commentary.length === 0) {
    list.innerHTML = '';
    return;
  }

  list.value = '';

  // latest ball on top
  const items = matchData.commentary.slice().reverse().map(text => {
    const div = document.createElement('div');
    div.className = 'commentary-item';
    div.textContent = text;
    return div.outerHTML;
  }).join('');
  list.innerHTML = items;
}

// Format overs display
// function formatOvers(overs) {
//   let whole = Math.floor(overs);
//   let balls = Math.round((overs - whole) * 10);
//   return `${whole}.${balls}`;
// }

// \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

function calEconomy(overs) {
  const bowlerIs = matchData.bowler.find(b => b.isBowler);
  const runs = bowlerIs.runs;
  const whole = Math.floor(overs);
  const balls = Math.round((overs - whole) * 10);
  const totalBalls = whole * 6 + balls;
  if (totalBalls === 0) return '0.00';
  const denominator = (totalBalls / 6);
  const economy = (runs / denominator).toFixed(2);
  bowlerIs.economy = economy;
  return economy;
}
function calStrikeRate(runs, bowls) {
  if (!bowls) return '0.00';
  const sr = ((runs / bowls) * 100).toFixed(2);
  return sr;
}
function swapStriker() {
  const striker = matchData.batsmen.find(b => b.isStriker);
  const nonstriker = matchData.batsmen.find(b => !b.isStriker);
  if (striker && nonstriker) {
    striker.isStriker = false;
    nonstriker.isStriker = true;
  }
}

function setStriker(index) {
  saveStateForUndo();
  matchData.batsmen.forEach((b, i) => {
    b.isStriker = (i === index);
  });
  updateDisplay();
}
function addCustomRuns() {
  const cRunsInput = document.getElementById('custom-runs-input');
  const cRuns = parseInt(cRunsInput.value);
  if (cRuns > 0) {
    addRuns(cRuns);
    cRunsInput.value = '';
  }
}


// function onNewMatchClick() {
//   const sure = confirm("Are you sure to make new match?");
//   if (!sure) return;          // user pressed Cancel

//   resetMatch();               // your existing reset function
// }

function doNothing() {
  const modalOverlay = document.getElementById('new-match-modal');
  return modalOverlay.classList.remove('show');
}
function doNothing2() {
  const modalOverlay = document.getElementById('new-players-modal');
  return modalOverlay.classList.remove('show');
}
function doNothing3() {
  const modalOverlay = document.getElementById('new-batsman-modal');
  return modalOverlay.classList.remove('show');
}
function doNothing4() {
  const modalOverlay = document.getElementById('new-inning-modal');
  return modalOverlay.classList.remove('show');
}
function doNothing5() {
  const modalOverlay = document.getElementById('second-inning-modal');
  return modalOverlay.classList.remove('show');
}


function onNewMatchClick() {
  document.getElementById('new-match-modal').classList.add('show');
}
function onNewPlayersClick() {
  document.getElementById('new-players-modal').classList.add('show');
}

// JS
// function setTeamName(name) {
//   matchData.teamName = name;
//   updateDisplay();
// }




function checkWinCondition() {
  if (currentInning !== 2) return;

  const target = inning1Data.totalRuns;
  const currentRuns = inning2Data.totalRuns;
  const currentWickets = inning2Data.wickets;
  const maxWickets = 10;

  // Case 1: Chasing team wins
  if (currentRuns > target) {
    showResult(`${inning2Data.teamName} won by ${maxWickets - currentWickets} wickets!`);

  }
  // Case 2: Defending team wins (All out)
  else if (currentWickets >= maxWickets) {
    if (currentRuns === target) {
      showResult("Match Tied!");
    } else {
      showResult(`${inning1Data.teamName} won by ${target - currentRuns} runs!`);
    }

  }
  // Case 3: Overs finished
  else if (inning2Data.overs >= inning2Data.totalOvers && inning2Data.totalOvers > 0) {
    // const whole = Math.floor(inning2Data.overs);
    // const balls = Math.round((inning2Data.overs - whole) * 10);
    // if (balls === 0) { // Just finished an over
    if (currentRuns > target) {
      showResult(`${inning2Data.teamName} won by ${maxWickets - currentWickets} wickets!`);
    } else if (currentRuns === target) {
      showResult("Match Tied!");
    } else {
      showResult(`${inning1Data.teamName} won by ${target - currentRuns} runs!`);
    }

    // }
  }
}
const formatBatsmen = (batsmen) => {
  return `
    <table>
      <tr class="section-label">
        <th>Batsman</th>
        <th>R</th>
        <th>B</th>
        <th>4s</th>
        <th>6s</th>
        <th>SR</th>
      </tr>
      ${batsmen.map(b => `
        <tr>
          ${b.isOut ? `<td>${b.name}</td>` : `<td>${b.name}*</td>`}
          <td>${b.runs}</td>
          <td>${b.balls}</td>
          <td>${b.fours}</td>
          <td>${b.sixes}</td>
          <td>${calStrikeRate(b.runs, b.balls)}</td>
        </tr>
      `).join('')}
    </table>
  `;
};

const formatBowler = (bowler) => {
  return `
    <table>
      <tr class="section-label">
        <th>Bowler</th>
        <th>O</th>
        <th>R</th>
        <th>W</th>
        <th>E</th>
      </tr>
      ${bowler.map(
    b => `
          <tr>
            <td>${b.name}</td>
            <td>${b.overs}</td>
            <td>${b.runs}</td>
            <td>${b.wickets}</td>
            <td>${b.economy}</td>
          </tr>
        `
  ).join('')}
    </table>
  `;
};


function generatePDF() {
  const element = document.getElementById('match-report-template');
  element.style.display = 'block';

  // Populate data
  document.getElementById('report-date').textContent = new Date().toLocaleString();
  document.getElementById('report-result-text').textContent = document.getElementById('result-message').textContent;

  document.getElementById('report-i1-team').textContent = inning1Data.teamName;
  document.getElementById('report-i1-score').textContent = `${inning1Data.totalRuns}/${inning1Data.wickets} (${inning1Data.overs} ov)`;

  document.getElementById('report-i2-team').textContent = inning2Data.teamName;
  document.getElementById('report-i2-score').textContent = `${inning2Data.totalRuns}/${inning2Data.wickets} (${inning2Data.overs} ov)`;

  document.getElementById('report-i1-Extra-Runs').textContent = inning1Data.extraRuns;
  document.getElementById('report-i2-Extra-Runs').textContent = inning2Data.extraRuns;

  document.getElementById('report-i1-team-bowler').textContent = inning1Data.teamName;
  document.getElementById('report-i1-bowlers-table').innerHTML = formatBowler(inning1Data.pastOver.flat().concat(inning1Data.bowler));
  document.getElementById('report-i2-team-bowler').textContent = inning2Data.teamName;
  document.getElementById('report-i2-bowlers-table').innerHTML = formatBowler(inning2Data.pastOver.flat().concat(inning2Data.bowler));


  document.getElementById('report-i1-batsmen').innerHTML = formatBatsmen(inning1Data.batsmen.concat(inning1Data.dismissedBatsmen));
  document.getElementById('report-i2-batsmen').innerHTML = formatBatsmen(inning2Data.batsmen.concat(inning2Data.dismissedBatsmen));

  document.getElementById('report-commentary-1').innerHTML = inning1Data.commentary.map(c => `<p>${c}</p>`).join('');
  document.getElementById('report-commentary-2').innerHTML = inning2Data.commentary.map(c => `<p>${c}</p>`).join('');

  const opt = {
    margin: 1,
    filename: `Match_Report_${inning1Data.teamName}_vs_${inning2Data.teamName}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();

  setTimeout(() => {
    element.style.display = 'none';
  }, 1000);

  // resetMatch();
}


function showMatchOverview() {
  document.getElementById('team-1').textContent = inning1Data.teamName;
  document.getElementById('inning-1-total-run').textContent = `${inning1Data.totalRuns}/${inning1Data.wickets} (${inning1Data.overs} ov)`;
  document.getElementById('inning-1-batsmen-table').innerHTML = formatBatsmen(inning1Data.batsmen.concat(inning1Data.dismissedBatsmen));
  document.getElementById('inning-1-bowlers-table').innerHTML = formatBowler(inning1Data.pastOver.flat().concat(inning1Data.bowler));
  const ext1 = document.getElementById('inning-1-extraRuns');
  ext1.textContent = inning1Data.extraRuns;

  document.getElementById('team-2').textContent = inning2Data.teamName;
  document.getElementById('inning-2-total-run').textContent = `${inning2Data.totalRuns}/${inning2Data.wickets} (${inning2Data.overs} ov)`;
  document.getElementById('inning-2-batsmen-table').innerHTML = formatBatsmen(inning2Data.batsmen.concat(inning2Data.dismissedBatsmen));
  document.getElementById('inning-2-bowlers-table').innerHTML = formatBowler(inning2Data.pastOver.flat().concat(inning2Data.bowler));
  const ext2 = document.getElementById('inning-2-extraRuns');
  ext2.textContent = inning2Data.extraRuns;


  document.getElementById('match-overview-modal').classList.add('show');
}

function closeMatchOverviewModal() {
  document.getElementById('match-overview-modal').classList.remove('show');
}

function showResult(message) {
  document.getElementById('result-message').textContent = message;
  document.getElementById('result-modal').classList.add('show');
  syncChannel.postMessage({ type: 'MATCH_FINISHED', message: message });
}

function closeResultModal() {
  document.getElementById('result-modal').classList.remove('show');
}



// document.getElementById('bowler-name-input').addEventListener('keypress', function (e) {
// if (e.key === 'Enter') {
//   confirmNewBowler();
// }
// });
