/**
 * 附加建议区块（非 my.cnf 内容）。
 *
 * OS 层设置（ulimit / 内核参数 / IO 调度 / 文件系统）不属于 my.cnf，
 * 生成器在产物之外单独输出；主从模式追加"复制初始化 SQL 提示"，
 * 形态对齐 Redis 版的 sysctl 建议区块。
 */
import type { MysqlVersion } from './version';

/** 单条 OS 层建议 */
export interface OsAdvice {
  /** 建议标题（如 'vm.swappiness = 1'） */
  title: string;
  /** 可直接执行的命令（一次性执行或写入配置文件） */
  command: string;
  /** 为什么需要这条设置的中文说明 */
  reason: string;
}

/** 复制初始化 SQL 提示（主从模式追加区块） */
export interface ReplicationSetupHint {
  /** 提示标题 */
  title: string;
  /** 可改占位符后直接执行的复制初始化 SQL（与目标版本语法一致） */
  sql: string;
  /** 版本语法差异与前置条件说明 */
  note: string;
}

/**
 * 构建 OS 层建议列表。
 * @param input - 来自 conf 的联动值：max_connections（nofile 预留校验用）
 * @returns 建议条目数组
 */
export function buildOsAdvice(input: { maxConnections: number }): OsAdvice[] {
  return [
    {
      title: 'ulimit nofile ≥ 65535',
      command: 'ulimit -n 65535   # systemd 部署写 LimitNOFILE=65535',
      reason: `每连接消耗文件句柄与线程资源，nofile 需覆盖 max_connections（当前 ${input.maxConnections}）并留余量，否则高并发时报 Too many open files。`,
    },
    {
      title: 'vm.swappiness = 1',
      command: 'sysctl -w vm.swappiness=1   # 永久生效请写入 /etc/sysctl.conf',
      reason: 'InnoDB 缓冲页被换出会造成严重抖动；设 1 而非 0，保留内存紧张时的紧急换页通道。',
    },
    {
      title: 'I/O 调度器：NVMe/SSD 用 none',
      command: 'echo none > /sys/block/<数据盘>/queue/scheduler',
      reason: 'NVMe 多队列无需 I/O 重排；SSD 建议 none 或 mq-deadline；HDD 保留 mq-deadline 以合并连续写。',
    },
    {
      title: '文件系统：XFS / ext4 + noatime',
      command: 'mount -o noatime,nodiratime /dev/<数据盘> /var/lib/mysql',
      reason: '两种文件系统均可稳定承载 InnoDB；noatime 免去读操作更新访问时间的元数据写放大。',
    },
  ];
}

/**
 * 构建复制初始化 SQL 提示：占位符形式（主库地址/账号/密码），语法与目标版本一致
 * （8.0+ 用 CHANGE REPLICATION SOURCE TO 新语法，5.7 只认 CHANGE MASTER TO 旧语法）。
 * @param input - 目标版本与监听端口（SOURCE_PORT/MASTER_PORT 取默认端口，可改）
 * @returns 复制初始化提示；仅主从模式展示（展示逻辑在 UI 层）
 */
export function buildReplicationHint(input: {
  version: MysqlVersion;
  port: number;
}): ReplicationSetupHint {
  if (input.version === '5.7') {
    return {
      title: '复制初始化 SQL（在副本执行）',
      sql: [
        'CHANGE MASTER TO',
        "  MASTER_HOST = '<主库地址>',",
        `  MASTER_PORT = ${input.port},`,
        "  MASTER_USER = '<复制账号>',",
        "  MASTER_PASSWORD = '<复制密码>',",
        '  MASTER_AUTO_POSITION = 1;',
        'START SLAVE;',
        'SHOW SLAVE STATUS\\G',
      ].join('\n'),
      note: 'MySQL 5.7 只认 CHANGE MASTER TO 旧语法；8.0+ 新语法为 CHANGE REPLICATION SOURCE TO（SOURCE_HOST/SOURCE_USER/SOURCE_PASSWORD）与 START REPLICA。AUTO_POSITION=1 需主从均开启 gtid_mode=ON。',
    };
  }
  return {
    title: '复制初始化 SQL（在副本执行）',
    sql: [
      'CHANGE REPLICATION SOURCE TO',
      "  SOURCE_HOST = '<主库地址>',",
      `  SOURCE_PORT = ${input.port},`,
      "  SOURCE_USER = '<复制账号>',",
      "  SOURCE_PASSWORD = '<复制密码>',",
      '  SOURCE_AUTO_POSITION = 1,',
      '  GET_MASTER_PUBLIC_KEY = 1;',
      'START REPLICA;',
      'SHOW REPLICA STATUS\\G',
    ].join('\n'),
    note: 'MySQL 5.7 请用旧语法 CHANGE MASTER TO（MASTER_HOST/MASTER_USER/MASTER_PASSWORD）与 START SLAVE。SOURCE_AUTO_POSITION=1 需主从均开启 gtid_mode=ON；GET_MASTER_PUBLIC_KEY=1 供副本首次取回主库 RSA 公钥（caching_sha2_password 认证）。',
  };
}
