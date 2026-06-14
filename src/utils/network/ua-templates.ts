/**
 * UA 模板库数据
 * 预置常见桌面端和移动端 UserAgent 字符串
 */

export interface UATemplate {
  id: string;
  /** 显示名称，如 "Chrome 126 / Windows 11" */
  name: string;
  /** 平台分类：desktop / mobile */
  platform: 'desktop' | 'mobile';
  /** 浏览器名称 */
  browser: string;
  /** 操作系统 */
  os: string;
  /** UA 字符串 */
  ua: string;
}

export interface UACategory {
  label: string;
  platform: 'desktop' | 'mobile';
  browsers: string[];
}

export const uaCategories: UACategory[] = [
  {
    label: '桌面端',
    platform: 'desktop',
    browsers: ['Chrome', 'Firefox', 'Edge', 'Safari'],
  },
  {
    label: '移动端',
    platform: 'mobile',
    browsers: ['Safari', 'Chrome', 'Edge', 'Firefox', '微信', '微信小程序', '企业微信', 'QQ', '抖音', '微博', '百度', '支付宝', '支付宝小程序', '钉钉', '飞书'],
  },
];

export const uaTemplates: UATemplate[] = [
  // === 桌面端 - Chrome ===
  {
    id: 'chrome-win11',
    name: 'Chrome 126 / Windows 11',
    platform: 'desktop',
    browser: 'Chrome',
    os: 'Windows 11',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  },
  {
    id: 'chrome-win10',
    name: 'Chrome 126 / Windows 10',
    platform: 'desktop',
    browser: 'Chrome',
    os: 'Windows 10',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  },
  {
    id: 'chrome-mac',
    name: 'Chrome 126 / macOS',
    platform: 'desktop',
    browser: 'Chrome',
    os: 'macOS',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  },
  {
    id: 'chrome-linux',
    name: 'Chrome 126 / Linux',
    platform: 'desktop',
    browser: 'Chrome',
    os: 'Linux',
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  },

  // === 桌面端 - Firefox ===
  {
    id: 'firefox-win',
    name: 'Firefox 127 / Windows 11',
    platform: 'desktop',
    browser: 'Firefox',
    os: 'Windows 11',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  },
  {
    id: 'firefox-mac',
    name: 'Firefox 127 / macOS',
    platform: 'desktop',
    browser: 'Firefox',
    os: 'macOS',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0',
  },
  {
    id: 'firefox-linux',
    name: 'Firefox 127 / Linux',
    platform: 'desktop',
    browser: 'Firefox',
    os: 'Linux',
    ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  },

  // === 桌面端 - Edge ===
  {
    id: 'edge-win11',
    name: 'Edge 126 / Windows 11',
    platform: 'desktop',
    browser: 'Edge',
    os: 'Windows 11',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  },
  {
    id: 'edge-mac',
    name: 'Edge 126 / macOS',
    platform: 'desktop',
    browser: 'Edge',
    os: 'macOS',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  },

  // === 桌面端 - Safari ===
  {
    id: 'safari-mac',
    name: 'Safari 17 / macOS',
    platform: 'desktop',
    browser: 'Safari',
    os: 'macOS',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  },

  // === 移动端 - Safari (iOS) ===
  {
    id: 'safari-iphone15',
    name: 'Safari / iPhone 15 Pro',
    platform: 'mobile',
    browser: 'Safari',
    os: 'iOS 17',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'safari-iphone14',
    name: 'Safari / iPhone 14',
    platform: 'mobile',
    browser: 'Safari',
    os: 'iOS 17',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'safari-ipad',
    name: 'Safari / iPad Pro',
    platform: 'mobile',
    browser: 'Safari',
    os: 'iPadOS 17',
    ua: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },

  // === 移动端 - Chrome (Android) ===
  {
    id: 'chrome-pixel8',
    name: 'Chrome / Pixel 8',
    platform: 'mobile',
    browser: 'Chrome',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36',
  },
  {
    id: 'chrome-samsung',
    name: 'Chrome / Samsung S24',
    platform: 'mobile',
    browser: 'Chrome',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36',
  },
  {
    id: 'chrome-android-generic',
    name: 'Chrome / Android 通用',
    platform: 'mobile',
    browser: 'Chrome',
    os: 'Android 13',
    ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36',
  },

  // === 移动端 - Edge ===
  {
    id: 'edge-iphone',
    name: 'Edge / iPhone',
    platform: 'mobile',
    browser: 'Edge',
    os: 'iOS 17',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/126.0.2592.79 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'edge-android',
    name: 'Edge / Pixel 8',
    platform: 'mobile',
    browser: 'Edge',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36 EdgA/126.0.2592.79',
  },

  // === 移动端 - Firefox ===
  {
    id: 'firefox-android',
    name: 'Firefox / Pixel 8',
    platform: 'mobile',
    browser: 'Firefox',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
  },

  // === 移动端 - 微信 ===
  {
    id: 'wechat-iphone',
    name: '微信内置 / iPhone',
    platform: 'mobile',
    browser: '微信',
    os: 'iOS 17',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003133) NetType/WIFI Language/zh_CN',
  },
  {
    id: 'wechat-android',
    name: '微信内置 / Android',
    platform: 'mobile',
    browser: '微信',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 MicroMessenger/8.0.49.2580(0x2800315B) NetType/WIFI Language/zh_CN',
  },

  // === 移动端 - 微信小程序 ===
  {
    id: 'wechat-miniprogram-iphone',
    name: '微信小程序 / iPhone',
    platform: 'mobile',
    browser: '微信小程序',
    os: 'iOS 17',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003133) NetType/WIFI Language/zh_CN miniProgram/wxab8b9c3d2e1f0a1b/2',
  },
  {
    id: 'wechat-miniprogram-android',
    name: '微信小程序 / Android',
    platform: 'mobile',
    browser: '微信小程序',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 MMWEBID/2345 MicroMessenger/8.0.49.2580(0x2800315B) WeChat/arm64 WeixinGPVersion/0303002b NetType/wifi Language/zh_CN ABI/arm64 miniProgram/wxab8b9c3d2e1f0a1b/2',
  },

  // === 移动端 - 企业微信 ===
  {
    id: 'wxwork-iphone',
    name: '企业微信 / iPhone',
    platform: 'mobile',
    browser: '企业微信',
    os: 'iOS 17',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 wxwork/4.1.30 MicroMessenger/7.0.1 Language/zh',
  },
  {
    id: 'wxwork-android',
    name: '企业微信 / Android',
    platform: 'mobile',
    browser: '企业微信',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 wxwork/4.1.30 MicroMessenger/7.0.1',
  },

  // === 移动端 - QQ ===
  {
    id: 'qq-iphone',
    name: 'QQ内置 / iPhone',
    platform: 'mobile',
    browser: 'QQ',
    os: 'iOS 17',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/9.0.20.605 V1_IPH_SQ_9.0.20_1_APP_A Pixel/1170 MiniAppEnable SimpleUIScheme/0 QQStat/0',
  },
  {
    id: 'qq-android',
    name: 'QQ内置 / Android',
    platform: 'mobile',
    browser: 'QQ',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 V1_AND_SQ_9.0.20_4346_YYB_D A_80620_1 QQ/9.0.20.605 NetType/WIFI WebP/0.3.0 AppId/0',
  },

  // === 移动端 - 抖音 ===
  {
    id: 'douyin-iphone',
    name: '抖音 / iPhone',
    platform: 'mobile',
    browser: '抖音',
    os: 'iOS 17',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AwemeByte/29.5.0 Channel/App Store ByteLocale/zh-Hans Region/CN',
  },
  {
    id: 'douyin-android',
    name: '抖音 / Android',
    platform: 'mobile',
    browser: '抖音',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 aweme/290500 SnssdAppVersionCode/29.5.0 JSAppVersion/2 Channel/App Store aid/1128',
  },

  // === 移动端 - 微博 ===
  {
    id: 'weibo-iphone',
    name: '微博 / iPhone',
    platform: 'mobile',
    browser: '微博',
    os: 'iOS 17',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Weibo (iPhone15,2,iOS17.5.1,Weibo14.5.0,1)',
  },
  {
    id: 'weibo-android',
    name: '微博 / Android',
    platform: 'mobile',
    browser: '微博',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 Weibo/___weibo__14.5.0__android',
  },

  // === 移动端 - 百度 ===
  {
    id: 'baidu-android',
    name: '百度App / Android',
    platform: 'mobile',
    browser: '百度',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 SP-engine/3.2.0 baiduboxapp/13.50.0.10 NABar/1.0',
  },

  // === 移动端 - 支付宝 ===
  {
    id: 'alipay-iphone',
    name: '支付宝 / iPhone',
    platform: 'mobile',
    browser: '支付宝',
    os: 'iOS 17',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Ariver/1.0.0 AliApp(AP/10.5.96.1000) AlipayClient/10.5.96.1000 AlipayLanguage/zh-Hans AlipayClientLanguage/zh',
  },
  {
    id: 'alipay-android',
    name: '支付宝 / Android',
    platform: 'mobile',
    browser: '支付宝',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; U; Android 14; zh-CN; Pixel 8 Build/UQ1A.240205.004) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 AliApp(AP/10.5.96.1000) AlipayClient/10.5.96.1000 AlipayLanguage/zh-Hans',
  },

  // === 移动端 - 支付宝小程序 ===
  {
    id: 'alipay-miniprogram-iphone',
    name: '支付宝小程序 / iPhone',
    platform: 'mobile',
    browser: '支付宝小程序',
    os: 'iOS 17',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Ariver/1.0.0 AliApp(AP/10.5.96.1000) AlipayClient/10.5.96.1000 AlipayLanguage/zh-Hans AlipayClientLanguage/zh TinyApp/3.9.0',
  },

  // === 移动端 - 钉钉 ===
  {
    id: 'dingtalk-android',
    name: '钉钉 / Android',
    platform: 'mobile',
    browser: '钉钉',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 AliApp(DingTalk/7.6.0) DingTalk/7.6.0',
  },

  // === 移动端 - 飞书 ===
  {
    id: 'lark-android',
    name: '飞书 / Android',
    platform: 'mobile',
    browser: '飞书',
    os: 'Android 14',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 Lark/7.6.0',
  },
];

/**
 * 按筛选条件过滤模板
 */
export function filterTemplates(
  platform: 'all' | 'desktop' | 'mobile',
  browser: string,
): UATemplate[] {
  return uaTemplates.filter((t) => {
    if (platform !== 'all' && t.platform !== platform) return false;
    if (browser && t.browser !== browser) return false;
    return true;
  });
}

/**
 * 获取指定平台下的浏览器列表（去重）
 */
export function getBrowsersByPlatform(platform: 'desktop' | 'mobile'): string[] {
  const browsers = new Set<string>();
  for (const t of uaTemplates) {
    if (t.platform === platform) browsers.add(t.browser);
  }
  return Array.from(browsers);
}
