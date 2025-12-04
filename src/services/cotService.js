import fs from 'fs';
import path from 'path';

const cotSettingsPath = path.join(process.cwd(), 'src', 'data', 'cotSettings.json');

// 기본 설정
const defaultSettings = {
  cotEnabled: true,
};

// 설정 로드
function loadSettings() {
  try {
    if (fs.existsSync(cotSettingsPath)) {
      const data = fs.readFileSync(cotSettingsPath, 'utf8');
      return JSON.parse(data);
    }
    return defaultSettings;
  } catch (error) {
    console.error('Error loading CoT settings:', error);
    return defaultSettings;
  }
}

// 설정 저장
function saveSettings(settings) {
  try {
    fs.writeFileSync(cotSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving CoT settings:', error);
    return false;
  }
}

// 현재 상태
let currentSettings = loadSettings();

const cotService = {
  /**
   * CoT 활성화 상태 조회
   * @returns {boolean}
   */
  isCotEnabled() {
    return currentSettings.cotEnabled;
  },

  /**
   * CoT 활성화
   * @returns {boolean} 새로운 상태
   */
  enableCot() {
    currentSettings.cotEnabled = true;
    saveSettings(currentSettings);
    console.log('[COT] Chain of Thought ENABLED');
    return currentSettings.cotEnabled;
  },

  /**
   * CoT 비활성화
   * @returns {boolean} 새로운 상태
   */
  disableCot() {
    currentSettings.cotEnabled = false;
    saveSettings(currentSettings);
    console.log('[COT] Chain of Thought DISABLED');
    return currentSettings.cotEnabled;
  },

  /**
   * CoT 토글
   * @returns {boolean} 새로운 상태
   */
  toggleCot() {
    currentSettings.cotEnabled = !currentSettings.cotEnabled;
    saveSettings(currentSettings);
    console.log(`[COT] Chain of Thought ${currentSettings.cotEnabled ? 'ENABLED' : 'DISABLED'}`);
    return currentSettings.cotEnabled;
  },

  /**
   * 설정 새로고침 (파일에서 다시 로드)
   */
  refresh() {
    currentSettings = loadSettings();
    return currentSettings;
  },
};

export default cotService;
