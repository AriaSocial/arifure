// Get references to the input fields and result display
const initialWoodenHammerInput = document.getElementById('initialWoodenHammer');
const initialIronHammerInput = document.getElementById('initialIronHammer');
const initialCopperHammerInput = document.getElementById('initialCopperHammer');
const initialSilverHammerInput = document.getElementById('initialSilverHammer');
const initialGoldHammerInput = document.getElementById('initialGoldHammer');
const addIronHammerToggle = document.getElementById('addIronHammerToggle'); // 切り替えボタンの参照を取得
const calculateFinalBtn = document.getElementById('calculateFinalBtn');
const finalTotalPointsSpan = document.getElementById('finalTotalPoints');

// Get references for gained hammers breakdown
const gainedWoodenSpan = document.getElementById('gainedWooden');
const gainedIronSpan = document.getElementById('gainedIron');
const gainedCopperSpan = document.getElementById('gainedCopper');
const gainedSilverSpan = document.getElementById('gainedSilver');
const gainedGoldSpan = document.getElementById('gainedGold');

// Define the point values for each hammer type
const pointsPerHammer = {
    wooden: 1,
    iron: 10,
    copper: 20,
    silver: 50,
    gold: 0 // 金槌は0ポイント
};

// Define the points required to gain hammers and the hammer gained (Normal Mode)
// threshold_diff: 前回の閾値からの差分ポイント
// hammer: 獲得できる槌の種類
const gainThresholdsNormal = [
    { threshold_diff: 10, hammer: 'iron' },   // 10Pt獲得で鉄槌
    { threshold_diff: 20, hammer: 'iron' },   // さらに20Pt獲得で鉄槌 (累計30Pt)
    { threshold_diff: 30, hammer: 'copper' }, // さらに30Pt獲得で銅槌 (累計60Pt)
    { threshold_diff: 40, hammer: 'silver' }, // さらに40Pt獲得で銀槌 (累計100Pt)
    { threshold_diff: 80, hammer: 'silver' }, // さらに80Pt獲得で銀槌 (累計180Pt)
    { threshold_diff: 100, hammer: 'silver' }, // さらに100Pt獲得で銀槌 (累計280Pt)
    { threshold_diff: 70, hammer: 'copper' }, // さらに70Pt獲得で銅槌 (累計350Pt)
    { threshold_diff: 50, hammer: 'silver' }, // さらに50Pt獲得で銀槌 (累計400Pt)
    { threshold_diff: 100, hammer: 'gold' }   // さらに100Pt獲得で金槌 (累計500Pt)
];

// Define the points required to gain hammers (Weekly Event Mode)
// threshold: 累計獲得ポイント
// hammer: 獲得できる槌の種類
// count: 獲得できる槌の数
const weeklyEventThresholds = [
    { threshold: 1000, hammer: 'iron', count: 10 },
    { threshold: 2000, hammer: 'iron', count: 10 },
    { threshold: 4000, hammer: 'iron', count: 10 },
    { threshold: 6000, hammer: 'iron', count: 10 },
    { threshold: 8000, hammer: 'iron', count: 10 },
    { threshold: 9000, hammer: 'iron', count: 10 },
    { threshold: 10000, hammer: 'iron', count: 10 },
    { threshold: 12000, hammer: 'iron', count: 10 },
    { threshold: 14000, hammer: 'iron', count: 10 },
    { threshold: 16000, hammer: 'iron', count: 10 },
    { threshold: 17000, hammer: 'iron', count: 10 },
    { threshold: 18000, hammer: 'iron', count: 10 },
    { threshold: 20000, hammer: 'iron', count: 10 },
    { threshold: 22000, hammer: 'iron', count: 10 },
    { threshold: 24000, hammer: 'iron', count: 10 },
    { threshold: 25000, hammer: 'iron', count: 10 },
    { threshold: 26000, hammer: 'iron', count: 10 },
    { threshold: 28000, hammer: 'iron', count: 10 },
    { threshold: 30000, hammer: 'iron', count: 10 },
];


/**
 * Calculates the total points from a given set of hammers.
 * @param {object} hammers - An object containing the count of each hammer type.
 * @returns {number} The total points.
 */
function calculatePointsFromHammers(hammers) {
    let total = 0;
    total += (hammers.wooden || 0) * pointsPerHammer.wooden;
    total += (hammers.iron || 0) * pointsPerHammer.iron;
    total += (hammers.copper || 0) * pointsPerHammer.copper;
    total += (hammers.silver || 0) * pointsPerHammer.silver;
    total += (hammers.gold || 0) * pointsPerHammer.gold;
    return total;
}

// Add event listener to the button
calculateFinalBtn.addEventListener('click', () => {
    // Get the initial number of each hammer
    let hammersForProcessing = {
        wooden: parseInt(initialWoodenHammerInput.value) || 0,
        iron: parseInt(initialIronHammerInput.value) || 0,
        copper: parseInt(initialCopperHammerInput.value) || 0,
        silver: parseInt(initialSilverHammerInput.value) || 0,
        gold: parseInt(initialGoldHammerInput.value) || 0
    };

    let totalPointsEarned = 0;
    let pointsAccumulatedSinceLastNormalThreshold = 0; // 通常モードの閾値を最後に達成してから蓄積されたポイント
    let currentNormalThresholdIndex = 0; // 現在チェックしている通常モードの閾値のインデックス
    let weeklyEventThresholdsReached = 0; // 週間イベントの閾値をいくつ達成したか

    const totalGainedHammers = { wooden: 0, iron: 0, copper: 0, silver: 0, gold: 0 };

    // Iterative calculation loop
    // ループは、処理すべきハンマーが残っているか、または獲得したポイントで新たな閾値を超えられる限り続きます。
    let iterationCount = 0;
    const maxIterations = 2000; // 無限ループ防止のための最大試行回数 (必要に応じて調整)

    while (iterationCount < maxIterations) {
        // このイテレーションで処理するハンマーからポイントを計算
        const pointsFromCurrentHammers = calculatePointsFromHammers(hammersForProcessing);

        // 処理すべきハンマーがなく、かつ新たな槌獲得の閾値に満たない場合はループ終了
        // 通常モードと週間イベントモードの両方の閾値を考慮
        const canGainNormalHammer = currentNormalThresholdIndex < gainThresholdsNormal.length && pointsAccumulatedSinceLastNormalThreshold + pointsFromCurrentHammers >= gainThresholdsNormal[currentNormalThresholdIndex].threshold_diff;
        const canGainWeeklyEventHammer = addIronHammerToggle.checked && weeklyEventThresholdsReached < weeklyEventThresholds.length && totalPointsEarned + pointsFromCurrentHammers >= weeklyEventThresholds[weeklyEventThresholdsReached].threshold;

        if (pointsFromCurrentHammers === 0 && !canGainNormalHammer && !canGainWeeklyEventHammer) {
             break;
        }

        // 獲得したポイントを累計ポイントに加算
        totalPointsEarned += pointsFromCurrentHammers;
        // 獲得したポイントを通常モードの蓄積ポイントに加算
        pointsAccumulatedSinceLastNormalThreshold += pointsFromCurrentHammers;


        // 処理したハンマーをリセット（消費されたとみなす）
        hammersForProcessing = { wooden: 0, iron: 0, copper: 0, silver: 0, gold: 0 };

        // 通常モードでの槌獲得処理
        // 蓄積ポイントで達成できる閾値をチェックし、槌を獲得
        // 蓄積ポイントが現在の閾値差分以上であれば、獲得を繰り返す
        let gainedHammerThisIteration = false; // このイテレーションで槌を獲得したかどうかのフラグ (通常モードまたは週間イベントモード)
        while (currentNormalThresholdIndex < gainThresholdsNormal.length && pointsAccumulatedSinceLastNormalThreshold >= gainThresholdsNormal[currentNormalThresholdIndex].threshold_diff) {
            const hammerTypeToGain = gainThresholdsNormal[currentNormalThresholdIndex].hammer;

            // 獲得した槌を totalGainedHammers に加算 (最終的な内訳用)
            totalGainedHammers[hammerTypeToGain]++;
            // 獲得した槌を次のイテレーションで処理するハンマーリストに加算
            hammersForProcessing[hammerTypeToGain]++;
            gainedHammerThisIteration = true; // 槌を獲得したことを記録

            // 獲得に使用したポイントを蓄積ポイントから減算
            pointsAccumulatedSinceLastNormalThreshold -= gainThresholdsNormal[currentNormalThresholdIndex].threshold_diff;

            // 次の通常モードの閾値インデックスに進む
            currentNormalThresholdIndex++;

            // 通常モードの閾値リストの最後に達したら、最初の閾値に戻る（ループ）
            if (currentNormalThresholdIndex >= gainThresholdsNormal.length) {
                currentNormalThresholdIndex = 0;
                // 蓄積ポイントの残りはそのまま次のサイクルの開始ポイントとなる
            }
        }

        // 週間イベントモードが有効な場合の追加槌獲得処理
        if (addIronHammerToggle.checked) {
            // 週間イベントの閾値をチェック
            while (weeklyEventThresholdsReached < weeklyEventThresholds.length && totalPointsEarned >= weeklyEventThresholds[weeklyEventThresholdsReached].threshold) {
                const hammerTypeToGain = weeklyEventThresholds[weeklyEventThresholdsReached].hammer;
                const hammerCountToGain = weeklyEventThresholds[weeklyEventThresholdsReached].count;

                // 獲得した槌を totalGainedHammers に加算 (最終的な内訳用)
                totalGainedHammers[hammerTypeToGain] += hammerCountToGain;
                // 獲得した槌を次のイテレーションで処理するハンマーリストに加算
                hammersForProcessing[hammerTypeToGain] += hammerCountToGain;
                gainedHammerThisIteration = true; // 槌を獲得したことを記録 (週間イベントモードでの獲得も含む)

                weeklyEventThresholdsReached++; // 次の週間イベントの閾値へ
            }
        }

        iterationCount++;
    }

    if (iterationCount >= maxIterations) {
        console.warn("最大試行回数に達しました。計算が収束しない可能性があります。");
        // 無限ループの可能性を示唆する場合、ユーザーに通知するなどの処理を追加することもできます。
    }

    // 最終的な累計ポイントを表示
    finalTotalPointsSpan.textContent = totalPointsEarned;

    // 獲得した槌の内訳を表示
    gainedWoodenSpan.textContent = totalGainedHammers.wooden;
    gainedIronSpan.textContent = totalGainedHammers.iron;
    gainedCopperSpan.textContent = totalGainedHammers.copper;
    gainedSilverSpan.textContent = totalGainedHammers.silver;
    gainedGoldSpan.textContent = totalGainedHammers.gold;
});
