/**
 * PostgreSQL 时区候选表（工具私有数据，design §7b，暂不上浮共享层）。
 *
 * 名单取法：以 `Intl.supportedValuesOf('timeZone')` 的真实 IANA 名全集为底册人工
 * 精选 83 条常用时区，禁止凭记忆编造。`UTC` 虽不在 canonical 枚举内，但它是真实
 * IANA 时区（tzdata 中为 Etc/UTC 的链接）且是 postgresql.conf 最常用的时区取值，
 * 故显式保留。
 *
 * CLDR 拼写取舍：统一采用**现代规范拼写**（Kolkata / Ho_Chi_Minh / Kathmandu /
 * Yangon / Kyiv——tzdata 主文件的 Zone 名），旧拼写（Calcutta / Saigon / Katmandu /
 * Rangoon / Kiev）仅作 keywords 搜索别名。两种拼写 PostgreSQL 与浏览器 Intl 均可
 * 解析（tzdata backward 互为链接），有效性由测试以 `Intl.DateTimeFormat` 可解析性
 * 锚定（接受面与 PostgreSQL tzdata 一致，不依赖枚举成员）。
 *
 * offset 为标准时区偏移（不含夏令时）：北半球夏令时区取 1 月、南半球（澳大利亚/
 * 新西兰/智利/阿根廷等）取 7 月，全年取最小偏移即标准偏移。初值由脚本以
 * `Intl.DateTimeFormat(..., { timeZoneName: 'longOffset' })` 生成（不手算），
 * 再人工逐一核对符号与小时，半时区（+5:30/+5:45/+6:30/+4:30/+3:30/-3:30/+9:30）
 * 与 UTC+13/+14 已逐一核对；运行时标准偏移变化时由 timezones.test.ts 语义断言兜底。
 */

/** 时区所属大区（下拉排序与搜索关键词用；UTC 归入"其他"） */
export type TimezoneRegion = '亚洲' | '欧洲' | '美洲' | '大洋洲' | '非洲' | '其他';

/** 时区表条目（value 即写入 conf 的值） */
export interface TimezoneEntry {
  /** IANA 时区名（如 'Asia/Shanghai'） */
  value: string;
  /** 中文标注（触发器展示文本，如 '中国标准时间'） */
  label: string;
  /** 所属大区 */
  region: TimezoneRegion;
  /** 标准时区偏移（UTC±H[:MM] 形态，不含夏令时） */
  offset: string;
  /** 额外搜索关键词（城市中文名 / 英文名 / 现代拼写别名等，大小写不敏感） */
  keywords: string[];
}

/** 时区候选表（数组顺序即下拉默认展示顺序：其他 → 亚洲 → 欧洲 → 美洲 → 大洋洲 → 非洲） */
export const TIMEZONES: TimezoneEntry[] = [
  { value: 'UTC', label: '协调世界时（UTC）', region: '其他', offset: 'UTC+0', keywords: ['GMT', '世界时', '零时区'] },

  // ===== 亚洲 =====
  { value: 'Asia/Shanghai', label: '中国标准时间', region: '亚洲', offset: 'UTC+8', keywords: ['上海', '中国', 'Beijing', 'CST'] },
  { value: 'Asia/Hong_Kong', label: '香港时间', region: '亚洲', offset: 'UTC+8', keywords: ['香港', 'HKT'] },
  { value: 'Asia/Taipei', label: '台北时间', region: '亚洲', offset: 'UTC+8', keywords: ['台北', '台湾', 'Taiwan'] },
  { value: 'Asia/Macau', label: '澳门时间', region: '亚洲', offset: 'UTC+8', keywords: ['澳门', 'Macao'] },
  { value: 'Asia/Tokyo', label: '日本标准时间', region: '亚洲', offset: 'UTC+9', keywords: ['东京', '日本', 'JST'] },
  { value: 'Asia/Seoul', label: '韩国标准时间', region: '亚洲', offset: 'UTC+9', keywords: ['首尔', '韩国', 'KST'] },
  { value: 'Asia/Singapore', label: '新加坡标准时间', region: '亚洲', offset: 'UTC+8', keywords: ['新加坡', 'Singapore'] },
  { value: 'Asia/Bangkok', label: '泰国标准时间', region: '亚洲', offset: 'UTC+7', keywords: ['曼谷', '泰国', 'Thailand'] },
  { value: 'Asia/Ho_Chi_Minh', label: '越南标准时间', region: '亚洲', offset: 'UTC+7', keywords: ['胡志明市', '西贡', '越南', 'Saigon', 'Ho Chi Minh'] },
  { value: 'Asia/Jakarta', label: '印尼西部时间', region: '亚洲', offset: 'UTC+7', keywords: ['雅加达', '印度尼西亚', 'Jakarta'] },
  { value: 'Asia/Kuala_Lumpur', label: '马来西亚标准时间', region: '亚洲', offset: 'UTC+8', keywords: ['吉隆坡', 'Malaysia'] },
  { value: 'Asia/Manila', label: '菲律宾标准时间', region: '亚洲', offset: 'UTC+8', keywords: ['马尼拉', 'Philippines'] },
  { value: 'Asia/Kolkata', label: '印度标准时间', region: '亚洲', offset: 'UTC+5:30', keywords: ['印度', '加尔各答', '孟买', '新德里', 'IST', 'Kolkata', 'Calcutta', 'Mumbai'] },
  { value: 'Asia/Dhaka', label: '孟加拉国标准时间', region: '亚洲', offset: 'UTC+6', keywords: ['达卡', 'Bangladesh'] },
  { value: 'Asia/Kathmandu', label: '尼泊尔时间', region: '亚洲', offset: 'UTC+5:45', keywords: ['加德满都', '尼泊尔', 'Nepal', 'Kathmandu'] },
  { value: 'Asia/Yangon', label: '缅甸时间', region: '亚洲', offset: 'UTC+6:30', keywords: ['仰光', '缅甸', 'Myanmar', 'Yangon'] },
  { value: 'Asia/Kabul', label: '阿富汗时间', region: '亚洲', offset: 'UTC+4:30', keywords: ['喀布尔', 'Afghanistan'] },
  { value: 'Asia/Dubai', label: '海湾标准时间（阿联酋）', region: '亚洲', offset: 'UTC+4', keywords: ['迪拜', '阿联酋', 'UAE', 'Gulf'] },
  { value: 'Asia/Riyadh', label: '沙特标准时间', region: '亚洲', offset: 'UTC+3', keywords: ['利雅得', '沙特', 'Saudi'] },
  { value: 'Asia/Tehran', label: '伊朗标准时间', region: '亚洲', offset: 'UTC+3:30', keywords: ['德黑兰', '伊朗', 'Iran'] },
  { value: 'Asia/Karachi', label: '巴基斯坦标准时间', region: '亚洲', offset: 'UTC+5', keywords: ['卡拉奇', '巴基斯坦', 'Pakistan'] },
  { value: 'Asia/Tashkent', label: '乌兹别克斯坦时间', region: '亚洲', offset: 'UTC+5', keywords: ['塔什干', '乌兹别克', 'Uzbekistan'] },
  { value: 'Asia/Almaty', label: '哈萨克斯坦时间（阿拉木图）', region: '亚洲', offset: 'UTC+5', keywords: ['阿拉木图', '哈萨克斯坦', 'Almaty'] },
  { value: 'Asia/Ulaanbaatar', label: '蒙古标准时间', region: '亚洲', offset: 'UTC+8', keywords: ['乌兰巴托', '蒙古', 'Ulaanbaatar'] },
  { value: 'Asia/Jerusalem', label: '以色列标准时间', region: '亚洲', offset: 'UTC+2', keywords: ['耶路撒冷', '以色列', 'Israel'] },
  { value: 'Asia/Yekaterinburg', label: '叶卡捷琳堡时间', region: '亚洲', offset: 'UTC+5', keywords: ['叶卡捷琳堡', 'Yekaterinburg'] },
  { value: 'Asia/Novosibirsk', label: '新西伯利亚时间', region: '亚洲', offset: 'UTC+7', keywords: ['新西伯利亚', 'Novosibirsk'] },
  { value: 'Asia/Vladivostok', label: '海参崴时间', region: '亚洲', offset: 'UTC+10', keywords: ['海参崴', '符拉迪沃斯托克', 'Vladivostok'] },

  // ===== 欧洲 =====
  { value: 'Europe/London', label: '格林尼治标准时间', region: '欧洲', offset: 'UTC+0', keywords: ['伦敦', '英国', 'GMT', 'London'] },
  { value: 'Europe/Paris', label: '巴黎时间', region: '欧洲', offset: 'UTC+1', keywords: ['巴黎', '法国', 'France'] },
  { value: 'Europe/Berlin', label: '柏林时间', region: '欧洲', offset: 'UTC+1', keywords: ['柏林', '德国', 'Germany'] },
  { value: 'Europe/Moscow', label: '莫斯科时间', region: '欧洲', offset: 'UTC+3', keywords: ['莫斯科', '俄罗斯', 'Russia'] },
  { value: 'Europe/Amsterdam', label: '阿姆斯特丹时间', region: '欧洲', offset: 'UTC+1', keywords: ['荷兰', 'Netherlands'] },
  { value: 'Europe/Zurich', label: '苏黎世时间', region: '欧洲', offset: 'UTC+1', keywords: ['苏黎世', '瑞士', 'Switzerland'] },
  { value: 'Europe/Madrid', label: '马德里时间', region: '欧洲', offset: 'UTC+1', keywords: ['马德里', '西班牙', 'Spain'] },
  { value: 'Europe/Rome', label: '罗马时间', region: '欧洲', offset: 'UTC+1', keywords: ['罗马', '意大利', 'Italy'] },
  { value: 'Europe/Stockholm', label: '斯德哥尔摩时间', region: '欧洲', offset: 'UTC+1', keywords: ['瑞典', 'Sweden'] },
  { value: 'Europe/Athens', label: '雅典时间', region: '欧洲', offset: 'UTC+2', keywords: ['雅典', '希腊', 'Greece'] },
  { value: 'Europe/Kyiv', label: '基辅时间', region: '欧洲', offset: 'UTC+2', keywords: ['基辅', '乌克兰', 'Ukraine', 'Kyiv', 'Kiev'] },
  { value: 'Europe/Warsaw', label: '华沙时间', region: '欧洲', offset: 'UTC+1', keywords: ['华沙', '波兰', 'Poland'] },
  { value: 'Europe/Vienna', label: '维也纳时间', region: '欧洲', offset: 'UTC+1', keywords: ['维也纳', '奥地利', 'Austria'] },
  { value: 'Europe/Prague', label: '布拉格时间', region: '欧洲', offset: 'UTC+1', keywords: ['布拉格', '捷克', 'Prague'] },
  { value: 'Europe/Budapest', label: '布达佩斯时间', region: '欧洲', offset: 'UTC+1', keywords: ['布达佩斯', '匈牙利', 'Hungary'] },
  { value: 'Europe/Bucharest', label: '布加勒斯特时间', region: '欧洲', offset: 'UTC+2', keywords: ['布加勒斯特', '罗马尼亚', 'Bucharest'] },
  { value: 'Europe/Helsinki', label: '赫尔辛基时间', region: '欧洲', offset: 'UTC+2', keywords: ['赫尔辛基', '芬兰', 'Finland'] },
  { value: 'Europe/Lisbon', label: '里斯本时间', region: '欧洲', offset: 'UTC+0', keywords: ['里斯本', '葡萄牙', 'Portugal'] },
  { value: 'Europe/Istanbul', label: '土耳其时间', region: '欧洲', offset: 'UTC+3', keywords: ['伊斯坦布尔', '土耳其', 'Istanbul'] },

  // ===== 美洲 =====
  { value: 'America/New_York', label: '美国东部时间', region: '美洲', offset: 'UTC-5', keywords: ['纽约', '华盛顿', '波士顿', 'EST', 'New York'] },
  { value: 'America/Toronto', label: '多伦多时间', region: '美洲', offset: 'UTC-5', keywords: ['多伦多', '加拿大', 'Toronto'] },
  { value: 'America/Chicago', label: '美国中部时间', region: '美洲', offset: 'UTC-6', keywords: ['芝加哥', '休斯敦', 'CST', 'Chicago'] },
  { value: 'America/Mexico_City', label: '墨西哥城时间', region: '美洲', offset: 'UTC-6', keywords: ['墨西哥城', '墨西哥', 'Mexico'] },
  { value: 'America/Denver', label: '美国山地时间', region: '美洲', offset: 'UTC-7', keywords: ['丹佛', 'MST', 'Denver'] },
  { value: 'America/Phoenix', label: '美国山地时间（凤凰城）', region: '美洲', offset: 'UTC-7', keywords: ['凤凰城', '亚利桑那', '无夏令时', 'Phoenix'] },
  { value: 'America/Los_Angeles', label: '美国太平洋时间', region: '美洲', offset: 'UTC-8', keywords: ['洛杉矶', '旧金山', '西雅图', 'PST', 'Los Angeles'] },
  { value: 'America/Vancouver', label: '温哥华时间', region: '美洲', offset: 'UTC-8', keywords: ['温哥华', '加拿大', 'Vancouver'] },
  { value: 'America/Anchorage', label: '阿拉斯加时间', region: '美洲', offset: 'UTC-9', keywords: ['安克雷奇', '阿拉斯加', 'Alaska'] },
  { value: 'America/St_Johns', label: '纽芬兰时间', region: '美洲', offset: 'UTC-3:30', keywords: ['圣约翰斯', '纽芬兰', 'Newfoundland'] },
  { value: 'America/Sao_Paulo', label: '巴西利亚时间（圣保罗）', region: '美洲', offset: 'UTC-3', keywords: ['圣保罗', '巴西', 'Sao Paulo'] },
  { value: 'America/Buenos_Aires', label: '阿根廷时间', region: '美洲', offset: 'UTC-3', keywords: ['布宜诺斯艾利斯', '阿根廷', 'Argentina'] },
  { value: 'America/Santiago', label: '智利时间', region: '美洲', offset: 'UTC-4', keywords: ['圣地亚哥', '智利', 'Chile'] },
  { value: 'America/Lima', label: '秘鲁时间', region: '美洲', offset: 'UTC-5', keywords: ['利马', '秘鲁', 'Peru'] },
  { value: 'America/Bogota', label: '哥伦比亚时间', region: '美洲', offset: 'UTC-5', keywords: ['波哥大', '哥伦比亚', 'Colombia'] },
  { value: 'America/Caracas', label: '委内瑞拉时间', region: '美洲', offset: 'UTC-4', keywords: ['加拉加斯', '委内瑞拉', 'Venezuela'] },
  { value: 'America/La_Paz', label: '玻利维亚时间', region: '美洲', offset: 'UTC-4', keywords: ['拉巴斯', '玻利维亚', 'Bolivia'] },
  { value: 'America/Montevideo', label: '乌拉圭时间', region: '美洲', offset: 'UTC-3', keywords: ['蒙得维的亚', '乌拉圭', 'Uruguay'] },

  // ===== 大洋洲 =====
  { value: 'Pacific/Honolulu', label: '夏威夷时间', region: '大洋洲', offset: 'UTC-10', keywords: ['檀香山', '火奴鲁鲁', '美国', 'Hawaii', 'HST'] },
  { value: 'Australia/Sydney', label: '澳大利亚东部时间（悉尼）', region: '大洋洲', offset: 'UTC+10', keywords: ['悉尼', '澳大利亚', 'Sydney'] },
  { value: 'Australia/Melbourne', label: '澳大利亚东部时间（墨尔本）', region: '大洋洲', offset: 'UTC+10', keywords: ['墨尔本', '澳大利亚', 'Melbourne'] },
  { value: 'Australia/Brisbane', label: '澳大利亚东部时间（布里斯班）', region: '大洋洲', offset: 'UTC+10', keywords: ['布里斯班', '无夏令时', 'Brisbane'] },
  { value: 'Australia/Perth', label: '澳大利亚西部时间', region: '大洋洲', offset: 'UTC+8', keywords: ['珀斯', '澳大利亚', 'Perth'] },
  { value: 'Australia/Adelaide', label: '澳大利亚中部时间（阿德莱德）', region: '大洋洲', offset: 'UTC+9:30', keywords: ['阿德莱德', 'Adelaide'] },
  { value: 'Australia/Darwin', label: '澳大利亚中部时间（达尔文）', region: '大洋洲', offset: 'UTC+9:30', keywords: ['达尔文', '无夏令时', 'Darwin'] },
  { value: 'Pacific/Auckland', label: '新西兰标准时间', region: '大洋洲', offset: 'UTC+12', keywords: ['奥克兰', '新西兰', 'Auckland', 'New Zealand'] },
  { value: 'Pacific/Fiji', label: '斐济时间', region: '大洋洲', offset: 'UTC+12', keywords: ['斐济', '苏瓦', 'Fiji'] },
  { value: 'Pacific/Tongatapu', label: '汤加时间', region: '大洋洲', offset: 'UTC+13', keywords: ['汤加', '努库阿洛法', 'Tonga'] },
  { value: 'Pacific/Apia', label: '萨摩亚时间', region: '大洋洲', offset: 'UTC+13', keywords: ['萨摩亚', '阿皮亚', 'Samoa'] },
  { value: 'Pacific/Kiritimati', label: '莱恩群岛时间（基里巴斯）', region: '大洋洲', offset: 'UTC+14', keywords: ['基里巴斯', '圣诞岛', 'Kiritimati'] },

  // ===== 非洲 =====
  { value: 'Africa/Cairo', label: '埃及标准时间', region: '非洲', offset: 'UTC+2', keywords: ['开罗', '埃及', 'Egypt'] },
  { value: 'Africa/Johannesburg', label: '南非标准时间', region: '非洲', offset: 'UTC+2', keywords: ['约翰内斯堡', '南非', 'Johannesburg'] },
  { value: 'Africa/Nairobi', label: '东非时间', region: '非洲', offset: 'UTC+3', keywords: ['内罗毕', '肯尼亚', 'Nairobi'] },
  { value: 'Africa/Lagos', label: '西非时间', region: '非洲', offset: 'UTC+1', keywords: ['拉各斯', '尼日利亚', 'Lagos'] },
  { value: 'Africa/Casablanca', label: '摩洛哥时间', region: '非洲', offset: 'UTC+1', keywords: ['卡萨布兰卡', '摩洛哥', 'Morocco'] },
];

/** 搜索下拉选项（SearchSelect options 契约形态：value/label + keywords） */
export interface TimezoneOption {
  /** 选项值（IANA 时区名，写入 conf 的值） */
  value: string;
  /** 展示文本（中文标注） */
  label: string;
  /** 过滤关键词（IANA 名 / 大区 / 偏移 / 城市，大小写不敏感） */
  keywords: string[];
}

/** 时区表 → 搜索下拉选项（关键词含 IANA 名 / 中文标注 / 偏移，见文件头"名单取法"） */
export const TIMEZONE_OPTIONS: TimezoneOption[] = TIMEZONES.map((t) => ({
  value: t.value,
  label: t.label,
  keywords: [t.value, t.region, t.offset, t.label, ...t.keywords],
}));
