/**
 * 附加建议区块（非 postgresql.conf 内容）。
 *
 * OS 层设置（sysctl / 大页 / 文件描述符）不属于 postgresql.conf，
 * 生成器在产物之外单独输出，并按来源分两区：官方文档背书 vs 社区惯例
 * （明确标注"官方文档未覆盖"），素材以 research §5 为准
 * （源：kernel-resources.html 与 huge_pages 参数页 16/17/18 三版核对）。
 * 主从模式追加"备库初始化提示"：主库侧 SQL + pg_basebackup 命令 + 备库要点。
 */
import { computeHugePages, computeMaxConnections } from './compute';
import type { GenerateContext } from './params';

/** 单条 OS 层建议 */
export interface OsAdviceItem {
  /** 建议标题（如 'vm.swappiness = 1'） */
  title: string;
  /** 可直接执行的命令（多行命令用换行分隔，一次性执行或写入配置文件） */
  command: string;
  /** 为什么需要这条设置的中文说明（含官方来源或社区惯例标注） */
  reason: string;
}

/** OS 建议分区：按来源分组，面板按分区渲染标题与标注 */
export interface OsAdviceSection {
  /** 分区来源：official = 官方文档背书；community = 社区惯例（官方文档未覆盖） */
  source: 'official' | 'community';
  /** 分区标题（如 '官方文档背书'） */
  label: string;
  /** 分区来源标注文案 */
  note: string;
  /** 该分区建议条目 */
  items: OsAdviceItem[];
}

/** 备库初始化提示（仅主从模式由页面调用展示） */
export interface ReplicationSetupHint {
  /** 提示标题 */
  title: string;
  /** 可改占位符后直接执行的命令块：主库侧 SQL（建角色/建槽）+ 备库 pg_basebackup 命令 */
  commands: string;
  /** 备库要点列表（standby ≥ 主库三项 / hot_standby / -R 自动写配置等） */
  points: string[];
}

/**
 * 构建 OS 层建议（两分区：官方背书 + 社区惯例）。
 * 大页分配条目按上下文联动：仅 conf 输出 huge_pages = try/on（内存 ≥ 16GB）时出现；
 * fs.file-max 说明联动当前画像的 max_connections 推荐值。
 * @param ctx - 生成上下文
 * @returns 分区建议数组（恒为官方 + 社区两区）
 */
export function buildOsAdvice(ctx: GenerateContext): OsAdviceSection[] {
  const maxConnections = computeMaxConnections(ctx);
  const hugePagesEnabled = computeHugePages(ctx) !== 'off';
  const officialItems: OsAdviceItem[] = [
    {
      title: '禁用透明大页（THP）',
      command: 'echo never > /sys/kernel/mm/transparent_hugepage/enabled',
      reason: '官方 huge_pages 参数页原文：THP "known to cause performance degradation … currently discouraged"（官方明确不推荐）；具体取值 never/madvise 官方未给、属社区惯例。注意 conf 中 huge_pages = try/on 指显式 hugetlbfs 大页，与 THP 是两回事。',
    },
    {
      title: 'vm.overcommit_memory = 2',
      command: 'sysctl -w vm.overcommit_memory=2\nsysctl -w vm.overcommit_ratio=90   # 官方未给数值，90 为社区常用配比',
      reason: '官方 kernel-resources 文档推荐 strict overcommit 模式，防止内存超售后 OOM killer 误杀 postmaster；更根本的解法是压低内存参数与 max_connections、上连接池。',
    },
    ...(hugePagesEnabled
      ? [
          {
            title: '预分配显式大页 vm.nr_hugepages',
            command: 'postgres -D <PGDATA> -C shared_memory_size_in_huge_pages   # 预估共享内存所需大页数\nsysctl -w vm.nr_hugepages=<上一步输出的数值>',
            reason: '当前 conf 输出 huge_pages = try/on，按官方流程预分配显式大页：先预估页数再分配，核对 /proc/meminfo 的 HugePages_Total，并给 postgres 运行账号配好 vm.hugetlb_shm_group 与 memlock 上限。',
          } satisfies OsAdviceItem,
        ]
      : []),
    {
      title: 'fs.file-max 系统级文件描述符上限',
      command: 'sysctl -w fs.file-max=262144   # 示例值：按连接规模上调并持久化到 /etc/sysctl.d/',
      reason: `官方 kernel-resources 文档覆盖系统级文件描述符上限（Linux 经 sysctl 持久化）：每连接消耗套接字与文件描述符，按当前推荐 max_connections = ${maxConnections} 预留余量。`,
    },
  ];
  const communityItems: OsAdviceItem[] = [
    {
      title: 'vm.swappiness = 1',
      command: 'sysctl -w vm.swappiness=1   # 永久生效写入 /etc/sysctl.conf',
      reason: '官方文档未覆盖该参数（kernel-resources 全篇未提及 swappiness）；社区惯例设 1 而非 0，保留内存紧张时的紧急换页通道，避免数据库页被大量换出造成抖动。',
    },
    {
      title: 'ulimit -n 65535',
      command: 'ulimit -n 65535   # systemd 部署写 LimitNOFILE=65535',
      reason: '官方文档未覆盖进程级 nofile 的具体数字（仅说明发行版默认偏保守，专用服务器可上调）；社区惯例 65535 覆盖连接与复制流的句柄开销。',
    },
  ];
  return [
    {
      source: 'official',
      label: '官方文档背书',
      note: '来源：postgresql.org 官方文档（kernel-resources 章节与 huge_pages 参数页）',
      items: officialItems,
    },
    {
      source: 'community',
      label: '社区惯例',
      note: '以下取值官方文档未覆盖，为社区运维惯例，请结合实际环境评估后采用',
      items: communityItems,
    },
  ];
}

/**
 * 构建备库初始化提示（仅主从模式由页面调用）。
 * 16–18 语法一致无版本分支，唯一差异是 pg_basebackup -D 的数据目录路径按版本插值
 * （Debian/Ubuntu 布局 /var/lib/postgresql/{version}/main）。口令一律 '...' 占位，
 * 不输出任何明文密码生成物。
 * @param ctx - 生成上下文（取 version 插值数据目录路径）
 * @returns 备库初始化提示
 */
export function buildReplicationHint(ctx: GenerateContext): ReplicationSetupHint {
  return {
    title: '备库初始化（主库建角色/建槽 + 备库 basebackup）',
    commands: [
      '-- 1. 主库建复制角色（口令为占位符，执行前替换；勿把明文口令写进脚本或 conf）',
      "CREATE ROLE replicator WITH LOGIN REPLICATION PASSWORD '...';",
      "-- 2. 主库预建物理复制槽（immediately_reserve 立即保留 LSN，防备份窗口 WAL 被回收）",
      "SELECT * FROM pg_create_physical_replication_slot('standby1', true);",
      '-- 3. 备库初始化（在备库执行；已预建槽，勿再加 -C）',
      `pg_basebackup -h <主库IP> -U replicator -D /var/lib/postgresql/${ctx.version}/main -X stream -S standby1 -R`,
    ].join('\n'),
    points: [
      '备库的 max_connections、max_worker_processes、max_wal_senders 必须大于等于主库（官方文档原文要求，否则备库拒绝查询或复制）；用本页同画像生成的 conf 直接部署备库即满足',
      'hot_standby 官方默认已 on（PG 10+），无需写入备库配置',
      '-R 会自动写 standby.signal，并把 primary_conninfo / primary_slot_name 追加到备库 postgresql.auto.conf，无需手工编辑恢复配置',
      '若不想预建槽：去掉第 2 步 SQL，并在 pg_basebackup 追加 -C 由备份进程建槽（两种方式二选一，槽已存在时 -C 会报错）',
      '主库侧建议配 max_slot_wal_keep_size 限制宕机备库/弃用槽持有的 WAL 上限，防止 pg_wal 撑满磁盘',
    ],
  };
}
