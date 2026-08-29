/**
 * 系统参数建议区块（非 redis.conf 内容）。
 *
 * Redis 的稳定运行依赖少量内核参数与 ulimit 设置，生成器在 conf 之外
 * 单独输出建议，与 tcp-backlog / maxclients 联动计算取值。
 */

/** 单条系统参数建议 */
export interface SysctlSuggestion {
  /** 建议标题（如 'vm.overcommit_memory'） */
  title: string;
  /** 可直接执行的命令（写入 /etc/sysctl.conf 或一次性执行） */
  command: string;
  /** 为什么需要这条设置的中文说明 */
  reason: string;
}

/** somaxconn 兜底下限（内核默认值） */
const SOMAXCONN_FLOOR = 511;
/** nofile 在 maxclients 基础上预留的句柄余量（官方建议 maxclients + 32） */
const NOFILE_HEADROOM = 32;

/**
 * 依据生成的 conf 关键值构建系统参数建议列表。
 * @param input - 来自 conf 的联动值：tcp-backlog 与 maxclients
 * @returns 建议条目数组
 */
export function buildSysctlSuggestions(input: {
  tcpBacklog: number;
  maxClients: number;
}): SysctlSuggestion[] {
  const somaxconn = Math.max(SOMAXCONN_FLOOR, input.tcpBacklog);
  const nofile = input.maxClients + NOFILE_HEADROOM;
  return [
    {
      title: 'vm.overcommit_memory = 1',
      command: 'sysctl -w vm.overcommit_memory=1   # 永久生效请写入 /etc/sysctl.conf',
      reason: 'RDB/AOF 后台保存依赖 fork 的写时复制，设为 1 可避免内存申请策略过严导致 fork 失败。',
    },
    {
      title: 'Transparent Huge Pages：关闭',
      command: 'echo never > /sys/kernel/mm/transparent_hugepage/enabled',
      reason: '透明大页会放大 fork 与写时复制的延迟，引起延迟尖刺，Redis 官方要求关闭。',
    },
    {
      title: `net.core.somaxconn = ${somaxconn}`,
      command: `sysctl -w net.core.somaxconn=${somaxconn}   # 需 ≥ tcp-backlog 值`,
      reason: '内核全连接队列上限必须不小于 conf 中的 tcp-backlog（当前 ' + input.tcpBacklog + '），否则积压被内核截断。',
    },
    {
      title: `ulimit nofile ≥ ${nofile}`,
      command: `ulimit -n ${nofile}   # systemd 部署写 LimitNOFILE=${nofile}`,
      reason: '官方建议文件句柄数为 maxclients + 32（当前 maxclients ' + input.maxClients + '），否则高并发时拒绝连接。',
    },
  ];
}
