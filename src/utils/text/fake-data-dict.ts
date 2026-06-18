/**
 * 假数据生成器内置词库。
 *
 * 提供中文姓氏、中文名用字、英文 first/last 名、Lorem ipsum 经典词库，
 * 均为静态数据，供字段生成器随机取用。
 */

/** 中文常见姓氏（约 60 个） */
export const CN_SURNAMES = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧',
  '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
  '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎',
  '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜',
];

/** 中文常见名用字（约 60 个） */
export const CN_GIVEN = [
  '伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋',
  '勇', '艳', '杰', '娟', '涛', '明', '超', '秀', '霞', '平',
  '刚', '桂', '英', '华', '斌', '颖', '鹏', '宇', '婷', '凯',
  '健', '俊', '红', '梅', '琳', '鑫', '波', '辉', '燕', '宁',
  '龙', '婷', '雪', '欣', '怡', '佳', '浩', '然', '梓', '涵',
  '子', '睿', '晨', '诺', '思', '博', '雅', '诗', '雨', '阳',
];

/** 英文常见 first name（约 40 个） */
export const EN_FIRST = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael',
  'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan',
  'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher',
  'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Helen',
  'Mark', 'Sandra', 'Donald', 'Donna', 'Steven', 'Carol', 'Paul', 'Ruth',
  'Andrew', 'Sharon', 'Joshua', 'Michelle',
];

/** 英文常见 last name（约 40 个） */
export const EN_LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
  'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
  'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
];

/** Lorem ipsum 经典词库（约 40 个） */
export const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing',
  'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore',
  'et', 'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam',
  'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip',
  'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'in',
  'reprehenderit', 'voluptate',
];
