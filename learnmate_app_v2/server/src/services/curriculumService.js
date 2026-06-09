const mongoose = require('mongoose');

// 台灣 108 課綱核心科目與版本週進度對照表 (國小高年級 5-6 年級範例，其他年級/科目/版本可動態 Fallback)
const SYLLABUS_DB = {
  '6': {
    '數學': {
      '康軒版': [
        { week: 1, unit: '單元一：質因數分解與最大公因數' },
        { week: 2, unit: '單元一：質因數分解與最大公因數' },
        { week: 3, unit: '單元二：分數的除法' },
        { week: 4, unit: '單元二：分數的除法' },
        { week: 5, unit: '單元三：小數的除法' },
        { week: 6, unit: '單元三：小數的除法' },
        { week: 7, unit: '單元四：數量關係' },
        { week: 8, unit: '單元四：數量關係' },
        { week: 9, unit: '期中考複習' },
        { week: 10, unit: '單元五：圓周率與圓周長' },
        { week: 11, unit: '單元五：圓周率與圓周長' },
        { week: 12, unit: '單元六：比例與縮圖' },
        { week: 13, unit: '單元六：比例與縮圖' },
        { week: 14, unit: '單元七：速速率' },
        { week: 15, unit: '單元七：速速率' },
        { week: 16, unit: '單元八：圓面積' },
        { week: 17, unit: '單元八：圓面積' },
        { week: 18, unit: '單元九：等量公理' },
        { week: 19, unit: '單元九：等量公理' },
        { week: 20, unit: '期末考複習' },
        { week: 21, unit: '學期總整理' }
      ],
      '南一版': [
        { week: 1, unit: '單元一：最大公因數與最小公倍數' },
        { week: 2, unit: '單元一：最大公因數與最小公倍數' },
        { week: 3, unit: '單元二：分數的除法' },
        { week: 4, unit: '單元二：分數的除法' },
        { week: 5, unit: '單元三：長度與體積單位' },
        { week: 6, unit: '單元三：長度與體積單位' },
        { week: 7, unit: '單元四：小數的除法' },
        { week: 8, unit: '單元四：小數 the 除法' },
        { week: 9, unit: '期中考複習' },
        { week: 10, unit: '單元五：圓周長與圓半徑' },
        { week: 11, unit: '單元五：圓周長與圓半徑' },
        { week: 12, unit: '單元六：比與比值' },
        { week: 13, unit: '單元六：比與比值' },
        { week: 14, unit: '單元七：圓面積與扇形面積' },
        { week: 15, unit: '單元七：圓面積與扇形面積' },
        { week: 16, unit: '單元八：速度與速率' },
        { week: 17, unit: '單元八：速度與速率' },
        { week: 18, unit: '單元九：放大圖與縮小圖' },
        { week: 19, unit: '單元九：放大圖與縮小圖' },
        { week: 20, unit: '期末考複習' },
        { week: 21, unit: '學期總整理' }
      ]
    },
    '英語': {
      '康軒版': [
        { week: 1, unit: 'Unit 1: What Time Do You Get Up?' },
        { week: 2, unit: 'Unit 1: What Time Do You Get Up?' },
        { week: 3, unit: 'Unit 1: What Time Do You Get Up? - Grammar Focus' },
        { week: 4, unit: 'Unit 2: He Wants to Be a Doctor' },
        { week: 5, unit: 'Unit 2: He Wants to Be a Doctor' },
        { week: 6, unit: 'Unit 2: He Wants to Be a Doctor - Occupation Focus' },
        { week: 7, unit: 'Review 1' },
        { week: 8, unit: 'Midterm Review & Culture' },
        { week: 9, unit: '期中考複習' },
        { week: 10, unit: 'Unit 3: Where Were You Yesterday?' },
        { week: 11, unit: 'Unit 3: Where Were You Yesterday?' },
        { week: 12, unit: 'Unit 3: Where Were You Yesterday? - Past Tense Focus' },
        { week: 13, unit: 'Unit 4: How Can We Get to the Museum?' },
        { week: 14, unit: 'Unit 4: How Can We Get to the Museum?' },
        { week: 15, unit: 'Unit 4: How Can We Get to the Museum? - Directions Focus' },
        { week: 16, unit: 'Review 2' },
        { week: 17, unit: 'Final Review & Culture' },
        { week: 18, unit: 'Grammar Synthesis' },
        { week: 19, unit: 'Grammar Synthesis' },
        { week: 20, unit: '期末考複習' },
        { week: 21, unit: '學期總整理' }
      ]
    }
  },
  '5': {
    '數學': {
      '康軒版': [
        { week: 1, unit: '單元一：乘除與十進位數' },
        { week: 2, unit: '單元一：乘除與十進位數' },
        { week: 3, unit: '單元二：因數與倍數' },
        { week: 4, unit: '單元二：因數與倍數' },
        { week: 5, unit: '單元三：擴分、約分與通分' },
        { week: 6, unit: '單元三：擴分、約分與通分' },
        { week: 7, unit: '單元四：多邊形與三角形角' },
        { week: 8, unit: '單元四：多邊形與三角形角' },
        { week: 9, unit: '期中考複習' },
        { week: 10, unit: '單元五：異分母分數的加減' },
        { week: 11, unit: '單元五：異分母分數的加減' },
        { week: 12, unit: '單元六：小數的乘法' },
        { week: 13, unit: '單元六：小數的乘法' },
        { week: 14, unit: '單元七：線對稱圖形' },
        { week: 15, unit: '單元七：線對稱圖形' },
        { week: 16, unit: '單元八：圓心角與扇形' },
        { week: 17, unit: '單元八：圓心角與扇形' },
        { week: 18, unit: '單元九：面積與複合圖形' },
        { week: 19, unit: '單元九：面積與複合圖形' },
        { week: 20, unit: '期末考複習' },
        { week: 21, unit: '學期總整理' }
      ]
    }
  }
};

/**
 * 計算當前日期是學期的第幾週 (基於開學日)
 * 台灣第一學期通常於 8/30 或 8/31 左右開學，第二學期於 2/11 或 2/12 左右開學。
 * 為了計算簡便，我們可以用靜態開學日期做為基準點，並允許動態傳入開學日。
 */
function getCurrentAcademicWeek(targetDate = new Date()) {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1; // 1-indexed

  let semesterStart;
  if (month >= 8 || month <= 1) {
    // 第一學期 (秋季班)
    // 假設開學日為該年的 8 月 30 日（若 1 月，則為前一年的 8 月 30 日）
    const startYear = month <= 1 ? year - 1 : year;
    semesterStart = new Date(startYear, 7, 30); // month is 0-indexed in JS Date
  } else {
    // 第二學期 (春季班)
    // 假設開學日為該年 2 月 11 日
    semesterStart = new Date(year, 1, 11);
  }

  const diffTime = targetDate.getTime() - semesterStart.getTime();
  if (diffTime < 0) {
    // 開學前，視為第一週
    return 1;
  }

  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  
  // 每學期最長 21 週
  return Math.min(21, week);
}

/**
 * 根據年級、科目、版本及偏差值 (Offset)，獲取當前應有的學習單元
 */
function getPredictedUnit(grade, subject, edition, progressOffset = 0, targetDate = new Date()) {
  const currentWeek = getCurrentAcademicWeek(targetDate);
  // 計算調整後的目標週次
  let targetWeek = currentWeek + progressOffset;
  if (targetWeek < 1) targetWeek = 1;
  if (targetWeek > 21) targetWeek = 21;

  // 清理版本字串（移除「版」字以匹配 Key，例如 "康軒版" -> "康軒版"，或 "康軒" -> "康軒版"）
  let cleanEdition = edition || '康軒版';
  if (!cleanEdition.endsWith('版')) {
    cleanEdition += '版';
  }

  // 嘗試從進度對照表檢索
  const gradeData = SYLLABUS_DB[grade];
  if (gradeData && gradeData[subject] && gradeData[subject][cleanEdition]) {
    const syllabusList = gradeData[subject][cleanEdition];
    const weekItem = syllabusList.find(item => item.week === targetWeek);
    if (weekItem) {
      return {
        week: currentWeek,
        targetWeek: targetWeek,
        unit: weekItem.unit,
        isFallback: false
      };
    }
  }

  // Fallback 策略：若未在資料庫中匹配到該科目版本，則返回基於週數的動態單元名稱
  // 這可以避免因為資料庫資料不足而造成系統出錯，同時又能引導 AI
  let fallbackUnit = '';
  if (targetWeek === 9 || targetWeek === 10) {
    fallbackUnit = '期中複習與核心概念檢測';
  } else if (targetWeek === 20 || targetWeek === 21) {
    fallbackUnit = '期末複習與學期成就檢測';
  } else {
    // 動態拼裝單元
    const unitIndex = Math.ceil(targetWeek / 2);
    fallbackUnit = `第 ${unitIndex} 單元進度學習與概念加強`;
  }

  return {
    week: currentWeek,
    targetWeek: targetWeek,
    unit: fallbackUnit,
    isFallback: true
  };
}

module.exports = {
  getCurrentAcademicWeek,
  getPredictedUnit,
  SYLLABUS_DB
};
